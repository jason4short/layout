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

	updateBoundingBox()
	{
		// For axis-aligned ellipse (rotation = 0)
		this.bounds.x 		= this.x - this.radiusX;
		this.bounds.y 		= this.y - this.radiusY;
		this.bounds.width 	= this.radiusX * 2;
		this.bounds.height 	= this.radiusY * 2;
	}

	getSnapPOIs() {
		// Control points depend on controlMode:
		// 'center' mode: POI 0 = center, POI 1 = corner
		// 'corners' mode: POI 0 = corner1, POI 1 = opposite corner
		// POI 2-5 = axis endpoints for snapping (right, left, bottom, top)

		const signX = Math.sign(Math.cos(this.cornerAngle)) || 1;
		const signY = Math.sign(Math.sin(this.cornerAngle)) || 1;
		const corner1X = this.x + signX * this.radiusX;
		const corner1Y = this.y + signY * this.radiusY;
		const corner2X = this.x - signX * this.radiusX;
		const corner2Y = this.y - signY * this.radiusY;

		if (this.controlMode === 'corners') {
			return [
				{ x: corner1X, y: corner1Y, type: SnapType.ENDPOINT },
				{ x: corner2X, y: corner2Y, type: SnapType.ENDPOINT },
				{ x: this.x + this.radiusX, y: this.y, type: SnapType.QUADRANT },
				{ x: this.x - this.radiusX, y: this.y, type: SnapType.QUADRANT },
				{ x: this.x, y: this.y + this.radiusY, type: SnapType.QUADRANT },
				{ x: this.x, y: this.y - this.radiusY, type: SnapType.QUADRANT }
			];
		} else {
			// 'center' mode (default)
			return [
				{ x: this.x, y: this.y, type: SnapType.CENTER },
				{ x: corner1X, y: corner1Y, type: SnapType.ENDPOINT },
				{ x: this.x + this.radiusX, y: this.y, type: SnapType.QUADRANT },
				{ x: this.x - this.radiusX, y: this.y, type: SnapType.QUADRANT },
				{ x: this.x, y: this.y + this.radiusY, type: SnapType.QUADRANT },
				{ x: this.x, y: this.y - this.radiusY, type: SnapType.QUADRANT }
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

		// For axis-aligned ellipse, find closest point on perimeter
		// Transform mouse to unit circle space, find closest, transform back
		const dx = mouse.x - this.x;
		const dy = mouse.y - this.y;

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

		// Transform back to ellipse
		const px = this.x + ux * this.radiusX;
		const py = this.y + uy * this.radiusY;

		const point = new Point(px, py);
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
		const dx = px - this.x;
		const dy = py - this.y;
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
		const dx = point.x - this.x;
		const dy = point.y - this.y;

		// For axis-aligned ellipse, tangent slope = -b²x / (a²y)
		// where a = radiusX, b = radiusY
		const a2 = this.radiusX * this.radiusX;
		const b2 = this.radiusY * this.radiusY;

		// Avoid division by zero
		if (Math.abs(dy) < 0.0001) {
			// At top/bottom of ellipse, tangent is horizontal
			return 0;
		}

		const slope = -(b2 * dx) / (a2 * dy);
		// atan gives angle, convert to degrees
		// Note: using atan2 for proper quadrant handling
		const tangentAngle = Math.atan2(-slope, 1); // negative because canvas Y is flipped
		return tangentAngle * (180 / Math.PI);
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
			// In corners mode, dragging one corner keeps the opposite fixed
			const signX = Math.sign(Math.cos(this.cornerAngle)) || 1;
			const signY = Math.sign(Math.sin(this.cornerAngle)) || 1;

			if (index === 0) {
				// Dragging corner1 - corner2 (opposite) stays fixed
				const corner2X = this.x - signX * this.radiusX;
				const corner2Y = this.y - signY * this.radiusY;
				// New center is midpoint between new corner1 and fixed corner2
				this.x = (newX + corner2X) / 2;
				this.y = (newY + corner2Y) / 2;
				this.radiusX = Math.abs(newX - corner2X) / 2;
				this.radiusY = Math.abs(newY - corner2Y) / 2;
				this.cornerAngle = Math.atan2(newY - this.y, newX - this.x);
			} else if (index === 1) {
				// Dragging corner2 - corner1 stays fixed
				const corner1X = this.x + signX * this.radiusX;
				const corner1Y = this.y + signY * this.radiusY;
				// New center is midpoint between fixed corner1 and new corner2
				this.x = (corner1X + newX) / 2;
				this.y = (corner1Y + newY) / 2;
				this.radiusX = Math.abs(corner1X - newX) / 2;
				this.radiusY = Math.abs(corner1Y - newY) / 2;
				this.cornerAngle = Math.atan2(corner1Y - this.y, corner1X - this.x);
			} else {
				// Axis points (2-5) behave the same as center mode
				this.updateAxisPoint(index, newX, newY);
			}
		} else {
			// 'center' mode (default)
			switch(index){
				case 0: // center - move the ellipse
					this.x = newX;
					this.y = newY;
					break;
				case 1: // corner - adjust both radii and remember the angle
					this.radiusX = Math.abs(newX - this.x);
					this.radiusY = Math.abs(newY - this.y);
					this.cornerAngle = Math.atan2(newY - this.y, newX - this.x);
					break;
				default:
					this.updateAxisPoint(index, newX, newY);
					break;
			}
		}
		this.update();
	}

	// Helper to update axis control points (indices 2-5)
	updateAxisPoint(index, newX, newY) {
		switch(index){
			case 2: // right
			case 3: // left
				// Change radiusX based on horizontal distance from center
				this.radiusX = Math.abs(newX - this.x);
				break;
			case 4: // bottom
			case 5: // top
				// Change radiusY based on vertical distance from center
				this.radiusY = Math.abs(newY - this.y);
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
