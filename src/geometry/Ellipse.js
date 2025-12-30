import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';

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
		point.distance = this.distanceBetweenPoints(mouse, point);

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
		return new Ellipse([this.x, this.y, this.radiusX, this.radiusY, this.rotation]);
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
}
