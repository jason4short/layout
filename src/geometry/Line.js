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
		return new Line([this.start.x, this.start.y, this.end.x, this.end.y]);			
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
}

