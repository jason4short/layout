import {Shape, Geometry, SnapType} from './Geometry.js';
import {Point} from './Point.js';
import * as VectorUtils from './utils/VectorUtils.js';
import * as TransformUtils from './utils/TransformUtils.js';
import {ellipseSchema} from './InspectorSchemas.js';
import {serializeEllipse, deserializeEllipse} from './GeometrySerializers.js';

export class Ellipse extends Geometry
{
	constructor(params)
	{
		super();
		this.type 			= Shape.PLAIN;
		this.geometry		= Shape.ELLIPSE;

		// params: [x, y, radiusX, radiusY, rotation, cornerAngle, controlMode]
		this.x 				= params[0];
		this.y 				= params[1];
		this.radiusX 		= params[2];  // semi-axis in X direction
		this.radiusY 		= params[3];  // semi-axis in Y direction
		this.rotation 		= params[4] || 0;  // rotation in radians (for future use)
		// cornerAngle remembers which corner the user used to create/resize the ellipse
		// Default to bottom-right quadrant (π/4)
		this.cornerAngle 	= params[5] !== undefined ? params[5] : Math.PI / 4;
		// controlMode: 'center' = center + corner control points
		//              'corners' = two opposite corners as control points
		this.controlMode 	= params[6] || 'center';

		this.updateBoundingBox();
	}

	update(){
		this.updateBoundingBox();
	}

	// Rotate a point around the ellipse center by this.rotation
	_rotatePoint(px, py) {
		if (this.rotation === 0) return { x: px, y: py };
		const cos = Math.cos(this.rotation);
		const sin = Math.sin(this.rotation);
		const dx = px - this.x;
		const dy = py - this.y;
		return {
			x: this.x + dx * cos - dy * sin,
			y: this.y + dx * sin + dy * cos
		};
	}

	// Un-rotate a world point into ellipse-local space
	_unrotatePoint(px, py) {
		if (this.rotation === 0) return { x: px, y: py };
		const cos = Math.cos(-this.rotation);
		const sin = Math.sin(-this.rotation);
		const dx = px - this.x;
		const dy = py - this.y;
		return {
			x: this.x + dx * cos - dy * sin,
			y: this.y + dx * sin + dy * cos
		};
	}

	updateBoundingBox()
	{
		if (this.rotation === 0) {
			this.bounds.x 		= this.x - this.radiusX;
			this.bounds.y 		= this.y - this.radiusY;
			this.bounds.width 	= this.radiusX * 2;
			this.bounds.height 	= this.radiusY * 2;
		} else {
			const cos = Math.cos(this.rotation);
			const sin = Math.sin(this.rotation);
			const halfW = Math.sqrt(this.radiusX * this.radiusX * cos * cos + this.radiusY * this.radiusY * sin * sin);
			const halfH = Math.sqrt(this.radiusX * this.radiusX * sin * sin + this.radiusY * this.radiusY * cos * cos);
			this.bounds.x 		= this.x - halfW;
			this.bounds.y 		= this.y - halfH;
			this.bounds.width 	= halfW * 2;
			this.bounds.height 	= halfH * 2;
		}
	}

	getSnapPOIs() {
		// Control points depend on controlMode:
		// 'center' mode: POI 0 = center, POI 1 = corner
		// 'corners' mode: POI 0 = corner1, POI 1 = opposite corner
		// POI 2-5 = axis endpoints for snapping (right, left, bottom, top)

		const signX = Math.sign(Math.cos(this.cornerAngle)) || 1;
		const signY = Math.sign(Math.sin(this.cornerAngle)) || 1;
		const c1 = this._rotatePoint(this.x + signX * this.radiusX, this.y + signY * this.radiusY);
		const c2 = this._rotatePoint(this.x - signX * this.radiusX, this.y - signY * this.radiusY);
		const qR = this._rotatePoint(this.x + this.radiusX, this.y);
		const qL = this._rotatePoint(this.x - this.radiusX, this.y);
		const qB = this._rotatePoint(this.x, this.y + this.radiusY);
		const qT = this._rotatePoint(this.x, this.y - this.radiusY);

		if (this.controlMode === 'corners') {
			return [
				{ x: c1.x, y: c1.y, type: SnapType.ENDPOINT },
				{ x: c2.x, y: c2.y, type: SnapType.ENDPOINT },
				{ x: qR.x, y: qR.y, type: SnapType.QUADRANT },
				{ x: qL.x, y: qL.y, type: SnapType.QUADRANT },
				{ x: qB.x, y: qB.y, type: SnapType.QUADRANT },
				{ x: qT.x, y: qT.y, type: SnapType.QUADRANT }
			];
		} else {
			// 'center' mode (default)
			return [
				{ x: this.x, y: this.y, type: SnapType.CENTER },
				{ x: c1.x, y: c1.y, type: SnapType.ENDPOINT },
				{ x: qR.x, y: qR.y, type: SnapType.QUADRANT },
				{ x: qL.x, y: qL.y, type: SnapType.QUADRANT },
				{ x: qB.x, y: qB.y, type: SnapType.QUADRANT },
				{ x: qT.x, y: qT.y, type: SnapType.QUADRANT }
			];
		}
	}

