import {Point} 				from './Point.js';
import {Shape, Geometry} 	from './Geometry.js';
import {Rectangle} 			from './Rectangle.js';

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
		this.updateBoundingBox();
	}
	
	update(){
		this.mid.x = (this.start.x + this.end.x) / 2;
		this.mid.y = (this.start.y + this.end.y) / 2;
		this.updateBoundingBox();
	}
	
	updateBoundingBox(){
		this.bounds.x 		= Math.min(this.start.x, this.end.x);
		this.bounds.y 		= Math.min(this.start.y, this.end.y);
		this.bounds.width 	= Math.max(this.start.x, this.end.x) - this.bounds.x;
		this.bounds.height 	= Math.max(this.start.y, this.end.y) - this.bounds.y;
	}

	getSnapPOIs() {
		return [this.start, this.end, this.mid];
	}

	length(){
		const dx = this.end.x - this.start.x;
		const dy = this.end.y - this.start.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	scaleToDim(dim)
	{
		if(!Number.isFinite(dim) || dim <= 0){
			return false;
		}

		const directionX = this.end.x - this.start.x;
		const directionY = this.end.y - this.start.y;

		const currentLength = Math.sqrt((directionX * directionX) + (directionY * directionY));

		// If the user has not moved the mouse yet, we do not have a direction to scale along.
		if(currentLength === 0){
			return false;
		}

		const unitDirectionX = directionX / currentLength;
		const unitDirectionY = directionY / currentLength;

		this.end.x = this.start.x + (unitDirectionX * dim);
		this.end.y = this.start.y + (unitDirectionY * dim);

		this.update();

		return true;
	}
	
	clone(){
		let l = new Line([this.start.x, this.start.y, this.end.x, this.end.y]);
		l.type 		= this.type;	
		l.geometry	= this.geometry;
		return l;
	}

	getAngleDeg(){
		const dx = this.end.x - this.start.x;
		const dy = this.end.y - this.start.y;

		// atan2 returns angle in radians (-π to +π)
		// canvas is flipped Y -
		const angleRad = Math.atan2(-dy, dx);

		// convert to degrees (0–360)
		let angleDeg = angleRad * (180 / Math.PI);
		if(angleDeg < 0) angleDeg += 360;

		return angleDeg;
	}

	// Get tangent angle (in degrees) at any point on the line
	// For a line, tangent is just the line's angle
	getTangentAngle(point) {
		return this.getAngleDeg();
	}

	/**
	 * Compute an "on a line" snap candidate for the given cursor point.
	 *
	 * Inputs:
	 * - cursorWorldPoint: {x, y} in world coordinates.
	 * - pixelTolerance: number of pixels for snapping radius.
	 * - worldUnitsPerPixel: conversion from screen pixels -> world units.
	 *
	 * Output:
	 * - A snap candidate object with shape, type, point, distance, and priority,
	 *   or null if outside tolerance.
	 *
	 * Notes:
	 * - type is "onLine" to distinguish from endpoints/midpoints.
	 * - distance is in world units. Use squared distance for comparisons when possible.
	 * - priority can help you rank different snap types (e.g., endpoint > onLine).
	 */

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if (!this.bounds.intersects(mouseRect)){return null};

		// Precise closest point on the segment
		const point 	= this.closestPointOnSegment(mouse, this.start, this.end);
		point.distance 	= this.distanceBetweenPoints(mouse, point);

		if(point.distance < pixelTolerance){
			return point;
		}else{
			return null;
		}
	}

	// Returns parametric t value (0-1) for a point on the line
	// t=0 is start, t=1 is end
	getParametricT(point) {
		const lineVec = {
			x: this.end.x - this.start.x,
			y: this.end.y - this.start.y
		};
		const pointVec = {
			x: point.x - this.start.x,
			y: point.y - this.start.y
		};
		const lineLengthSq = lineVec.x * lineVec.x + lineVec.y * lineVec.y;
		if (lineLengthSq === 0) return 0;
		return (pointVec.x * lineVec.x + pointVec.y * lineVec.y) / lineLengthSq;
	}

	// Returns point at parametric position t
	getPointAtT(t) {
		return {
			x: this.start.x + t * (this.end.x - this.start.x),
			y: this.start.y + t * (this.end.y - this.start.y)
		};
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

	// Scale the line relative to an anchor point
	scale(anchorX, anchorY, factor){
		this.start.x = anchorX + (this.start.x - anchorX) * factor;
		this.start.y = anchorY + (this.start.y - anchorY) * factor;
		this.end.x = anchorX + (this.end.x - anchorX) * factor;
		this.end.y = anchorY + (this.end.y - anchorY) * factor;
		this.update();
	}

	// Rotate the line around an anchor point by angle (in radians)
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

		const newStart = rotatePoint(this.start.x, this.start.y);
		const newEnd = rotatePoint(this.end.x, this.end.y);

		this.start.x = newStart.x;
		this.start.y = newStart.y;
		this.end.x = newEnd.x;
		this.end.y = newEnd.y;
		this.update();
	}

	// Mirror the line across a line defined by two points
	mirror(x1, y1, x2, y2){
		const mirrorPoint = (px, py) => {
			const dx = x2 - x1;
			const dy = y2 - y1;
			const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
			const cx = x1 + t * dx;
			const cy = y1 + t * dy;
			return { x: 2 * cx - px, y: 2 * cy - py };
		};

		const newStart = mirrorPoint(this.start.x, this.start.y);
		const newEnd = mirrorPoint(this.end.x, this.end.y);

		this.start.x = newStart.x;
		this.start.y = newStart.y;
		this.end.x = newEnd.x;
		this.end.y = newEnd.y;
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
}

