import {Point} 				from './Point.js';
import {Shape, 
		Geometry, 
		PenStyle} 			from './Geometry.js';

import * as VectorUtils 	from './utils/VectorUtils.js';
import * as TransformUtils 	from './utils/TransformUtils.js';

export class Dimension extends Geometry
{
	constructor(params)
	{
		super();
		this.type 		= Shape.DIMENSION;
		this.geometry 		= Shape.DIMENSION;
		
		this.penStyle 	= PenStyle.DIMENSION;  // Default pen style

		// The two points being measured
		this.start		= new Point(params[0], params[1]);
		this.end 		= new Point(params[2], params[3]);

		// Perpendicular offset for dimension line (positive = one side, negative = other)
		this.offset		= params[4] || 0;

		// Computed geometry for rendering
		this.dimLineStart	= new Point(0, 0);  // Start of dimension line
		this.dimLineEnd		= new Point(0, 0);  // End of dimension line
		this.textPosition	= new Point(0, 0);  // Center of text

		// Extension line endpoints
		this.extLine1Start	= new Point(0, 0);  // From start point
		this.extLine1End	= new Point(0, 0);  // To dimension line
		this.extLine2Start	= new Point(0, 0);  // From end point
		this.extLine2End	= new Point(0, 0);  // To dimension line

		// Calculated value
		this.value = 0;

		// Unit perpendicular vector (for offset direction)
		this.perpendicular = { x: 0, y: 0 };

		this.update();
	}

	update(){
		// Calculate the measured distance
		this.value = VectorUtils.distance(this.start, this.end);

		// Calculate direction vector along the measurement
		const dx = this.end.x - this.start.x;
		const dy = this.end.y - this.start.y;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len > 0) {
			// Unit vector along measurement direction
			const unitX = dx / len;
			const unitY = dy / len;

			// Perpendicular unit vector (rotated 90 degrees)
			this.perpendicular.x = -unitY;
			this.perpendicular.y = unitX;
		}

		// Calculate dimension line endpoints (offset from start/end)
		this.dimLineStart.x = this.start.x + this.perpendicular.x * this.offset;
		this.dimLineStart.y = this.start.y + this.perpendicular.y * this.offset;
		this.dimLineEnd.x = this.end.x + this.perpendicular.x * this.offset;
		this.dimLineEnd.y = this.end.y + this.perpendicular.y * this.offset;

		// Text position at midpoint of dimension line
		this.textPosition.x = (this.dimLineStart.x + this.dimLineEnd.x) / 2;
		this.textPosition.y = (this.dimLineStart.y + this.dimLineEnd.y) / 2;

		// Extension lines - from measured points toward dimension line
		// Add small gap at the measured point end, extend slightly past dimension line
		const gapRatio = 0.1;  // Gap from measured point (as ratio of offset)
		const overrun = 0.15;  // How far to extend past dimension line (as ratio)

		const offsetSign = this.offset >= 0 ? 1 : -1;
		const absOffset = Math.abs(this.offset);

		// Extension line 1 (from start)
		this.extLine1Start.x = this.start.x + this.perpendicular.x * absOffset * gapRatio * offsetSign;
		this.extLine1Start.y = this.start.y + this.perpendicular.y * absOffset * gapRatio * offsetSign;
		this.extLine1End.x = this.start.x + this.perpendicular.x * (absOffset * (1 + overrun)) * offsetSign;
		this.extLine1End.y = this.start.y + this.perpendicular.y * (absOffset * (1 + overrun)) * offsetSign;

		// Extension line 2 (from end)
		this.extLine2Start.x = this.end.x + this.perpendicular.x * absOffset * gapRatio * offsetSign;
		this.extLine2Start.y = this.end.y + this.perpendicular.y * absOffset * gapRatio * offsetSign;
		this.extLine2End.x = this.end.x + this.perpendicular.x * (absOffset * (1 + overrun)) * offsetSign;
		this.extLine2End.y = this.end.y + this.perpendicular.y * (absOffset * (1 + overrun)) * offsetSign;

