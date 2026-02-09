import { Shape, Geometry, SnapType } from './Geometry.js';
import { Point } from './Point.js';
import { Line } from './Line.js';
import * as VectorUtils from './utils/VectorUtils.js';
import { boardSchema } from './InspectorSchemas.js';
import { serializeBoard, deserializeBoard } from './GeometrySerializers.js';

/**
 * Board - A parametric lumber/sheet good representation.
 *
 * Defined by a reference line (start to end) with thickness extruded perpendicular.
 * Works just like a Line but with width.
 *
 * Alignment options:
 * - 'top': reference line is along the top edge
 * - 'center': reference line is the centerline (default)
 * - 'bottom': reference line is along the bottom edge
 *
 * POIs: 0=start, 1=end, 2=mid (same as Line)
 */

// Common lumber presets: { name, thickness (in mm) }
// Thickness is the dimension you see in top-down view
export const BOARD_PRESETS = [
	{ name: '3/4" Plywood', thickness: 19.05 },      // 0.75"
	{ name: '1/2" Plywood', thickness: 12.7 },       // 0.5"
	{ name: '1/4" Plywood', thickness: 6.35 },       // 0.25"
	{ name: '2x4', thickness: 38.1 },                // 1.5" (actual)
	{ name: '2x6', thickness: 38.1 },                // 1.5" (actual)
	{ name: '2x8', thickness: 38.1 },                // 1.5" (actual)
	{ name: '1x4', thickness: 19.05 },               // 0.75" (actual)
	{ name: '1x6', thickness: 19.05 },               // 0.75" (actual)
	{ name: '1x2', thickness: 19.05 },               // 0.75" (actual)
	{ name: 'Custom', thickness: 19.05 }             // Default to 3/4"
];

export class Board extends Geometry {
	constructor(params) {
		super();
		this.type = Shape.PLAIN;
		this.geometry = Shape.BOARD;
		this.showHandlesWhenSelected = true;  // Primitives show control points when selected

		// params: [startX, startY, endX, endY, thickness, presetName, alignment]
		this.start = new Point(params[0] || 0, params[1] || 0);
		this.end = new Point(params[2] || 100, params[3] || 0);
		this.mid = new Point();
		this.thickness = params[4] || 19.05;  // Default 3/4" in mm

		// Preset name for display (optional)
		this.presetName = params[5] || 'Custom';

		// Edge alignment: 'top', 'center', or 'bottom'
		// Determines which edge the start/end points lie on
		this.alignment = params[6] || 'top';

		this.update();
	}

	update() {
		// Update midpoint
		this.mid.x = (this.start.x + this.end.x) / 2;
		this.mid.y = (this.start.y + this.end.y) / 2;

		// Calculate bounds from corners
		const corners = this.getCorners();

		let minX = Infinity, minY = Infinity;
		let maxX = -Infinity, maxY = -Infinity;

		for (const c of corners) {
			minX = Math.min(minX, c.x);
			minY = Math.min(minY, c.y);
			maxX = Math.max(maxX, c.x);
			maxY = Math.max(maxY, c.y);
		}

		this.bounds.x = minX;
		this.bounds.y = minY;
		this.bounds.width = maxX - minX;
		this.bounds.height = maxY - minY;
	}

	// Get length of the centerline
	length() {
		return VectorUtils.distance(this.start, this.end);
	}

	// Get angle of the centerline in radians
	angle() {
		return Math.atan2(this.end.y - this.start.y, this.end.x - this.start.x);
	}

	// Scale to a specific length (like Line.scaleToDim)
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

	// Get the 4 corners of the board in world coords
	getCorners() {
		const angle = this.angle();
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);

		// Perpendicular unit vector (rotate 90 degrees CCW)
		const perpUnitX = -sin;
		const perpUnitY = cos;

		// Calculate offsets based on alignment
		// 'top' = reference line is top edge, extrude downward (positive perp)
		// 'center' = reference line is center, extrude both ways
		// 'bottom' = reference line is bottom edge, extrude upward (negative perp)
		let topOffset, bottomOffset;
		switch (this.alignment) {
			case 'top':
				topOffset = 0;
				bottomOffset = this.thickness;
				break;
			case 'bottom':
				topOffset = -this.thickness;
				bottomOffset = 0;
				break;
			case 'center':
			default:
				topOffset = -this.thickness / 2;
				bottomOffset = this.thickness / 2;
				break;
		}

