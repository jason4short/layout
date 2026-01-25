import {Point} 				from './Point.js';
import {Shape,
		Geometry,
		PenStyle,
		SnapType} 			from './Geometry.js';

import * as VectorUtils 	from './utils/VectorUtils.js';
import * as TransformUtils 	from './utils/TransformUtils.js';
import {radialDimensionSchema} from './InspectorSchemas.js';
import {serializeRadialDimension, deserializeRadialDimension} from './GeometrySerializers.js';
import units 				from '../core/Units.js';

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
		return [
			{ x: this.center.x, y: this.center.y, type: SnapType.CENTER },
			{ x: this.dimLineEnd.x, y: this.dimLineEnd.y, type: SnapType.ENDPOINT },
			{ x: this.textPosition.x, y: this.textPosition.y, type: SnapType.ENDPOINT }
		];
	}

	// Returns the measured value (radius or diameter)
	length(){
		return this.value;
	}

	// Get formatted display text with R or diameter symbol
	getDisplayText() {
		const prefix = this.mode === 'diameter' ? '⌀' : 'R';
		return `${prefix}${units.format(this.value)}`;
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
		d.colorToken= this.colorToken;
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
		return radialDimensionSchema(this);
	}

	toJSON() {
		return serializeRadialDimension(this);
	}

	static fromJSON(data) {
		return deserializeRadialDimension(data, RadialDimension);
	}

	draw(ctx, renderer) {
		const color = this.selected ? '#FF0000' : '#111111';
		const arrowSize = 8;

		const center = renderer.toScreen(this.center.x, this.center.y);
		const dimStart = renderer.toScreen(this.dimLineStart.x, this.dimLineStart.y);
		const dimEnd = renderer.toScreen(this.dimLineEnd.x, this.dimLineEnd.y);
		const textPos = renderer.toScreen(this.textPosition.x, this.textPosition.y);

		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineWidth = 0.5;

		const dirX = Math.cos(this.angle);
		const dirY = Math.sin(this.angle);
		const perpX = -dirY;
		const perpY = dirX;

		ctx.font = '12px Arial';
		const displayText = this.getDisplayText('', 2);
		const textMetrics = ctx.measureText(displayText);
		const halfTextWidth = (textMetrics.width + 8) / 2;

		if (this.mode === 'radius') {
			// Leader line from perimeter to text position
			const textGap = halfTextWidth + 4;
			const lineLen = Math.sqrt(
				Math.pow(textPos.x - dimEnd.x, 2) + Math.pow(textPos.y - dimEnd.y, 2)
			);

			let lineEndX = textPos.x, lineEndY = textPos.y;
			if (lineLen > textGap) {
				const toDirX = (textPos.x - dimEnd.x) / lineLen;
				const toDirY = (textPos.y - dimEnd.y) / lineLen;
				lineEndX = textPos.x - toDirX * textGap;
				lineEndY = textPos.y - toDirY * textGap;
			}

			ctx.beginPath();
			ctx.moveTo(dimEnd.x, dimEnd.y);
			ctx.lineTo(lineEndX, lineEndY);
			ctx.stroke();

			renderer.drawArrow(ctx, dimEnd.x, dimEnd.y, dirX, dirY, perpX, perpY, arrowSize);
		} else {
			// Diameter mode
			const gapStart = { x: textPos.x - perpX * halfTextWidth, y: textPos.y - perpY * halfTextWidth };
			const gapEnd = { x: textPos.x + perpX * halfTextWidth, y: textPos.y + perpY * halfTextWidth };
			const textDistFromCenter = Math.sqrt(
				Math.pow(textPos.x - center.x, 2) + Math.pow(textPos.y - center.y, 2)
			);

			if (textDistFromCenter < 20) {
				ctx.beginPath();
				ctx.moveTo(dimStart.x, dimStart.y);
				ctx.lineTo(gapStart.x, gapStart.y);
				ctx.moveTo(gapEnd.x, gapEnd.y);
				ctx.lineTo(dimEnd.x, dimEnd.y);
				ctx.stroke();
			} else {
				ctx.beginPath();
				ctx.moveTo(dimStart.x, dimStart.y);
				ctx.lineTo(dimEnd.x, dimEnd.y);
				ctx.stroke();

				ctx.beginPath();
				ctx.moveTo(center.x, center.y);
				ctx.lineTo(textPos.x, textPos.y);
				ctx.stroke();
			}

			renderer.drawArrow(ctx, dimStart.x, dimStart.y, -dirX, -dirY, perpX, perpY, arrowSize);
			renderer.drawArrow(ctx, dimEnd.x, dimEnd.y, dirX, dirY, perpX, perpY, arrowSize);
		}

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(displayText, textPos.x, textPos.y);
	}

	drawHandles(ctx, renderer) {
		if (!this.showControlPoints) return;

		const handleRadius = 4;
		ctx.lineWidth = 0.5;
		ctx.strokeStyle = '#666666';
		ctx.fillStyle = '#FFFFFF';

		const center = renderer.toScreen(this.center.x, this.center.y);
		ctx.beginPath();
		ctx.arc(center.x, center.y, handleRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		const dimEnd = renderer.toScreen(this.dimLineEnd.x, this.dimLineEnd.y);
		ctx.beginPath();
		ctx.arc(dimEnd.x, dimEnd.y, handleRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		const textPos = renderer.toScreen(this.textPosition.x, this.textPosition.y);
		ctx.fillStyle = '#FFCC00';
		ctx.beginPath();
		ctx.moveTo(textPos.x, textPos.y - handleRadius);
		ctx.lineTo(textPos.x + handleRadius, textPos.y);
		ctx.lineTo(textPos.x, textPos.y + handleRadius);
		ctx.lineTo(textPos.x - handleRadius, textPos.y);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}
}