	/**
	 * Get control point type for tool behavior.
	 * 'center' mode: POI 0 = center (move), POI 1 = corner (resize)
	 * 'corners' mode: POI 0 & 1 = corners (both resize)
	 */
	getControlPointType(index) {
		if (this.controlMode === 'corners') {
			return (index === 0 || index === 1) ? 'resize' : 'move';
		}
		// 'center' mode
		return index === 1 ? 'resize' : 'move';
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if(!this.bounds.intersects(mouseRect)){
			return null;
		}

		// If the ellipse is degenerate, it can't be snapped
		if(this.radiusX <= 0 || this.radiusY <= 0){
			return null;
		}

		// Un-rotate mouse into ellipse-local space
		const local = this._unrotatePoint(mouse.x, mouse.y);

		const dx = local.x - this.x;
		const dy = local.y - this.y;

		// Normalize to unit circle
		const nx = dx / this.radiusX;
		const ny = dy / this.radiusY;

		const dist = Math.sqrt(nx * nx + ny * ny);

		if(dist === 0){
			return null;
		}

		// Point on unit circle
		const ux = nx / dist;
		const uy = ny / dist;

		// Transform back to ellipse (local space), then rotate to world
		const localPx = this.x + ux * this.radiusX;
		const localPy = this.y + uy * this.radiusY;
		const world = this._rotatePoint(localPx, localPy);

		const point = new Point(world.x, world.y);
		point.distance = VectorUtils.distance(mouse, point);

		if(point.distance > pixelTolerance){
			return null;
		}

		return point;
	}

	// Approximate perimeter using Ramanujan's approximation
	length() {
		const a = this.radiusX;
		const b = this.radiusY;
		const h = ((a - b) * (a - b)) / ((a + b) * (a + b));
		return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
	}

	// Check if a point is inside the ellipse
	containsPoint(px, py) {
		const local = this._unrotatePoint(px, py);
		const dx = local.x - this.x;
		const dy = local.y - this.y;
		return (dx * dx) / (this.radiusX * this.radiusX) +
		       (dy * dy) / (this.radiusY * this.radiusY) <= 1;
	}

	clone() {
		let e = new Ellipse([this.x, this.y, this.radiusX, this.radiusY, this.rotation, this.cornerAngle, this.controlMode]);
		e.type = this.type;
		e.groupId = this.groupId;
		e.penStyle = this.penStyle;
		e.colorToken = this.colorToken;
		return e;
	}

	// Get tangent angle (in degrees) at a point on the ellipse
	getTangentAngle(point) {
		// Work in ellipse-local (un-rotated) space
		const local = this._unrotatePoint(point.x, point.y);
		const dx = local.x - this.x;
		const dy = local.y - this.y;

		const a2 = this.radiusX * this.radiusX;
		const b2 = this.radiusY * this.radiusY;

		// Avoid division by zero
		if (Math.abs(dy) < 0.0001) {
			return this.rotation * (180 / Math.PI);
		}

		const slope = -(b2 * dx) / (a2 * dy);
		const tangentAngle = Math.atan2(-slope, 1);
		// Add ellipse rotation to the local tangent angle
		return (tangentAngle + this.rotation) * (180 / Math.PI);
	}

	// Translate the ellipse by offset
	translate(dx, dy){
		this.x += dx;
		this.y += dy;
		this.update();
	}

	// Scale the ellipse relative to an anchor point
	scale(anchorX, anchorY, factor){
		const scaled = TransformUtils.scalePoint(this.x, this.y, anchorX, anchorY, factor);
		this.x = scaled.x;
		this.y = scaled.y;
		this.radiusX = this.radiusX * Math.abs(factor);
		this.radiusY = this.radiusY * Math.abs(factor);
		this.update();
	}

