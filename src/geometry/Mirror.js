import { Shape, Geometry, SnapType, PenStyle } from './Geometry.js';
import { Point } from './Point.js';
import { Rectangle } from './Rectangle.js';
import * as TransformUtils from './utils/TransformUtils.js';
import data from '../data/Data.js';

/**
 * Mirror - A parametric mirror that reflects geometry across an axis line.
 *
 * The mirror axis is the primary geometry (like a line). The capture zone
 * extends perpendicular to the axis by a specified width. Geometry inside
 * the capture zone is automatically mirrored across the axis.
 *
 * The mirror can be "broken" to convert symbolic mirrored geometry into
 * real independent shapes.
 */
export class Mirror extends Geometry {
	constructor(params) {
		super();
		this.type = Shape.PLAIN;
		this.geometry = Shape.MIRROR;

		// params: [x1, y1, x2, y2, width]
		// The axis line from (x1,y1) to (x2,y2)
		// Width is how far the capture zone extends from the axis
		this.start = new Point(params[0] || 0, params[1] || 0);
		this.end = new Point(params[2] || 0, params[3] || 100);
		this.width = params[4] || 50;  // Capture zone width

		// Cache for captured shape IDs
		this.capturedShapeIds = new Set();

		this.update();
	}

	/**
	 * Get the axis line endpoints.
	 */
	getAxisLine() {
		return {
			x1: this.start.x,
			y1: this.start.y,
			x2: this.end.x,
			y2: this.end.y
		};
	}

