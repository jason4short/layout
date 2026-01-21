import {Point} 				from './Point.js';
import {Shape,
		Geometry,
		PenStyle} 			from './Geometry.js';

import * as VectorUtils 	from './utils/VectorUtils.js';
import * as TransformUtils 	from './utils/TransformUtils.js';

/**
 * Radial dimension for circles and arcs.
 * Supports both radius (R) and diameter (⌀) modes.
 */
export class RadialDimension extends Geometry
{
	constructor(params)
	{
		super();
		this.type 		= Shape.DIMENSION;
		this.geometry 	= Shape.RADIAL_DIMENSION;
		this.penStyle 	= PenStyle.DIMENSION;

		// Center of the circle/arc being dimensioned
		this.center		= new Point(params[0], params[1]);

		// Radius value
		this.radius		= params[2];

		// Angle determining direction of dimension (radians)
		this.angle		= params[3] || 0;

		// Mode: 'radius' or 'diameter'
		this.mode		= params[4] || 'radius';

		// Text position (absolute coordinates, or null to auto-calculate)
		this.textX		= params[5] !== undefined ? params[5] : null;
		this.textY		= params[6] !== undefined ? params[6] : null;

		// Computed geometry for rendering
		this.dimLineStart	= new Point(0, 0);
		this.dimLineEnd		= new Point(0, 0);
		this.textPosition	= new Point(0, 0);

		// For diameter mode - second arrow endpoint
		this.dimLineStart2	= new Point(0, 0);

		// Calculated value
		this.value = 0;

		this.update();
	}

	update(){
		// Calculate the measured value
		this.value = this.mode === 'diameter' ? this.radius * 2 : this.radius;

		// Direction vector from center at the specified angle
		const dirX = Math.cos(this.angle);
		const dirY = Math.sin(this.angle);

		// Point on circle perimeter (where arrow is)
		const perimeterX = this.center.x + dirX * this.radius;
		const perimeterY = this.center.y + dirY * this.radius;

		// dimLineEnd is always the perimeter point (arrow location)
		this.dimLineEnd.x = perimeterX;
		this.dimLineEnd.y = perimeterY;

		if (this.mode === 'radius') {
			// Radius dimension: leader from perimeter to text position

			// If text position is set, use it; otherwise auto-calculate
			if (this.textX !== null && this.textY !== null) {
				this.textPosition.x = this.textX;
				this.textPosition.y = this.textY;
			} else {
				// Default: place text outward from perimeter
				this.textPosition.x = perimeterX + dirX * 40;
				this.textPosition.y = perimeterY + dirY * 40;
			}

			this.dimLineStart.x = this.textPosition.x;
			this.dimLineStart.y = this.textPosition.y;
		} else {
			// Diameter dimension: line through center with arrows at both perimeter points
			this.dimLineStart.x = perimeterX;
			this.dimLineStart.y = perimeterY;
			this.dimLineEnd.x = this.center.x - dirX * this.radius;
			this.dimLineEnd.y = this.center.y - dirY * this.radius;

			// Second endpoint for diameter (opposite side)
			this.dimLineStart2.x = this.dimLineEnd.x;
			this.dimLineStart2.y = this.dimLineEnd.y;

			// If text position is set, use it; otherwise auto-calculate
			if (this.textX !== null && this.textY !== null) {
				this.textPosition.x = this.textX;
				this.textPosition.y = this.textY;
			} else {
				// Default: place text at center
				this.textPosition.x = this.center.x;
				this.textPosition.y = this.center.y;
			}
		}

		// Update bounding box to include text position
		const allX = [this.center.x - this.radius, this.center.x + this.radius, this.textPosition.x];
		const allY = [this.center.y - this.radius, this.center.y + this.radius, this.textPosition.y];
		const padding = 20;
		this.bounds.x = Math.min(...allX) - padding;
		this.bounds.y = Math.min(...allY) - padding;
		this.bounds.width = Math.max(...allX) - this.bounds.x + padding;
		this.bounds.height = Math.max(...allY) - this.bounds.y + padding;
	}

	getSnapPOIs() {
		return [this.center, this.dimLineEnd, this.textPosition];
	}

	// Returns the measured value (radius or diameter)
	length(){
		return this.value;
	}

	// Get formatted display text with R or diameter symbol
	getDisplayText(units = '', precision = 2) {
		const prefix = this.mode === 'diameter' ? '⌀' : 'R';
		const formatted = this.value.toFixed(precision);
		return units ? `${prefix}${formatted} ${units}` : `${prefix}${formatted}`;
	}