		// Four corners
		return [
			{ x: this.start.x + perpUnitX * topOffset, y: this.start.y + perpUnitY * topOffset },     // start top
			{ x: this.end.x + perpUnitX * topOffset, y: this.end.y + perpUnitY * topOffset },         // end top
			{ x: this.end.x + perpUnitX * bottomOffset, y: this.end.y + perpUnitY * bottomOffset },   // end bottom
			{ x: this.start.x + perpUnitX * bottomOffset, y: this.start.y + perpUnitY * bottomOffset } // start bottom
		];
	}

	clone() {
		const b = new Board([
			this.start.x, this.start.y,
			this.end.x, this.end.y,
			this.thickness,
			this.presetName,
			this.alignment
		]);
		b.type = this.type;
		b.groupId = this.groupId;
		b.penStyle = this.penStyle;
		b.colorToken = this.colorToken;
		return b;
	}

	copyFrom(other) {
		this.start.x = other.start.x;
		this.start.y = other.start.y;
		this.end.x = other.end.x;
		this.end.y = other.end.y;
		this.thickness = other.thickness;
		this.presetName = other.presetName;
		this.alignment = other.alignment;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.update();
	}

	// POIs:
	// 0-1: control points (start, end) - for selection/editing
	// 2-5: corners - for DA snapping
	// 6-9: edge midpoints - for DA snapping
	getSnapPOIs() {
		const corners = this.getCorners();

		// Edge midpoints
		const edgeMids = [
			{ x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 },
			{ x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 },
			{ x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 },
			{ x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 }
		];

		return [
			{ x: this.start.x, y: this.start.y, type: SnapType.ENDPOINT },   // 0: control point
			{ x: this.end.x, y: this.end.y, type: SnapType.ENDPOINT },       // 1: control point
			{ x: corners[0].x, y: corners[0].y, type: SnapType.ENDPOINT },   // 2: start-top corner
			{ x: corners[1].x, y: corners[1].y, type: SnapType.ENDPOINT },   // 3: end-top corner
			{ x: corners[2].x, y: corners[2].y, type: SnapType.ENDPOINT },   // 4: end-bottom corner
			{ x: corners[3].x, y: corners[3].y, type: SnapType.ENDPOINT },   // 5: start-bottom corner
			{ x: edgeMids[0].x, y: edgeMids[0].y, type: SnapType.MIDPOINT }, // 6: top edge midpoint
			{ x: edgeMids[1].x, y: edgeMids[1].y, type: SnapType.MIDPOINT }, // 7: end edge midpoint
			{ x: edgeMids[2].x, y: edgeMids[2].y, type: SnapType.MIDPOINT }, // 8: bottom edge midpoint
			{ x: edgeMids[3].x, y: edgeMids[3].y, type: SnapType.MIDPOINT }  // 9: start edge midpoint
		];
	}

	getTransformablePoints() {
		return [this.start, this.end];
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		// Quick reject
		if (mouseRect && !this.bounds.intersects(mouseRect)) {
			return null;
		}

		const corners = this.getCorners();

		// Check each edge
		let closest = null;
		let closestDist = Infinity;

		for (let i = 0; i < 4; i++) {
			const p1 = corners[i];
			const p2 = corners[(i + 1) % 4];

			const point = VectorUtils.closestPointOnSegment(mouse, p1, p2);
			const dist = VectorUtils.distance(mouse, point);

			if (dist < pixelTolerance && dist < closestDist) {
				closest = point;
				closestDist = dist;
			}
		}

		if (closest) {
			closest.distance = closestDist;
			return closest;
		}

		return null;
	}

	// Update a specific control point by index
	// POI indices: 0=start, 1=end
	updateControlPoint(index, newX, newY) {
		switch (index) {
			case 0: // start
				this.start.x = newX;
				this.start.y = newY;
				break;
			case 1: // end
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
		const scaledStart = VectorUtils.scalePoint
			? VectorUtils.scalePoint(this.start.x, this.start.y, anchorX, anchorY, factor)
			: {
				x: anchorX + (this.start.x - anchorX) * factor,
				y: anchorY + (this.start.y - anchorY) * factor
			};
		const scaledEnd = {
			x: anchorX + (this.end.x - anchorX) * factor,
			y: anchorY + (this.end.y - anchorY) * factor
		};

		this.start.x = scaledStart.x;
		this.start.y = scaledStart.y;
		this.end.x = scaledEnd.x;
		this.end.y = scaledEnd.y;
		this.thickness *= Math.abs(factor);
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

		// Flip edge alignment: top <-> bottom
		if (this.alignment === 'top') {
			this.alignment = 'bottom';
		} else if (this.alignment === 'bottom') {
			this.alignment = 'top';
		}
		// 'center' stays center

		this.update();
	}

	getInspectorSchema() {
		return boardSchema(this, BOARD_PRESETS);
	}

	// Create 4 lines from the board edges
	createLines() {
		const corners = this.getCorners();
		const lines = [];

		for (let i = 0; i < 4; i++) {
			const c1 = corners[i];
			const c2 = corners[(i + 1) % 4];
			const line = new Line([c1.x, c1.y, c2.x, c2.y]);
			line.penStyle = this.penStyle;
			line.colorToken = this.colorToken;
			lines.push(line);
		}

		return lines;
	}

	/**
	 * Returns edge lines for intersection calculations.
	 */
	getIntersectionPrimitives() {
		return this.createLines();
	}

	// For BreakApartCommand
	breakApart() {
		return this.createLines();
	}

	toJSON() {
		return serializeBoard(this);
	}

	static fromJSON(data) {
		return deserializeBoard(data, Board, 'top');
	}

	draw(ctx, renderer) {
		const corners = this.getCorners();

		// Convert to screen coords
		const screen = corners.map(c => renderer.toScreen(c.x, c.y));

		// Draw outline
		ctx.beginPath();
		ctx.moveTo(screen[0].x, screen[0].y);
		for (let i = 1; i < 4; i++) {
			ctx.lineTo(screen[i].x, screen[i].y);
		}
		ctx.closePath();
		ctx.stroke();

		renderer.resetPenStyle(ctx);
	}

	drawHandles(ctx, renderer) {
		const showHandles = this.showControlPoints || (this.selected && this.showHandlesWhenSelected);
		if (!showHandles) return;

		// Draw handles at start and end control points only
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