	// Rotate the ellipse around an anchor point by angle (in radians)
	rotate(anchorX, anchorY, angleRad) {
		const rotated = TransformUtils.rotatePoint(this.x, this.y, anchorX, anchorY, angleRad);
		this.x = rotated.x;
		this.y = rotated.y;
		// Rotate the ellipse's own rotation
		this.rotation += angleRad;
		this.update();
	}

	// Mirror the ellipse across a line defined by two points
	mirror(x1, y1, x2, y2){
		// Mirror center
		const mirrored = TransformUtils.mirrorPoint(this.x, this.y, x1, y1, x2, y2);
		this.x = mirrored.x;
		this.y = mirrored.y;

		// Reflect rotation across mirror line angle
		const lineAngle = TransformUtils.getMirrorLineAngle(x1, y1, x2, y2);
		this.rotation = TransformUtils.mirrorAngle(this.rotation, lineAngle);

		this.update();
	}

	getInspectorSchema() {
		return ellipseSchema(this);
	}

	// Update a specific control point by index
	// POI indices depend on controlMode:
	// 'center' mode: 0=center, 1=corner, 2-5=axis points
	// 'corners' mode: 0=corner1, 1=corner2, 2-5=axis points
	updateControlPoint(index, newX, newY){
		if (this.controlMode === 'corners') {
			// Un-rotate the dragged point into ellipse-local space
			const local = this._unrotatePoint(newX, newY);
			const signX = Math.sign(Math.cos(this.cornerAngle)) || 1;
			const signY = Math.sign(Math.sin(this.cornerAngle)) || 1;

			if (index === 0) {
				// Dragging corner1 - corner2 (opposite) stays fixed (in local space)
				const corner2X = this.x - signX * this.radiusX;
				const corner2Y = this.y - signY * this.radiusY;
				this.x = (local.x + corner2X) / 2;
				this.y = (local.y + corner2Y) / 2;
				this.radiusX = Math.abs(local.x - corner2X) / 2;
				this.radiusY = Math.abs(local.y - corner2Y) / 2;
				this.cornerAngle = Math.atan2(local.y - this.y, local.x - this.x);
			} else if (index === 1) {
				// Dragging corner2 - corner1 stays fixed
				const corner1X = this.x + signX * this.radiusX;
				const corner1Y = this.y + signY * this.radiusY;
				this.x = (corner1X + local.x) / 2;
				this.y = (corner1Y + local.y) / 2;
				this.radiusX = Math.abs(corner1X - local.x) / 2;
				this.radiusY = Math.abs(corner1Y - local.y) / 2;
				this.cornerAngle = Math.atan2(corner1Y - this.y, corner1X - this.x);
			} else {
				this.updateAxisPoint(index, newX, newY);
			}
		} else {
			// 'center' mode (default)
			switch(index){
				case 0: // center - move the ellipse (world coords)
					this.x = newX;
					this.y = newY;
					break;
				case 1: { // corner - un-rotate to get local radii
					const local = this._unrotatePoint(newX, newY);
					this.radiusX = Math.abs(local.x - this.x);
					this.radiusY = Math.abs(local.y - this.y);
					this.cornerAngle = Math.atan2(local.y - this.y, local.x - this.x);
					break;
				}
				default:
					this.updateAxisPoint(index, newX, newY);
					break;
			}
		}
		this.update();
	}

	// Helper to update axis control points (indices 2-5)
	updateAxisPoint(index, newX, newY) {
		const local = this._unrotatePoint(newX, newY);
		switch(index){
			case 2: // right
			case 3: // left
				this.radiusX = Math.abs(local.x - this.x);
				break;
			case 4: // bottom
			case 5: // top
				this.radiusY = Math.abs(local.y - this.y);
				break;
		}
	}

	toJSON() {
		return serializeEllipse(this);
	}

	static fromJSON(data) {
		return deserializeEllipse(data, Ellipse);
	}

	draw(ctx, renderer) {
		const center = renderer.toScreen(this.x, this.y);
		const radiusX = renderer.toScreenScale(this.radiusX);
		const radiusY = renderer.toScreenScale(this.radiusY);

		ctx.ellipse(center.x, center.y, radiusX, radiusY, this.rotation, 0, Math.PI * 2);
		ctx.stroke();
		renderer.resetPenStyle(ctx);
	}
}
