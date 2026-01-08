import {Point} 				from './Point.js';
import {Shape, Geometry} 	from './Geometry.js';
import {Rectangle} 			from './Rectangle.js';

import * as VectorUtils 	from './utils/VectorUtils.js';
import * as TransformUtils 	from './utils/TransformUtils.js';
import * as LineUtils 		from './utils/LineUtils.js';

export class Line extends Geometry
{
	constructor(params)
	{
		super();
		this.type 		= Shape.PLAIN;
		this.geometry	= Shape.LINE;

		this.start		= new Point(params[0], params[1]);
		this.end 		= new Point(params[2], params[3]);
		this.mid 		= new Point((this.start.x + this.end.x) / 2, (this.start.y + this.end.y) / 2);
		this.tangent;
		this.update();
	}

	update(){
		this.mid.x 			= (this.start.x + this.end.x) / 2;
		this.mid.y 			= (this.start.y + this.end.y) / 2;
		
		// precompute tangent
		this.tangent 		= LineUtils.getAngleDeg(this);
		// XXX convert to radians

		// bounding box
		this.bounds.x 		= Math.min(this.start.x, this.end.x);
		this.bounds.y 		= Math.min(this.start.y, this.end.y);
		this.bounds.width 	= Math.max(this.start.x, this.end.x) - this.bounds.x;
		this.bounds.height 	= Math.max(this.start.y, this.end.y) - this.bounds.y;
	}

	getSnapPOIs() {
		return [this.start, this.end, this.mid];
	}

	length(){
		return VectorUtils.distance(this.start, this.end);
	}

	scaleToDim(dim)
	{
		if(!Number.isFinite(dim) || dim <= 0){
			return false;
		}

		const direction = VectorUtils.vectorBetweenPoints(this.start, this.end);
		const currentLength = VectorUtils.length(direction);

		// If the user has not moved the mouse yet, we do not have a direction to scale along.
		if(currentLength === 0){
			return false;
		}

		const unitDir = VectorUtils.normalize(direction);
		this.end.x = this.start.x + (unitDir.x * dim);
		this.end.y = this.start.y + (unitDir.y * dim);

		this.update();

		return true;
	}

	clone(){
		let l = new Line([this.start.x, this.start.y, this.end.x, this.end.y]);
		l.type 		= this.type;
		l.geometry	= this.geometry;
		l.penStyle	= this.penStyle;
		return l;
	}

	copyFrom(other){
		this.start.x = other.start.x;
		this.start.y = other.start.y;
		this.end.x = other.end.x;
		this.end.y = other.end.y;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.update();
	}


	// Get tangent angle (in degrees) at any point on the line
	// For a line, tangent is just the line's angle
	getTangentAngle(point) {
		return this.tangent;
	}

	// used by properties inspector
	getAngleDeg(){
		return this.tangent;
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if (!this.bounds.intersects(mouseRect)){return null};

		// Precise closest point on the segment
		const point 	= VectorUtils.closestPointOnSegment(mouse, this.start, this.end);

		// is it close enough for a snap		
		if(VectorUtils.distFast(mouse, point) < pixelTolerance){
			return point;
		}else{
			return null;
		}
	}

	// Returns parametric t value (0-1) for a point on the line
	// t=0 is start, t=1 is end
	getParametricT(point) {
		return LineUtils.getParametricT(point, this);
	}

	// Returns point at parametric position t
	getPointAtT(t) {
		return LineUtils.getPointAtT(t, this);
	}

	// Update endpoints for trimming
	trimToPoints(newStart, newEnd) {
		if (newStart) {
			this.start.x = newStart.x;
			this.start.y = newStart.y;
		}
		if (newEnd) {
			this.end.x = newEnd.x;
			this.end.y = newEnd.y;
		}
		this.update();
	}

	// Translate the line by offset
	translate(dx, dy){
		TransformUtils.translatePointInPlace(this.start, dx, dy);
		TransformUtils.translatePointInPlace(this.end, dx, dy);
		this.update();
	}

	// Scale the line relative to an anchor point
	scale(anchorX, anchorY, factor){
		TransformUtils.scalePointInPlace(this.start, anchorX, anchorY, factor);
		TransformUtils.scalePointInPlace(this.end, anchorX, anchorY, factor);
		this.update();
	}

	// Rotate the line around an anchor point by angle (in radians)
	rotate(anchorX, anchorY, angleRad) {
		TransformUtils.rotatePointInPlace(this.start, anchorX, anchorY, angleRad);
		TransformUtils.rotatePointInPlace(this.end, anchorX, anchorY, angleRad);
		this.update();
	}

	// Mirror the line across a line defined by two points
	mirror(x1, y1, x2, y2){
		TransformUtils.mirrorPointInPlace(this.start, x1, y1, x2, y2);
		TransformUtils.mirrorPointInPlace(this.end, x1, y1, x2, y2);
		this.update();
	}

	// Update a specific control point by index
	// POI indices: 0=start, 1=end, 2=midpoint
	updateControlPoint(index, newX, newY){
		switch(index){
			case 0: // start
				this.start.x = newX;
				this.start.y = newY;
				break;
			case 1: // end
				this.end.x = newX;
				this.end.y = newY;
				break;
			case 2: // midpoint - moves both endpoints equally
				const dx = newX - this.mid.x;
				const dy = newY - this.mid.y;
				this.start.x += dx;
				this.start.y += dy;
				this.end.x += dx;
				this.end.y += dy;
				break;
		}
		this.update();
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			penStyle: this.penStyle,
			start: { x: this.start.x, y: this.start.y },
			end: { x: this.end.x, y: this.end.y }
		};
	}

	static fromJSON(data) {
		const line = new Line([data.start.x, data.start.y, data.end.x, data.end.y]);
		line.type = data.type;
		if(data.penStyle) line.penStyle = data.penStyle;
		return line;
	}
}