	/**
	 * Get the perpendicular direction (pointing into capture zone).
	 * Returns unit vector pointing "left" of the axis direction.
	 */
	getCaptureDirection() {
		const dx = this.end.x - this.start.x;
		const dy = this.end.y - this.start.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len < 1e-10) return { x: -1, y: 0 };
		// Perpendicular (rotate 90° CCW) = (-dy, dx) normalized
		return { x: -dy / len, y: dx / len };
	}

	/**
	 * Get the 4 corners of the capture zone rectangle.
	 */
	getCaptureCorners() {
		const dir = this.getCaptureDirection();
		const offsetX = dir.x * this.width;
		const offsetY = dir.y * this.width;

		return [
			{ x: this.start.x, y: this.start.y },                    // axis start
			{ x: this.end.x, y: this.end.y },                        // axis end
			{ x: this.end.x + offsetX, y: this.end.y + offsetY },    // far end
			{ x: this.start.x + offsetX, y: this.start.y + offsetY } // far start
		];
	}

	/**
	 * Check if a point is inside the capture zone.
	 */
	isPointInCaptureZone(px, py) {
		const corners = this.getCaptureCorners();
		// Use winding number or cross product test for convex quad
		return this.pointInQuad(px, py, corners);
	}

	/**
	 * Point-in-quadrilateral test (convex).
	 */
	pointInQuad(px, py, corners) {
		// Check if point is on same side of all edges
		let sign = 0;
		for (let i = 0; i < 4; i++) {
			const c1 = corners[i];
			const c2 = corners[(i + 1) % 4];
			const cross = (c2.x - c1.x) * (py - c1.y) - (c2.y - c1.y) * (px - c1.x);
			if (Math.abs(cross) < 1e-10) continue;
			const s = cross > 0 ? 1 : -1;
			if (sign === 0) sign = s;
			else if (sign !== s) return false;
		}
		return true;
	}

	/**
	 * Check if a shape is inside the capture zone.
	 */
	isShapeInCaptureZone(shape) {
		if (!shape || !shape.bounds) return false;
		// Check if shape's center is inside
		const cx = shape.bounds.x + shape.bounds.width / 2;
		const cy = shape.bounds.y + shape.bounds.height / 2;
		return this.isPointInCaptureZone(cx, cy);
	}

	/**
	 * Find all shapes currently in the capture zone.
	 */
	findCapturedShapes() {
		const allShapes = data.getShapes();
		const captured = [];

		for (const shape of allShapes) {
			if (shape === this) continue;
			if (shape.geometry === Shape.MIRROR) continue;
			if (this.isShapeInCaptureZone(shape)) {
				captured.push(shape);
			}
		}

		return captured;
	}

	/**
	 * Update the list of captured shape IDs.
	 */
	updateCapturedShapes() {
		this.capturedShapeIds.clear();
		const captured = this.findCapturedShapes();
		for (const shape of captured) {
			if (shape.id) {
				this.capturedShapeIds.add(shape.id);
			}
		}
	}

	/**
	 * Get captured shapes by their stored IDs.
	 */
	getCapturedShapes() {
		const shapes = [];
		for (const id of this.capturedShapeIds) {
			const shape = data.getShapeById(id);
			if (shape) {
				shapes.push(shape);
			}
		}
		return shapes;
	}

	/**
	 * Mirror a point across the axis.
	 */
	mirrorPoint(px, py) {
		return TransformUtils.mirrorPoint(px, py, this.start.x, this.start.y, this.end.x, this.end.y);
	}

	/**
	 * Update bounds and POIs.
	 */
	update() {
		this.updateCapturedShapes();

		// POIs for control point editing
		// Index 0 = axis start, 1 = axis end, 2 = width handle
		const dir = this.getCaptureDirection();
		const widthHandleX = (this.start.x + this.end.x) / 2 + dir.x * this.width;
		const widthHandleY = (this.start.y + this.end.y) / 2 + dir.y * this.width;

		this.POIs = [
			{ x: this.start.x, y: this.start.y, type: SnapType.ENDPOINT },
			{ x: this.end.x, y: this.end.y, type: SnapType.ENDPOINT },
			{ x: widthHandleX, y: widthHandleY, type: SnapType.ON }
		];

		// Bounds encompass capture zone + mirrored zone
		const corners = this.getCaptureCorners();
		const mirroredCorners = corners.map(c => this.mirrorPoint(c.x, c.y));
		const allCorners = [...corners, ...mirroredCorners];

		let minX = Infinity, minY = Infinity;
		let maxX = -Infinity, maxY = -Infinity;

		for (const c of allCorners) {
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

	/**
	 * Clone the mirror.
	 */
	clone() {
		const m = new Mirror([
			this.start.x, this.start.y,
			this.end.x, this.end.y,
			this.width
		]);
		m.penStyle = this.penStyle;
		m.colorToken = this.colorToken;
		m.capturedShapeIds = new Set(this.capturedShapeIds);
		return m;
	}

	copyFrom(other) {
		this.start.x = other.start.x;
		this.start.y = other.start.y;
		this.end.x = other.end.x;
		this.end.y = other.end.y;
		this.width = other.width;
		this.capturedShapeIds = new Set(other.capturedShapeIds);
		this.update();
	}

	/**
	 * Get the length of the mirror axis.
	 */
	length() {
		const dx = this.end.x - this.start.x;
		const dy = this.end.y - this.start.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	/**
	 * Draw the mirror.
	 */
	draw(ctx, renderer) {
		// Always refresh captured shapes on render
		this.updateCapturedShapes();

		const corners = this.getCaptureCorners();
		// Mirror surface is on the opposite side - where reflected geometry appears
		const mirrorSurfaceCorners = corners.map(c => this.mirrorPoint(c.x, c.y));

		// Convert to screen coords
		const screenMirrorCorners = mirrorSurfaceCorners.map(c => renderer.toScreen(c.x, c.y));
		const axisStart = renderer.toScreen(this.start.x, this.start.y);
		const axisEnd = renderer.toScreen(this.end.x, this.end.y);

		// Draw mirror surface fill (where virtual/reflected geometry appears)
		ctx.fillStyle = this.selected ? 'rgba(0, 120, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)';
		ctx.beginPath();
		ctx.moveTo(screenMirrorCorners[0].x, screenMirrorCorners[0].y);
		for (let i = 1; i < screenMirrorCorners.length; i++) {
			ctx.lineTo(screenMirrorCorners[i].x, screenMirrorCorners[i].y);
		}
		ctx.closePath();
		ctx.fill();

		// Draw mirror surface border (dashed, subtle)
		ctx.strokeStyle = this.selected ? 'rgba(0, 120, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)';
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 4]);
		ctx.stroke();
		ctx.setLineDash([]);

		// Draw mirror axis (prominent green dashed line)
		ctx.strokeStyle = '#22AA22';
		ctx.lineWidth = this.selected ? 2.5 : 2;
		ctx.setLineDash([6, 4]);
		ctx.beginPath();
		ctx.moveTo(axisStart.x, axisStart.y);
		ctx.lineTo(axisEnd.x, axisEnd.y);
		ctx.stroke();
		ctx.setLineDash([]);

		// Draw mirrored shapes
		const mirroredShapes = this.getShapesForRender();
		for (const shape of mirroredShapes) {
			ctx.beginPath();  // Ensure clean path state for each shape
			renderer.applyPenStyle(ctx, shape);  // Apply the shape's pen style
			shape.draw(ctx, renderer);
		}
	}

	/**
	 * Draw control handles.
	 */
	drawHandles(ctx, renderer) {
		if (!this.selected && !this.showControlPoints) return;

		const handleRadius = 5;

		// Axis endpoints (green)
		ctx.lineWidth = 1;
		ctx.strokeStyle = '#22AA22';
		ctx.fillStyle = '#FFFFFF';

		const pts = [
			renderer.toScreen(this.start.x, this.start.y),
			renderer.toScreen(this.end.x, this.end.y)
		];

		for (const pt of pts) {
			ctx.beginPath();
			ctx.arc(pt.x, pt.y, handleRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}

		// Width handle (at midpoint, offset by width)
		const dir = this.getCaptureDirection();
		const midX = (this.start.x + this.end.x) / 2 + dir.x * this.width;
		const midY = (this.start.y + this.end.y) / 2 + dir.y * this.width;
		const widthPt = renderer.toScreen(midX, midY);

		ctx.strokeStyle = '#0078FF';
		ctx.beginPath();
		ctx.arc(widthPt.x, widthPt.y, handleRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
	}

	/**
	 * Get snap points.
	 */
	getSnapPOIs() {
		const pois = [];

		// Axis endpoints
		pois.push({ x: this.start.x, y: this.start.y, type: SnapType.ENDPOINT, shape: this });
		pois.push({ x: this.end.x, y: this.end.y, type: SnapType.ENDPOINT, shape: this });

		// Axis midpoint
		pois.push({
			x: (this.start.x + this.end.x) / 2,
			y: (this.start.y + this.end.y) / 2,
			type: SnapType.MIDPOINT,
			shape: this
		});

		// Mirrored POIs from captured shapes
		const capturedShapes = this.getCapturedShapes();
		for (const shape of capturedShapes) {
			const shapePOIs = shape.getSnapPOIs();
			for (const poi of shapePOIs) {
				const mirrored = this.mirrorPoint(poi.x, poi.y);
				pois.push({
					x: mirrored.x,
					y: mirrored.y,
					type: SnapType.MIRRORED,
					shape: this
				});
			}
		}

		return pois;
	}

	/**
	 * Closest point on a line segment.
	 */
	closestPointOnSegment(point, segStart, segEnd) {
		const dx = segEnd.x - segStart.x;
		const dy = segEnd.y - segStart.y;
		const lenSq = dx * dx + dy * dy;

		if (lenSq < 1e-10) {
			return { x: segStart.x, y: segStart.y };
		}

		// Project point onto line, clamped to segment
		let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
		t = Math.max(0, Math.min(1, t));

		return {
			x: segStart.x + t * dx,
			y: segStart.y + t * dy
		};
	}

	/**
	 * Get geometric snap (only on axis line - capture zone fill is not selectable).
	 */
	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		// Only check the axis line for selection - not the fill area
		const axisSnap = this.closestPointOnSegment(mouse, this.start, this.end);
		if (!axisSnap) return null;

		const dist = Math.sqrt((mouse.x - axisSnap.x) ** 2 + (mouse.y - axisSnap.y) ** 2);

		// Must be within pixel tolerance of the axis line
		if (dist > pixelTolerance) return null;

		return { x: axisSnap.x, y: axisSnap.y, distance: dist, shape: this };
	}

	/**
	 * Get mirrored shapes for rendering.
	 */
	getShapesForRender() {
		const shapes = [];
		const capturedShapes = this.getCapturedShapes();

		for (const srcShape of capturedShapes) {
			const shape = srcShape.clone();
			shape.mirror(this.start.x, this.start.y, this.end.x, this.end.y);
			shape._mirrorRef = this;
			shape.selected = this.selected;
			shapes.push(shape);
		}

		return shapes;
	}

	/**
	 * Break the mirror - convert mirrored shapes to real geometry.
	 */
	explode() {
		const shapes = [];
		const capturedShapes = this.getCapturedShapes();

		for (const srcShape of capturedShapes) {
			const shape = srcShape.clone();
			shape.mirror(this.start.x, this.start.y, this.end.x, this.end.y);
			shape.groupId = null;
			shapes.push(shape);
		}

		return shapes;
	}

	/**
	 * Get transformable points.
	 */
	getTransformablePoints() {
		return [this.start, this.end];
	}

	/**
	 * Move the mirror.
	 */
	translate(dx, dy) {
		this.start.x += dx;
		this.start.y += dy;
		this.end.x += dx;
		this.end.y += dy;
		this.update();
	}

	/**
	 * Update control point.
	 * Index 0 = axis start, 1 = axis end, 2 = width handle
	 */
	updateControlPoint(index, newX, newY) {
		if (index === 0) {
			this.start.x = newX;
			this.start.y = newY;
		} else if (index === 1) {
			this.end.x = newX;
			this.end.y = newY;
		} else if (index === 2) {
			// Width handle - calculate new width from distance to axis
			const axis = this.getAxisLine();
			const dx = axis.x2 - axis.x1;
			const dy = axis.y2 - axis.y1;
			const lenSq = dx * dx + dy * dy;
			if (lenSq > 1e-10) {
				// Project point onto axis line
				const t = ((newX - axis.x1) * dx + (newY - axis.y1) * dy) / lenSq;
				const projX = axis.x1 + t * dx;
				const projY = axis.y1 + t * dy;
				// Distance from projection to new point
				const dist = Math.sqrt((newX - projX) ** 2 + (newY - projY) ** 2);
				this.width = Math.max(10, dist);
			}
		}
		this.update();
	}

	getControlPointType(index) {
		if (index === 2) return 'resize';
		return 'move';
	}

	/**
	 * Serialize.
	 */
	toJSON() {
		return {
			geometry: this.geometry,
			startX: this.start.x,
			startY: this.start.y,
			endX: this.end.x,
			endY: this.end.y,
			width: this.width,
			capturedShapeIds: Array.from(this.capturedShapeIds),
			penStyle: this.penStyle,
			colorToken: this.colorToken
		};
	}

	/**
	 * Deserialize.
	 */
	static fromJSON(json) {
		const m = new Mirror([
			json.startX,
			json.startY,
			json.endX,
			json.endY,
			json.width
		]);
		m.penStyle = json.penStyle;
		m.colorToken = json.colorToken;
		if (json.capturedShapeIds) {
			m.capturedShapeIds = new Set(json.capturedShapeIds);
		}
		return m;
	}

	getInspectorSchema() {
		return {
			name: 'Mirror',
			sections: [
				{
					title: 'Axis Start',
					fields: [
						{ key: 'start.x', label: 'X', type: 'number', precision: 2, step: 1 },
						{ key: 'start.y', label: 'Y', type: 'number', precision: 2, step: 1 }
					]
				},
				{
					title: 'Axis End',
					fields: [
						{ key: 'end.x', label: 'X', type: 'number', precision: 2, step: 1 },
						{ key: 'end.y', label: 'Y', type: 'number', precision: 2, step: 1 }
					]
				},
				{
					title: 'Capture Zone',
					fields: [
						{ key: 'width', label: 'Width', type: 'number', precision: 2, step: 1, min: 10 }
					]
				},
				{
					title: 'Actions',
					fields: [
						{
							key: 'capturedCount',
							label: 'Captured',
							type: 'readonly',
							get: () => `${this.capturedShapeIds.size} shapes`
						},
						{
							key: 'refresh',
							label: 'Refresh Capture',
							type: 'button',
							action: (mirror) => {
								mirror.updateCapturedShapes();
								const stage = require('../core/Stage.js').default;
								stage.render();
							}
						},
						{
							key: 'explode',
							label: 'Break Mirror',
							type: 'button',
							action: (mirror) => {
								const { BreakMirrorCommand } = require('../core/Commands.js');
								const undoManager = require('../core/UndoManager.js').default;
								const stage = require('../core/Stage.js').default;
								undoManager.execute(new BreakMirrorCommand(mirror));
								stage.render();
							}
						}
					]
				}
			]
		};
	}
}
