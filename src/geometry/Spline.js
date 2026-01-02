import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';

// Cubic Bezier Spline with 4 control points
export class Spline extends Geometry
{
	constructor(params)
	{
		super();
		this.type 		= Shape.PLAIN;
		this.geometry	= Shape.SPLINE;

		// 4 control points: p0, p1, p2, p3
		// p0 and p3 are endpoints (curve passes through)
		// p1 and p2 are control handles
		this.p0 = new Point(params[0], params[1]);
		this.p1 = new Point(params[2], params[3]);
		this.p2 = new Point(params[4], params[5]);
		this.p3 = new Point(params[6], params[7]);

		this.updateBoundingBox();
	}

	update(){
		this.updateBoundingBox();
	}

	updateBoundingBox()
	{
		// Bounding box contains all control points (conservative)
		const minX = Math.min(this.p0.x, this.p1.x, this.p2.x, this.p3.x);
		const maxX = Math.max(this.p0.x, this.p1.x, this.p2.x, this.p3.x);
		const minY = Math.min(this.p0.y, this.p1.y, this.p2.y, this.p3.y);
		const maxY = Math.max(this.p0.y, this.p1.y, this.p2.y, this.p3.y);

		this.bounds.x 		= minX;
		this.bounds.y 		= minY;
		this.bounds.width 	= maxX - minX;
		this.bounds.height 	= maxY - minY;
	}

	// Evaluate cubic Bezier at parameter t (0 to 1)
	evaluate(t) {
		const t2 = t * t;
		const t3 = t2 * t;
		const mt = 1 - t;
		const mt2 = mt * mt;
		const mt3 = mt2 * mt;

		return {
			x: mt3 * this.p0.x + 3 * mt2 * t * this.p1.x + 3 * mt * t2 * this.p2.x + t3 * this.p3.x,
			y: mt3 * this.p0.y + 3 * mt2 * t * this.p1.y + 3 * mt * t2 * this.p2.y + t3 * this.p3.y
		};
	}

	// Evaluate derivative at parameter t
	evaluateDerivative(t) {
		const mt = 1 - t;
		const mt2 = mt * mt;
		const t2 = t * t;

		return {
			x: 3 * mt2 * (this.p1.x - this.p0.x) + 6 * mt * t * (this.p2.x - this.p1.x) + 3 * t2 * (this.p3.x - this.p2.x),
			y: 3 * mt2 * (this.p1.y - this.p0.y) + 6 * mt * t * (this.p2.y - this.p1.y) + 3 * t2 * (this.p3.y - this.p2.y)
		};
	}

	getSnapPOIs() {
		// Return all 4 control points
		// POI indices: 0=p0(start), 1=p1(handle1), 2=p2(handle2), 3=p3(end)
		return [this.p0, this.p1, this.p2, this.p3];
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if(!this.bounds.intersects(mouseRect)){
			return null;
		}

		// Sample the curve and find closest point
		let closestPoint = null;
		let closestDist = Infinity;
		const samples = 50;

		for(let i = 0; i <= samples; i++){
			const t = i / samples;
			const pt = this.evaluate(t);
			const dist = this.distanceBetweenPoints(mouse, pt);

			if(dist < closestDist){
				closestDist = dist;
				closestPoint = new Point(pt.x, pt.y);
			}
		}

		// Refine with binary search in the vicinity
		if(closestPoint && closestDist < pixelTolerance * 2){
			// Find which segment we're in and refine
			let bestT = 0;
			let bestDist = Infinity;

			for(let i = 0; i <= samples; i++){
				const t = i / samples;
				const pt = this.evaluate(t);
				const dist = this.distanceBetweenPoints(mouse, pt);
				if(dist < bestDist){
					bestDist = dist;
					bestT = t;
				}
			}

			// Newton-Raphson refinement
			for(let iter = 0; iter < 5; iter++){
				const pt = this.evaluate(bestT);
				const d = this.evaluateDerivative(bestT);

				const dx = pt.x - mouse.x;
				const dy = pt.y - mouse.y;

				const numerator = dx * d.x + dy * d.y;
				const denominator = d.x * d.x + d.y * d.y;

				if(Math.abs(denominator) < 0.0001) break;

				bestT -= numerator / denominator;
				bestT = Math.max(0, Math.min(1, bestT));
			}

			const refined = this.evaluate(bestT);
			closestPoint = new Point(refined.x, refined.y);
			closestDist = this.distanceBetweenPoints(mouse, closestPoint);
		}

		if(closestPoint && closestDist < pixelTolerance){
			closestPoint.distance = closestDist;
			return closestPoint;
		}

		return null;
	}

	// Get tangent angle (in degrees) at a point on the spline
	getTangentAngle(point) {
		// Find t parameter for this point
		let bestT = 0;
		let bestDist = Infinity;
		const samples = 50;

		for(let i = 0; i <= samples; i++){
			const t = i / samples;
			const pt = this.evaluate(t);
			const dist = this.distanceBetweenPoints(point, pt);
			if(dist < bestDist){
				bestDist = dist;
				bestT = t;
			}
		}

		const d = this.evaluateDerivative(bestT);
		return Math.atan2(-d.y, d.x) * (180 / Math.PI);
	}

