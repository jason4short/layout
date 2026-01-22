import {Shape, Geometry} from './Geometry.js';
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

		// params: [x, y, radiusX, radiusY, rotation]
		this.x 				= params[0];
		this.y 				= params[1];
		this.radiusX 		= params[2];  // semi-axis in X direction
		this.radiusY 		= params[3];  // semi-axis in Y direction
		this.rotation 		= params[4] || 0;  // rotation in radians (for future use)

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
		// Return center and 4 vertex points (ends of axes)
		return [
			{ x: this.x, y: this.y },  // center
			{ x: this.x + this.radiusX, y: this.y },  // right
			{ x: this.x - this.radiusX, y: this.y },  // left
			{ x: this.x, y: this.y + this.radiusY },  // bottom
			{ x: this.x, y: this.y - this.radiusY }   // top
		];
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
		let e = new Ellipse([this.x, this.y, this.radiusX, this.radiusY, this.rotation]);
		e.type = this.type;
		e.groupId = this.groupId;
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
	// POI indices: 0=center, 1=right, 2=left, 3=bottom, 4=top
	updateControlPoint(index, newX, newY){
		switch(index){
			case 0: // center - move the ellipse
				this.x = newX;
				this.y = newY;
				break;
			case 1: // right
			case 2: // left
				// Change radiusX based on horizontal distance from center
				this.radiusX = Math.abs(newX - this.x);
				break;
			case 3: // bottom
			case 4: // top
				// Change radiusY based on vertical distance from center
				this.radiusY = Math.abs(newY - this.y);
				break;
		}
		this.update();
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