	clone(){
		let d = new RadialDimension([
			this.center.x, this.center.y,
			this.radius,
			this.angle,
			this.mode,
			this.textX,
			this.textY
		]);
		d.type 		= this.type;
		d.geometry	= this.geometry;
		d.penStyle	= this.penStyle;
		d.groupId	= this.groupId;
		return d;
	}

	copyFrom(other){
		this.center.x = other.center.x;
		this.center.y = other.center.y;
		this.radius = other.radius;
		this.angle = other.angle;
		this.mode = other.mode;
		this.textX = other.textX;
		this.textY = other.textY;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.update();
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if (!this.bounds.intersects(mouseRect)) return null;

		// Check if close to dimension line
		const point = VectorUtils.closestPointOnSegment(mouse, this.dimLineStart, this.dimLineEnd);

		if(VectorUtils.distFast(mouse, point) < pixelTolerance){
			return point;
		}
		return null;
	}

	// Translate the dimension by offset
	translate(dx, dy){
		TransformUtils.translatePointInPlace(this.center, dx, dy);
		this.update();
	}

	// Scale the dimension relative to an anchor point
	scale(anchorX, anchorY, factor){
		TransformUtils.scalePointInPlace(this.center, anchorX, anchorY, factor);
		this.radius *= Math.abs(factor);
		this.textOffset *= Math.abs(factor);
		this.update();
	}

	// Rotate the dimension around an anchor point by angle (in radians)
	rotate(anchorX, anchorY, angleRad) {
		TransformUtils.rotatePointInPlace(this.center, anchorX, anchorY, angleRad);
		this.angle += angleRad;
		this.update();
	}

	// Mirror the dimension across a line defined by two points
	mirror(x1, y1, x2, y2){
		TransformUtils.mirrorPointInPlace(this.center, x1, y1, x2, y2);
		// Mirror the angle
		const lineAngle = Math.atan2(y2 - y1, x2 - x1);
		this.angle = 2 * lineAngle - this.angle;
		this.update();
	}

	// Update a specific control point by index
	// POI indices: 0=center, 1=dimLineEnd (perimeter), 2=textPosition
	updateControlPoint(index, newX, newY){
		switch(index){
			case 0: // center - move the whole dimension (including text if set)
				const dx = newX - this.center.x;
				const dy = newY - this.center.y;
				this.center.x = newX;
				this.center.y = newY;
				// Also move text position if it's set
				if (this.textX !== null) {
					this.textX += dx;
					this.textY += dy;
				}
				break;
			case 1: // perimeter point - change angle
				this.angle = Math.atan2(newY - this.center.y, newX - this.center.x);
				break;
			case 2: // text position - set absolute position and update angle
				this.textX = newX;
				this.textY = newY;
				// Update angle so perimeter point is between center and text
				this.angle = Math.atan2(newY - this.center.y, newX - this.center.x);
				break;
		}
		this.update();
	}

	getInspectorSchema() {
		return {
			name: this.mode === 'diameter' ? 'Diameter Dimension' : 'Radius Dimension',
			sections: [
				{
					title: 'Value',
					fields: [
						{
							key: 'value',
							label: this.mode === 'diameter' ? 'Diameter' : 'Radius',
							type: 'readonly',
							get: () => this.value,
							precision: 2
						},
						{
							key: 'mode',
							label: 'Mode',
							type: 'select',
							options: [
								{ value: 'radius', label: 'Radius' },
								{ value: 'diameter', label: 'Diameter' }
							],
							get: () => this.mode,
							set: (v) => { this.mode = v; this.update(); }
						}
					]
				},
				{
					title: 'Position',
					fields: [
						{
							key: 'angleDeg',
							label: 'Angle',
							type: 'number',
							get: () => this.angle * 180 / Math.PI,
							set: (v) => { this.angle = v * Math.PI / 180; this.update(); },
							precision: 1,
							step: 5,
							suffix: '°'
						},
						{
							key: 'textOffset',
							label: 'Text Offset',
							type: 'number',
							precision: 1,
							step: 5,
							min: 0
						}
					]
				}
			]
		};
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			penStyle: this.penStyle,
			center: { x: this.center.x, y: this.center.y },
			radius: this.radius,
			angle: this.angle,
			mode: this.mode,
			textX: this.textX,
			textY: this.textY
		};
	}

	static fromJSON(data) {
		const dim = new RadialDimension([
			data.center.x, data.center.y,
			data.radius,
			data.angle || 0,
			data.mode || 'radius',
			data.textX !== undefined ? data.textX : null,
			data.textY !== undefined ? data.textY : null
		]);
		dim.type = data.type;
		if(data.penStyle) dim.penStyle = data.penStyle;
		return dim;
	}
}