	// Approximate arc length
	length() {
		let len = 0;
		const samples = 100;
		let prev = this.evaluate(0);

		for(let i = 1; i <= samples; i++){
			const t = i / samples;
			const curr = this.evaluate(t);
			len += this.distanceBetweenPoints(prev, curr);
			prev = curr;
		}

		return len;
	}

	clone() {
		let s = new Spline([
			this.p0.x, this.p0.y,
			this.p1.x, this.p1.y,
			this.p2.x, this.p2.y,
			this.p3.x, this.p3.y
		]);
		s.type = this.type;
		return s;
	}

	// Translate the spline by offset
	translate(dx, dy){
		this.p0.x += dx;
		this.p0.y += dy;
		this.p1.x += dx;
		this.p1.y += dy;
		this.p2.x += dx;
		this.p2.y += dy;
		this.p3.x += dx;
		this.p3.y += dy;
		this.update();
	}

	// Scale the spline relative to an anchor point
	scale(anchorX, anchorY, factor){
		this.p0.x = anchorX + (this.p0.x - anchorX) * factor;
		this.p0.y = anchorY + (this.p0.y - anchorY) * factor;
		this.p1.x = anchorX + (this.p1.x - anchorX) * factor;
		this.p1.y = anchorY + (this.p1.y - anchorY) * factor;
		this.p2.x = anchorX + (this.p2.x - anchorX) * factor;
		this.p2.y = anchorY + (this.p2.y - anchorY) * factor;
		this.p3.x = anchorX + (this.p3.x - anchorX) * factor;
		this.p3.y = anchorY + (this.p3.y - anchorY) * factor;
		this.update();
	}

	// Rotate the spline around an anchor point by angle (in radians)
	rotate(anchorX, anchorY, angleRad) {
		const cos = Math.cos(angleRad);
		const sin = Math.sin(angleRad);

		const rotatePoint = (px, py) => {
			const dx = px - anchorX;
			const dy = py - anchorY;
			return {
				x: anchorX + dx * cos - dy * sin,
				y: anchorY + dx * sin + dy * cos
			};
		};

		const r0 = rotatePoint(this.p0.x, this.p0.y);
		const r1 = rotatePoint(this.p1.x, this.p1.y);
		const r2 = rotatePoint(this.p2.x, this.p2.y);
		const r3 = rotatePoint(this.p3.x, this.p3.y);

		this.p0.x = r0.x; this.p0.y = r0.y;
		this.p1.x = r1.x; this.p1.y = r1.y;
		this.p2.x = r2.x; this.p2.y = r2.y;
		this.p3.x = r3.x; this.p3.y = r3.y;

		this.update();
	}

	// Mirror the spline across a line defined by two points
	mirror(x1, y1, x2, y2){
		const mirrorPoint = (px, py) => {
			const dx = x2 - x1;
			const dy = y2 - y1;
			const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
			const cx = x1 + t * dx;
			const cy = y1 + t * dy;
			return { x: 2 * cx - px, y: 2 * cy - py };
		};

		const m0 = mirrorPoint(this.p0.x, this.p0.y);
		const m1 = mirrorPoint(this.p1.x, this.p1.y);
		const m2 = mirrorPoint(this.p2.x, this.p2.y);
		const m3 = mirrorPoint(this.p3.x, this.p3.y);

		this.p0.x = m0.x; this.p0.y = m0.y;
		this.p1.x = m1.x; this.p1.y = m1.y;
		this.p2.x = m2.x; this.p2.y = m2.y;
		this.p3.x = m3.x; this.p3.y = m3.y;

		this.update();
	}

	// Update a specific control point by index
	// POI indices: 0=p0, 1=p1, 2=p2, 3=p3
	updateControlPoint(index, newX, newY){
		switch(index){
			case 0:
				this.p0.x = newX;
				this.p0.y = newY;
				break;
			case 1:
				this.p1.x = newX;
				this.p1.y = newY;
				break;
			case 2:
				this.p2.x = newX;
				this.p2.y = newY;
				break;
			case 3:
				this.p3.x = newX;
				this.p3.y = newY;
				break;
		}
		this.update();
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			penStyle: this.penStyle,
			p0: { x: this.p0.x, y: this.p0.y },
			p1: { x: this.p1.x, y: this.p1.y },
			p2: { x: this.p2.x, y: this.p2.y },
			p3: { x: this.p3.x, y: this.p3.y }
		};
	}

	static fromJSON(data) {
		const spline = new Spline([
			data.p0.x, data.p0.y,
			data.p1.x, data.p1.y,
			data.p2.x, data.p2.y,
			data.p3.x, data.p3.y
		]);
		spline.type = data.type;
		if(data.penStyle) spline.penStyle = data.penStyle;
		return spline;
	}
}
