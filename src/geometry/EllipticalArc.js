import {Shape, Geometry} from './Geometry.js';
import {Ellipse} from './Ellipse.js';
import {Point} from './Point.js';

export class EllipticalArc extends Ellipse
{
	constructor(params)
	{
		// params: [x, y, radiusX, radiusY, rotation, startAngle, endAngle]
		super([params[0], params[1], params[2], params[3], params[4]]);
		this.geometry 		= Shape.ELLIPTICAL_ARC;
		this.startAngle 	= params[5];  // radians
		this.endAngle 		= params[6];  // radians
	}

	// Normalize angle to [0, 2*PI)
	normalizeAngle(angle) {
		const TWO_PI = Math.PI * 2;
		angle = angle % TWO_PI;
		if (angle < 0) angle += TWO_PI;
		return angle;
	}

	// Check if an angle is within the arc's range (counterclockwise from start to end)
	containsAngle(angle) {
		const normAngle = this.normalizeAngle(angle);
		const normStart = this.normalizeAngle(this.startAngle);
		const normEnd = this.normalizeAngle(this.endAngle);

		if (normStart <= normEnd) {
			return normAngle >= normStart && normAngle <= normEnd;
		} else {
			// Wrap-around case
			return normAngle >= normStart || normAngle <= normEnd;
		}
	}

	// Get point on ellipse at given angle
	getPointAtAngle(angle) {
		// For axis-aligned ellipse (rotation = 0)
		return new Point(
			this.x + Math.cos(angle) * this.radiusX,
			this.y + Math.sin(angle) * this.radiusY
		);
	}

	// Get angle for a point on the ellipse
	getAngleForPoint(px, py) {
		// Transform to unit circle space
		const nx = (px - this.x) / this.radiusX;
		const ny = (py - this.y) / this.radiusY;
		return Math.atan2(ny, nx);
	}

	// Get the midpoint angle of the arc
	getMidAngle() {
		const normStart = this.normalizeAngle(this.startAngle);
		const normEnd = this.normalizeAngle(this.endAngle);

		if (normStart <= normEnd) {
			return (normStart + normEnd) / 2;
		} else {
			let mid = (normStart + normEnd + Math.PI * 2) / 2;
			if (mid >= Math.PI * 2) mid -= Math.PI * 2;
			return mid;
		}
	}

	getSnapPOIs() {
		const startPt = this.getPointAtAngle(this.startAngle);
		const endPt = this.getPointAtAngle(this.endAngle);
		const midPt = this.getPointAtAngle(this.getMidAngle());

		return [
			{ x: this.x, y: this.y },  // center
			startPt,
			endPt,
			midPt
		];
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if(!this.bounds.intersects(mouseRect)){
			return null;
		}

		if(this.radiusX <= 0 || this.radiusY <= 0){
			return null;
		}

		// Find closest point on ellipse perimeter
		const dx = mouse.x - this.x;
		const dy = mouse.y - this.y;

		const nx = dx / this.radiusX;
		const ny = dy / this.radiusY;
		const dist = Math.sqrt(nx * nx + ny * ny);

		if(dist === 0){
			return null;
		}

		const ux = nx / dist;
		const uy = ny / dist;

		// Check if the angle is within the arc range
		const angle = Math.atan2(uy, ux);
		if (!this.containsAngle(angle)) {
			return null;
		}

		const px = this.x + ux * this.radiusX;
		const py = this.y + uy * this.radiusY;

		const point = new Point(px, py);
		point.distance = this.distanceBetweenPoints(mouse, point);

		if(point.distance > pixelTolerance){
			return null;
		}

		return point;
	}

	// Get parametric t value (0-1) for a point based on angle
	getParametricT(point) {
		const angle = this.getAngleForPoint(point.x, point.y);
		const normAngle = this.normalizeAngle(angle);
		const normStart = this.normalizeAngle(this.startAngle);
		const normEnd = this.normalizeAngle(this.endAngle);

		let sweep;
		if (normStart <= normEnd) {
			sweep = normEnd - normStart;
		} else {
			sweep = (Math.PI * 2 - normStart) + normEnd;
		}

		let angleFromStart;
		if (normStart <= normEnd) {
			angleFromStart = normAngle - normStart;
		} else {
			if (normAngle >= normStart) {
				angleFromStart = normAngle - normStart;
			} else {
				angleFromStart = (Math.PI * 2 - normStart) + normAngle;
			}
		}

		return sweep > 0 ? angleFromStart / sweep : 0;
	}

	// Arc length approximation
	length() {
		// Approximate using Ramanujan's formula scaled by arc fraction
		const a = this.radiusX;
		const b = this.radiusY;
		const h = ((a - b) * (a - b)) / ((a + b) * (a + b));
		const fullPerimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));

		let sweep = this.endAngle - this.startAngle;
		if (sweep < 0) sweep += Math.PI * 2;

		return fullPerimeter * (sweep / (Math.PI * 2));
	}

	clone() {
		return new EllipticalArc([
			this.x, this.y, this.radiusX, this.radiusY,
			this.rotation, this.startAngle, this.endAngle
		]);
	}

	// Update a specific control point by index
	// POI indices: 0=center, 1=start endpoint, 2=end endpoint, 3=midpoint
	updateControlPoint(index, newX, newY){
		switch(index){
			case 0: // center - move the arc
				this.x = newX;
				this.y = newY;
				break;
			case 1: // start endpoint - change startAngle
				this.startAngle = this.getAngleForPoint(newX, newY);
				break;
			case 2: // end endpoint - change endAngle
				this.endAngle = this.getAngleForPoint(newX, newY);
				break;
			case 3: // midpoint - scale radii proportionally
				const dist = Math.sqrt(
					Math.pow(newX - this.x, 2) +
					Math.pow(newY - this.y, 2)
				);
				const midPt = this.getPointAtAngle(this.getMidAngle());
				const origDist = Math.sqrt(
					Math.pow(midPt.x - this.x, 2) +
					Math.pow(midPt.y - this.y, 2)
				);
				if(origDist > 0){
					const scale = dist / origDist;
					this.radiusX *= scale;
					this.radiusY *= scale;
				}
				break;
		}
		this.update();
	}
}