		// Update bounding box to include all geometry
		const allX = [
			this.start.x, this.end.x,
			this.dimLineStart.x, this.dimLineEnd.x,
			this.extLine1Start.x, this.extLine1End.x,
			this.extLine2Start.x, this.extLine2End.x
		];
		const allY = [
			this.start.y, this.end.y,
			this.dimLineStart.y, this.dimLineEnd.y,
			this.extLine1Start.y, this.extLine1End.y,
			this.extLine2Start.y, this.extLine2End.y
		];

		this.bounds.x = Math.min(...allX);
		this.bounds.y = Math.min(...allY);
		this.bounds.width = Math.max(...allX) - this.bounds.x;
		this.bounds.height = Math.max(...allY) - this.bounds.y;
	}

	getSnapPOIs() {
		return [this.start, this.end, this.textPosition];
	}

	// Returns the measured distance
	length(){
		return this.value;
	}

	// Get formatted display text
	getDisplayText(units = '', precision = 2) {
		const formatted = this.value.toFixed(precision);
		return units ? `${formatted} ${units}` : formatted;
	}

	clone(){
		let d = new Dimension([
			this.start.x, this.start.y,
			this.end.x, this.end.y,
			this.offset
		]);
		d.type 		= this.type;
		d.geometry	= this.geometry;
		d.penStyle	= this.penStyle;
		return d;
	}

	copyFrom(other){
		this.start.x = other.start.x;
		this.start.y = other.start.y;
		this.end.x = other.end.x;
		this.end.y = other.end.y;
		this.offset = other.offset;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.update();
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if (!this.bounds.intersects(mouseRect)){return null};

		// Check if close to dimension line
		const point = VectorUtils.closestPointOnSegment(mouse, this.dimLineStart, this.dimLineEnd);

		if(VectorUtils.distFast(mouse, point) < pixelTolerance){
			return point;
		}
		return null;
	}

	// Translate the dimension by offset
	translate(dx, dy){
		TransformUtils.translatePointInPlace(this.start, dx, dy);
		TransformUtils.translatePointInPlace(this.end, dx, dy);
		this.update();
	}

	// Scale the dimension relative to an anchor point
	scale(anchorX, anchorY, factor){
		TransformUtils.scalePointInPlace(this.start, anchorX, anchorY, factor);
		TransformUtils.scalePointInPlace(this.end, anchorX, anchorY, factor);
		this.offset *= factor;
		this.update();
	}

	// Rotate the dimension around an anchor point by angle (in radians)
	rotate(anchorX, anchorY, angleRad) {
		TransformUtils.rotatePointInPlace(this.start, anchorX, anchorY, angleRad);
		TransformUtils.rotatePointInPlace(this.end, anchorX, anchorY, angleRad);
		this.update();
	}

	// Mirror the dimension across a line defined by two points
	mirror(x1, y1, x2, y2){
		TransformUtils.mirrorPointInPlace(this.start, x1, y1, x2, y2);
		TransformUtils.mirrorPointInPlace(this.end, x1, y1, x2, y2);
		this.offset = -this.offset;  // Flip offset direction
		this.update();
	}

	// Update a specific control point by index
	// POI indices: 0=start, 1=end, 2=textPosition (moves offset)
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
			case 2: // text position - adjust offset
				// Calculate new offset based on perpendicular distance from measurement line
				const toNew = { x: newX - this.start.x, y: newY - this.start.y };
				this.offset = toNew.x * this.perpendicular.x + toNew.y * this.perpendicular.y;
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
			end: { x: this.end.x, y: this.end.y },
			offset: this.offset
		};
	}

	static fromJSON(data) {
		const dim = new Dimension([
			data.start.x, data.start.y,
			data.end.x, data.end.y,
			data.offset || 0
		]);
		dim.type = data.type;
		if(data.penStyle) dim.penStyle = data.penStyle;
		return dim;
	}
}
