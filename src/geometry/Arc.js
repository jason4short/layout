import {Shape, Geometry} 	from './Geometry.js';
import {Circle} 			from './Circle.js';
import {Point} 				from './Point.js';

export class Arc extends Circle
{
	constructor(params)
	{
		// params: [x, y, radius, startAngle, endAngle]
		super([params[0], params[1], params[2]]);
		this.geometry 	= Shape.ARC;
		this.startAngle = params[3];  // radians
		this.endAngle 	= params[4];  // radians
	}

	// Normalize angle in radians to [0, 2*PI);
	normalizeAngle(angle) {
		const TWO_PI 	= Math.PI * 2;
		angle 			= angle % TWO_PI;
		if (angle < 0) angle += TWO_PI;
		return angle;
	}

	// Check if an angle is within the arc's range
	// Handles wrap-around case where startAngle > endAngle
	containsAngle(angle) {
		const normAngle 	= this.normalizeAngle(angle);
		const normStart 	= this.normalizeAngle(this.startAngle);
		const normEnd 		= this.normalizeAngle(this.endAngle);

		if (normStart <= normEnd) {
			// Normal case: arc doesn't cross 0
			return normAngle >= normStart && normAngle <= normEnd;
		} else {
			// Wrap-around case: arc crosses 0/2PI
			return normAngle >= normStart || normAngle <= normEnd;
		}
	}

	// Get point on arc at given angle
	getPointAtAngle(angle) {
		return new Point(
			this.x + Math.cos(angle) * this.radius,
			this.y + Math.sin(angle) * this.radius
		);
	}

	// Get the midpoint angle of the arc
	getMidAngle() {
		const normStart = this.normalizeAngle(this.startAngle);
		const normEnd = this.normalizeAngle(this.endAngle);

		if (normStart <= normEnd) {
			return (normStart + normEnd) / 2;
		} else {
			// Wrap-around: average crosses 0
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
		if (!this.bounds.intersects(mouseRect)) {
			return null;
		}

		// If the arc is degenerate, it can't be snapped as geometry.
		if (this.radius <= 0) { return null; }

		const centerPoint = new Point(this.x, this.y);
		const distanceToCenter = this.distanceBetweenPoints(mouse, centerPoint);

		if (distanceToCenter === 0) { return null; }

		// How far the mouse is from the circle perimeter (radial error)
		const distanceFromPerimeter = Math.abs(distanceToCenter - this.radius);

		if (distanceFromPerimeter > pixelTolerance) { return null; }

		// Project the mouse direction onto the circle perimeter.
		const directionX = (mouse.x - this.x) / distanceToCenter;
		const directionY = (mouse.y - this.y) / distanceToCenter;

		// Check if the projected point is within the arc's angle range
		const angle = Math.atan2(directionY, directionX);
		if (!this.containsAngle(angle)) {
			return null;
		}

		const point = new Point(
			this.x + (directionX * this.radius),
			this.y + (directionY * this.radius)
		);

		point.distance = this.distanceBetweenPoints(mouse, point);

		return point;
	}

	// Arc length = radius * angle span
	length() {
		let span = this.endAngle - this.startAngle;
		if (span < 0) span += Math.PI * 2;
		return this.radius * span;
	}

	clone() {
		return new Arc([this.x, this.y, this.radius, this.startAngle, this.endAngle]);
	}

	// Static factory: Calculate arc parameters from 3 points
	// Returns {cx, cy, radius, startAngle, endAngle} or null if collinear
	static calculateArcFrom3Points(p1, p2, p3)
	{
		// Find circumcenter of triangle formed by 3 points
		const ax = p1.x, ay = p1.y;
		const bx = p2.x, by = p2.y;
		const cx = p3.x, cy = p3.y;

		const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

		// Points are collinear
		if(Math.abs(d) < 1e-10){
			return null;
		}

		const aSq = ax * ax + ay * ay;
		const bSq = bx * bx + by * by;
		const cSq = cx * cx + cy * cy;

		const centerX = (aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / d;
		const centerY = (aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / d;

		const radius = Math.sqrt((ax - centerX) ** 2 + (ay - centerY) ** 2);

		// Calculate angles for each point
		const angle1 = Math.atan2(ay - centerY, ax - centerX);
		const angle2 = Math.atan2(by - centerY, bx - centerX);
		const angle3 = Math.atan2(cy - centerY, cx - centerX);

		// Determine arc direction: does going from angle1 to angle2 pass through angle3?
		const normalizeAngle = (a) => {
			while(a < 0) a += Math.PI * 2;
			while(a >= Math.PI * 2) a -= Math.PI * 2;
			return a;
		};

		const norm1 = normalizeAngle(angle1);
		const norm2 = normalizeAngle(angle2);
		const norm3 = normalizeAngle(angle3);

		// Check if angle3 is between angle1 and angle2 going counterclockwise
		const ccwContains = Arc.angleInRange(norm3, norm1, norm2);

		let startAngle, endAngle;

		if(ccwContains){
			// CCW from p1 to p2 contains p3
			startAngle = angle1;
			endAngle = angle2;
		} else {
			// CW from p1 to p2 contains p3, so swap to go the other way
			startAngle = angle2;
			endAngle = angle1;
		}

		return {
			cx: centerX,
			cy: centerY,
			radius: radius,
			startAngle: startAngle,
			endAngle: endAngle
		};
	}

	// Static helper: Check if angle is in range from start to end (counterclockwise)
	static angleInRange(angle, start, end)
	{
		const TWO_PI = Math.PI * 2;

		// Normalize all to [0, 2PI)
		const normalize = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

		const a = normalize(angle);
		const s = normalize(start);
		const e = normalize(end);

		if(s <= e){
			return a >= s && a <= e;
		} else {
			// Wraps around 0
			return a >= s || a <= e;
		}
	}

	// Scale the arc relative to an anchor point
	// Inherits center/radius scaling from Circle, angles stay relative to center
	scale(anchorX, anchorY, factor){
		this.x = anchorX + (this.x - anchorX) * factor;
		this.y = anchorY + (this.y - anchorY) * factor;
		this.radius = this.radius * Math.abs(factor);
		// startAngle and endAngle remain unchanged (relative to center)
		this.update();
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
				this.startAngle = Math.atan2(newY - this.y, newX - this.x);
				break;
			case 2: // end endpoint - change endAngle
				this.endAngle = Math.atan2(newY - this.y, newX - this.x);
				break;
			case 3: // midpoint - change radius
				this.radius = Math.sqrt(
					Math.pow(newX - this.x, 2) +
					Math.pow(newY - this.y, 2)
				);
				break;
		}
		this.update();
	}
}
