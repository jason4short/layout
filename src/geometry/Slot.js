import { Shape, Geometry, SnapType } from './Geometry.js';
import { Point } from './Point.js';
import { Line } from './Line.js';
import { Arc } from './Arc.js';
import * as VectorUtils from './utils/VectorUtils.js';
import undoManager from '../core/UndoManager.js';
import { BreakApartSlotCommand } from '../core/Commands.js';

/**
 * Slot - A rounded-end rectangle (stadium shape).
 *
 * Defined by a centerline (start to end) with width.
 * Ends are semicircular with radius = width/2.
 *
 * Great for: mortises, adjustment slots, CNC pockets, router cuts.
 *
 * POIs: 0=start, 1=end (control points), 2-5=tangent points, 6-7=end centers
 */

export class Slot extends Geometry {
	constructor(params) {
		super();
		this.type = Shape.PLAIN;
		this.geometry = Shape.SLOT;
		this.showHandlesWhenSelected = true;  // Primitives show control points when selected

		// params: [startX, startY, endX, endY, width]
		this.start = new Point(params[0] || 0, params[1] || 0);
		this.end = new Point(params[2] || 100, params[3] || 0);
		this.width = params[4] || 19.05;  // Default 3/4" in mm

		this.update();
	}

	update() {
		// Calculate bounds
		const points = this.getOutlinePoints();

		let minX = Infinity, minY = Infinity;
		let maxX = -Infinity, maxY = -Infinity;

		for (const p of points) {
			minX = Math.min(minX, p.x);
			minY = Math.min(minY, p.y);
			maxX = Math.max(maxX, p.x);
			maxY = Math.max(maxY, p.y);
		}

		// Add radius for the semicircular ends
		const r = this.width / 2;
		this.bounds.x = minX - r;
		this.bounds.y = minY - r;
		this.bounds.width = maxX - minX + this.width;
		this.bounds.height = maxY - minY + this.width;
	}

	// Get length of the centerline
	length() {
		return VectorUtils.distance(this.start, this.end);
	}

	// Get angle of the centerline in radians
	angle() {
		return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
	}

	// Scale to a specific length
	scaleToDim(dim) {
		if (!Number.isFinite(dim) || dim <= 0) {
			return false;
		}

		const direction = VectorUtils.vectorBetweenPoints(this.start, this.end);
		const currentLength = VectorUtils.length(direction);

		if (currentLength === 0) {
			return false;
		}

		const unitDir = VectorUtils.normalize(direction);
		this.end.x = this.start.x + (unitDir.x * dim);
		this.end.y = this.start.y + (unitDir.y * dim);

		this.update();
		return true;
	}

	// Get the tangent points where straight sides meet the arcs
	getOutlinePoints() {
		const angle = this.angle();
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);

		const r = this.width / 2;
		// Perpendicular offset
		const perpX = -sin * r;
		const perpY = cos * r;

