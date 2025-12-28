import {Shape} from './Geometry.js';
import {Circle} from './Circle.js';
import {Point} from './Point.js';

export class Arc extends Circle
{
	constructor(params)
	{
		// params: [x, y, radius, startAngle, endAngle]
		super([params[0], params[1], params[2]]);
		this.geometry 	= Shape.ARC;
		this.startAngle = params[3];  // radians
		this.endAngle 	= params[4];    // radians
	}

	// Normalize angle to [0, 2*PI)
	normalizeAngle(angle) {
		const TWO_PI = Math.PI * 2;
		angle = angle % TWO_PI;
		if (angle < 0) angle += TWO_PI;
		return angle;
	}

	// Check if an angle is within the arc's range
	// Handles wrap-around case where startAngle > endAngle
	containsAngle(angle) {
		const normAngle = this.normalizeAngle(angle);
		const normStart = this.normalizeAngle(this.startAngle);
		const normEnd = this.normalizeAngle(this.endAngle);

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
		return {
			x: this.x + Math.cos(angle) * this.radius,
			y: this.y + Math.sin(angle) * this.radius
		};
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
}
