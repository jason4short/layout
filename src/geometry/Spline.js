import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';
import * as VectorUtils from './utils/VectorUtils.js';
import * as AngleUtils from './utils/AngleUtils.js';
import {splineSchema} from './InspectorSchemas.js';
import {serializeSpline, deserializeSpline} from './GeometrySerializers.js';

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

		this.update();
	}

	update(){
		this.tangentA = VectorUtils.getAngleDeg(this.p1, this.p0);
		this.tangentB = VectorUtils.getAngleDeg(this.p2, this.p3);

		//console.log(this.tangentA, this.tangentB);

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

	getTransformablePoints() {
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
			const dist = VectorUtils.distance(mouse, pt);

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
				const dist = VectorUtils.distance(mouse, pt);
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
				bestT = VectorUtils.clamp(bestT, 0, 1);
			}

			const refined = this.evaluate(bestT);
			closestPoint = new Point(refined.x, refined.y);
			closestDist = VectorUtils.distance(mouse, closestPoint);
		}

		if(closestPoint && closestDist < pixelTolerance){
			closestPoint.distance = closestDist;
			return closestPoint;
		}

		return null;
	}

	// Get tangent angle (in degrees) at a point on the spline
	getTangentAngle(point) {

		if(point.x == this.p0.x && point.y == this.p0.y ){		
			return this.tangentA;
			
		}else if(point.x == this.p0.x && point.y == this.p0.y ){
			return this.tangentB;
		}
	
	
		// Find t parameter for this point
		let bestT = 0;
		let bestDist = Infinity;
		const samples = 50;

		for(let i = 0; i <= samples; i++){
			const t = i / samples;
			const pt = this.evaluate(t);
			const dist = VectorUtils.distance(point, pt);
			if(dist < bestDist){
				bestDist = dist;
				bestT = t;
			}
		}

		const d = this.evaluateDerivative(bestT);
		return AngleUtils.toDegrees(Math.atan2(-d.y, d.x));
	}

	// Approximate arc length
	length() {
		let len = 0;
		const samples = 100;
		let prev = this.evaluate(0);

		for(let i = 1; i <= samples; i++){
			const t = i / samples;
			const curr = this.evaluate(t);
			len += VectorUtils.distance(prev, curr);
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
		s.groupId = this.groupId;
		return s;
	}

	// Transform methods inherited from Geometry base class via getTransformablePoints()

	getInspectorSchema() {
		return splineSchema(this);
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
		return serializeSpline(this);
	}

	static fromJSON(data) {
		return deserializeSpline(data, Spline);
	}

	draw(ctx, renderer) {
		const p0 = renderer.toScreen(this.p0.x, this.p0.y);
		const p1 = renderer.toScreen(this.p1.x, this.p1.y);
		const p2 = renderer.toScreen(this.p2.x, this.p2.y);
		const p3 = renderer.toScreen(this.p3.x, this.p3.y);

		ctx.moveTo(p0.x, p0.y);
		ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
		ctx.stroke();
		renderer.resetPenStyle(ctx);
	}

	drawHandles(ctx, renderer) {
		if (!this.selected && !this.showControlPoints) return;

		const p0 = renderer.toScreen(this.p0.x, this.p0.y);
		const p1 = renderer.toScreen(this.p1.x, this.p1.y);
		const p2 = renderer.toScreen(this.p2.x, this.p2.y);
		const p3 = renderer.toScreen(this.p3.x, this.p3.y);
		const handleRadius = 4;

		// Draw control polygon (gray dashed lines)
		ctx.beginPath();
		ctx.strokeStyle = '#AAAAAA';
		ctx.lineWidth = 0.5;
		ctx.setLineDash([2, 2]);
		ctx.moveTo(p0.x, p0.y);
		ctx.lineTo(p1.x, p1.y);
		ctx.lineTo(p2.x, p2.y);
		ctx.lineTo(p3.x, p3.y);
		ctx.stroke();
		ctx.setLineDash([]);

		// Draw control point handles
		ctx.lineWidth = 0.5;
		ctx.strokeStyle = '#666666';
		ctx.fillStyle = '#FFFFFF';

		for (const pt of [p0, p1, p2, p3]) {
			ctx.beginPath();
			ctx.arc(pt.x, pt.y, handleRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
	}
}