		return [
			{ x: this.start.x - perpX, y: this.start.y - perpY },  // start top
			{ x: this.end.x - perpX, y: this.end.y - perpY },      // end top
			{ x: this.end.x + perpX, y: this.end.y + perpY },      // end bottom
			{ x: this.start.x + perpX, y: this.start.y + perpY }   // start bottom
		];
	}

	clone() {
		const s = new Slot([
			this.start.x, this.start.y,
			this.end.x, this.end.y,
			this.width
		]);
		s.type = this.type;
		s.groupId = this.groupId;
		s.penStyle = this.penStyle;
		s.colorToken = this.colorToken;
		return s;
	}

	copyFrom(other) {
		this.start.x = other.start.x;
		this.start.y = other.start.y;
		this.end.x = other.end.x;
		this.end.y = other.end.y;
		this.width = other.width;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.update();
	}

	// POIs for selection and snapping
	getSnapPOIs() {
		const points = this.getOutlinePoints();
		const r = this.width / 2;
		const angle = this.angle();

		// Midpoints of straight edges
		const topMid = {
			x: (points[0].x + points[1].x) / 2,
			y: (points[0].y + points[1].y) / 2
		};
		const bottomMid = {
			x: (points[2].x + points[3].x) / 2,
			y: (points[2].y + points[3].y) / 2
		};

		// Extreme points of the arcs (outermost points)
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const startExtreme = {
			x: this.start.x - cos * r,
			y: this.start.y - sin * r
		};
		const endExtreme = {
			x: this.end.x + cos * r,
			y: this.end.y + sin * r
		};

		return [
			{ x: this.start.x, y: this.start.y, type: SnapType.CENTER },   // 0: start control point
			{ x: this.end.x, y: this.end.y, type: SnapType.CENTER },       // 1: end control point
			{ x: points[0].x, y: points[0].y, type: SnapType.ENDPOINT },   // 2: start-top tangent
			{ x: points[1].x, y: points[1].y, type: SnapType.ENDPOINT },   // 3: end-top tangent
			{ x: points[2].x, y: points[2].y, type: SnapType.ENDPOINT },   // 4: end-bottom tangent
			{ x: points[3].x, y: points[3].y, type: SnapType.ENDPOINT },   // 5: start-bottom tangent
			{ x: topMid.x, y: topMid.y, type: SnapType.MIDPOINT },         // 6: top edge midpoint
			{ x: bottomMid.x, y: bottomMid.y, type: SnapType.MIDPOINT },   // 7: bottom edge midpoint
			{ x: startExtreme.x, y: startExtreme.y, type: SnapType.QUADRANT },  // 8: start arc extreme
			{ x: endExtreme.x, y: endExtreme.y, type: SnapType.QUADRANT }       // 9: end arc extreme
		];
	}

	getTransformablePoints() {
		return [this.start, this.end];
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		if (mouseRect && !this.bounds.intersects(mouseRect)) {
			return null;
		}

		const points = this.getOutlinePoints();
		const r = this.width / 2;
		let closest = null;
		let closestDist = Infinity;

		// Check straight edges
		for (let i = 0; i < 2; i++) {
			const p1 = points[i];
			const p2 = points[i + 1];
			const point = VectorUtils.closestPointOnSegment(mouse, p1, p2);
			const dist = VectorUtils.distance(mouse, point);
			if (dist < pixelTolerance && dist < closestDist) {
				closest = point;
				closestDist = dist;
			}
		}

		// Check bottom edge
		const p1 = points[2];
		const p2 = points[3];
		const point = VectorUtils.closestPointOnSegment(mouse, p1, p2);
		const dist = VectorUtils.distance(mouse, point);
		if (dist < pixelTolerance && dist < closestDist) {
			closest = point;
			closestDist = dist;
		}

		// Check arc ends (approximate with distance to center)
		const distToStart = VectorUtils.distance(mouse, this.start);
		const distToEnd = VectorUtils.distance(mouse, this.end);

		if (Math.abs(distToStart - r) < pixelTolerance && Math.abs(distToStart - r) < closestDist) {
			// Point on start arc
			const angle = Math.atan2(mouse.y - this.start.y, mouse.x - this.start.x);
			closest = {
				x: this.start.x + r * Math.cos(angle),
				y: this.start.y + r * Math.sin(angle)
			};
			closestDist = Math.abs(distToStart - r);
		}

		if (Math.abs(distToEnd - r) < pixelTolerance && Math.abs(distToEnd - r) < closestDist) {
			// Point on end arc
			const angle = Math.atan2(mouse.y - this.end.y, mouse.x - this.end.x);
			closest = {
				x: this.end.x + r * Math.cos(angle),
				y: this.end.y + r * Math.sin(angle)
			};
			closestDist = Math.abs(distToEnd - r);
		}

		// Check centerline (start to end)
		const centerPoint = VectorUtils.closestPointOnSegment(mouse, this.start, this.end);
		const centerDist = VectorUtils.distance(mouse, centerPoint);
		if (centerDist < pixelTolerance && centerDist < closestDist) {
			closest = centerPoint;
			closestDist = centerDist;
		}

		if (closest) {
			closest.distance = closestDist;
			return closest;
		}

		return null;
	}

	updateControlPoint(index, newX, newY) {
		switch (index) {
			case 0:
				this.start.x = newX;
				this.start.y = newY;
				break;
			case 1:
				this.end.x = newX;
				this.end.y = newY;
				break;
		}
		this.update();
	}

	translate(dx, dy) {
		this.start.x += dx;
		this.start.y += dy;
		this.end.x += dx;
		this.end.y += dy;
		this.update();
	}

	scale(anchorX, anchorY, factor) {
		const scalePoint = (x, y) => ({
			x: anchorX + (x - anchorX) * factor,
			y: anchorY + (y - anchorY) * factor
		});

		const scaledStart = scalePoint(this.start.x, this.start.y);
		const scaledEnd = scalePoint(this.end.x, this.end.y);

		this.start.x = scaledStart.x;
		this.start.y = scaledStart.y;
		this.end.x = scaledEnd.x;
		this.end.y = scaledEnd.y;
		this.width *= Math.abs(factor);
		this.update();
	}

	rotate(anchorX, anchorY, angleRad) {
		const cos = Math.cos(angleRad);
		const sin = Math.sin(angleRad);

		const rotatePoint = (x, y) => ({
			x: anchorX + (x - anchorX) * cos - (y - anchorY) * sin,
			y: anchorY + (x - anchorX) * sin + (y - anchorY) * cos
		});

		const rotatedStart = rotatePoint(this.start.x, this.start.y);
		const rotatedEnd = rotatePoint(this.end.x, this.end.y);

		this.start.x = rotatedStart.x;
		this.start.y = rotatedStart.y;
		this.end.x = rotatedEnd.x;
		this.end.y = rotatedEnd.y;
		this.update();
	}

	mirror(x1, y1, x2, y2) {
		const mirrorPoint = (px, py) => {
			const dx = x2 - x1;
			const dy = y2 - y1;
			const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
			const closestX = x1 + t * dx;
			const closestY = y1 + t * dy;
			return {
				x: 2 * closestX - px,
				y: 2 * closestY - py
			};
		};

		const mirroredStart = mirrorPoint(this.start.x, this.start.y);
		const mirroredEnd = mirrorPoint(this.end.x, this.end.y);

		this.start.x = mirroredStart.x;
		this.start.y = mirroredStart.y;
		this.end.x = mirroredEnd.x;
		this.end.y = mirroredEnd.y;
		this.update();
	}

	getInspectorSchema() {
		return {
			name: 'Slot',
			sections: [
				{
					title: 'Dimensions',
					fields: [
						{
							key: 'width',
							label: 'Width',
							type: 'length',
							precision: 3,
							step: 1,
							min: 0.1,
							get: () => this.width,
							set: (v) => { this.width = v; this.update(); }
						},
						{
							key: 'length',
							label: 'Length',
							type: 'length',
							precision: 2,
							step: 10,
							min: 0,
							get: () => this.length(),
							set: (v) => { this.scaleToDim(v); }
						},
						{
							key: 'totalLength',
							label: 'Total',
							type: 'readonly-length',
							get: () => this.length() + this.width
						}
					]
				},
				{
					title: 'Start Point',
					fields: [
						{
							key: 'startX',
							label: 'X',
							type: 'length',
							precision: 2,
							step: 1,
							get: () => this.start.x,
							set: (v) => { this.start.x = v; this.update(); }
						},
						{
							key: 'startY',
							label: 'Y',
							type: 'length',
							precision: 2,
							step: 1,
							get: () => this.start.y,
							set: (v) => { this.start.y = v; this.update(); }
						}
					]
				},
				{
					title: 'End Point',
					fields: [
						{
							key: 'endX',
							label: 'X',
							type: 'length',
							precision: 2,
							step: 1,
							get: () => this.end.x,
							set: (v) => { this.end.x = v; this.update(); }
						},
						{
							key: 'endY',
							label: 'Y',
							type: 'length',
							precision: 2,
							step: 1,
							get: () => this.end.y,
							set: (v) => { this.end.y = v; this.update(); }
						}
					]
				},
				{
					title: 'Actions',
					fields: [
						{
							key: 'breakApart',
							label: 'Break Apart',
							type: 'button',
							action: () => {
								undoManager.execute(new BreakApartSlotCommand(this));
							}
						}
					]
				}
			]
		};
	}

	// Create 2 lines and 2 arcs from the slot
	createShapes() {
		const points = this.getOutlinePoints();
		const r = this.width / 2;
		const angle = this.angle();
		const shapes = [];

		// Two straight lines (top and bottom edges)
		const topLine = new Line([points[0].x, points[0].y, points[1].x, points[1].y]);
		topLine.penStyle = this.penStyle;
		topLine.colorToken = this.colorToken;
		shapes.push(topLine);

		const bottomLine = new Line([points[2].x, points[2].y, points[3].x, points[3].y]);
		bottomLine.penStyle = this.penStyle;
		bottomLine.colorToken = this.colorToken;
		shapes.push(bottomLine);

		// Two semicircular arcs at ends
		// Start arc: from start-bottom to start-top (counterclockwise around start)
		const startArc = new Arc([
			this.start.x, this.start.y,  // center
			r,                            // radius
			angle + Math.PI / 2,          // start angle (bottom tangent)
			angle - Math.PI / 2           // end angle (top tangent)
		]);
		startArc.penStyle = this.penStyle;
		startArc.colorToken = this.colorToken;
		shapes.push(startArc);

		// End arc: from end-top to end-bottom (counterclockwise around end)
		const endArc = new Arc([
			this.end.x, this.end.y,       // center
			r,                             // radius
			angle - Math.PI / 2,           // start angle (top tangent)
			angle + Math.PI / 2            // end angle (bottom tangent)
		]);
		endArc.penStyle = this.penStyle;
		endArc.colorToken = this.colorToken;
		shapes.push(endArc);

		return shapes;
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			startX: this.start.x,
			startY: this.start.y,
			endX: this.end.x,
			endY: this.end.y,
			width: this.width,
			penStyle: this.penStyle,
			colorToken: this.colorToken
		};
	}

	static fromJSON(data) {
		const slot = new Slot([
			data.startX,
			data.startY,
			data.endX,
			data.endY,
			data.width
		]);
		slot.type = data.type;
		if (data.penStyle) slot.penStyle = data.penStyle;
		if (data.colorToken) slot.colorToken = data.colorToken;
		return slot;
	}

	draw(ctx, renderer) {
		const r = this.width / 2;

		// Convert centers to screen coords
		const startScreen = renderer.toScreen(this.start.x, this.start.y);
		const endScreen = renderer.toScreen(this.end.x, this.end.y);
		const screenR = renderer.toScreenScale(r);

		// Calculate angle in SCREEN space
		const dx = endScreen.x - startScreen.x;
		const dy = endScreen.y - startScreen.y;
		const screenAngle = Math.atan2(dy, dx);

		// Draw stadium outline: start arc, top line, end arc, bottom line (implicit via closePath)
		ctx.beginPath();

		// Start with the left semicircle (around start point)
		ctx.arc(startScreen.x, startScreen.y, screenR, screenAngle + Math.PI / 2, screenAngle - Math.PI / 2);

		// Right semicircle (around end point) - arc automatically connects with a line
		ctx.arc(endScreen.x, endScreen.y, screenR, screenAngle - Math.PI / 2, screenAngle + Math.PI / 2);

		ctx.closePath();
		ctx.stroke();

		// Draw centerline (dashed green)
		ctx.beginPath();
		ctx.strokeStyle = '#00CC00';
		ctx.setLineDash([12, 3, 3, 3]);
		ctx.lineWidth = 0.5;
		ctx.moveTo(startScreen.x, startScreen.y);
		ctx.lineTo(endScreen.x, endScreen.y);
		ctx.stroke();

		renderer.resetPenStyle(ctx);
	}

	drawHandles(ctx, renderer) {
		const showHandles = this.showControlPoints || (this.selected && this.showHandlesWhenSelected);
		if (!showHandles) return;

		const controlPoints = [this.start, this.end];
		const handleRadius = 4;

		ctx.lineWidth = 0.5;
		ctx.strokeStyle = '#666666';
		ctx.fillStyle = '#FFFFFF';

		for (const pt of controlPoints) {
			const screen = renderer.toScreen(pt.x, pt.y);
			ctx.beginPath();
			ctx.arc(screen.x, screen.y, handleRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
	}
}
