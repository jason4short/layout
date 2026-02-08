import {Point} 				from './Point.js';
import {Shape,
		Geometry,
		PenStyle,
		SnapType} 			from './Geometry.js';

import * as VectorUtils 	from './utils/VectorUtils.js';
import {serializeDimension, deserializeDimension} from './GeometrySerializers.js';
import { dimensionSchema } from './InspectorSchemas.js';
import units 				from '../core/Units.js';

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

		// Constraint: 'none' (free), 'horizontal' (X-axis), 'vertical' (Y-axis)
		this.constraint	= params[5] || 'none';

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
		if (this.constraint === 'horizontal') {
			this._updateHorizontal();
		} else if (this.constraint === 'vertical') {
			this._updateVertical();
		} else {
			this._updateFree();
		}

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

	_updateFree(){
		// Calculate the measured distance
		this.value = VectorUtils.distance(this.start, this.end);

		// Calculate direction vector along the measurement
		const dx = this.end.x - this.start.x;
		const dy = this.end.y - this.start.y;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len > 0) {
			const unitX = dx / len;
			const unitY = dy / len;
			this.perpendicular.x = -unitY;
			this.perpendicular.y = unitX;
		}

		this._calculateGeometry();
	}

	_updateHorizontal(){
		// Horizontal dim: measure X distance, extension lines are vertical
		this.value = Math.abs(this.end.x - this.start.x);
		this.perpendicular.x = 0;
		this.perpendicular.y = 1;

		// Dim line runs horizontally at y = start.y + offset
		const dimY = this.start.y + this.offset;
		this.dimLineStart.x = this.start.x;
		this.dimLineStart.y = dimY;
		this.dimLineEnd.x = this.end.x;
		this.dimLineEnd.y = dimY;

		// Text position at midpoint
		this.textPosition.x = (this.start.x + this.end.x) / 2;
		this.textPosition.y = dimY;

		// Extension lines run vertically from each point to the dim line
		this._calculateConstrainedExtensionLines();
	}

	_updateVertical(){
		// Vertical dim: measure Y distance, extension lines are horizontal
		this.value = Math.abs(this.end.y - this.start.y);
		this.perpendicular.x = 1;
		this.perpendicular.y = 0;

		// Dim line runs vertically at x = start.x + offset
		const dimX = this.start.x + this.offset;
		this.dimLineStart.x = dimX;
		this.dimLineStart.y = this.start.y;
		this.dimLineEnd.x = dimX;
		this.dimLineEnd.y = this.end.y;

		// Text position at midpoint
		this.textPosition.x = dimX;
		this.textPosition.y = (this.start.y + this.end.y) / 2;

		// Extension lines run horizontally from each point to the dim line
		this._calculateConstrainedExtensionLines();
	}

	_calculateConstrainedExtensionLines(){
		const gap = 6;       // Fixed gap from control point (world units)
		const overrun = 3;   // Fixed overrun past dim line (world units)

		if (this.constraint === 'horizontal') {
			const dimY = this.dimLineStart.y;
			const sign1 = dimY >= this.start.y ? 1 : -1;
			this.extLine1Start.x = this.start.x;
			this.extLine1Start.y = this.start.y + sign1 * gap;
			this.extLine1End.x = this.start.x;
			this.extLine1End.y = dimY + sign1 * overrun;

			const sign2 = dimY >= this.end.y ? 1 : -1;
			this.extLine2Start.x = this.end.x;
			this.extLine2Start.y = this.end.y + sign2 * gap;
			this.extLine2End.x = this.end.x;
			this.extLine2End.y = dimY + sign2 * overrun;
		} else {
			const dimX = this.dimLineStart.x;
			const sign1 = dimX >= this.start.x ? 1 : -1;
			this.extLine1Start.x = this.start.x + sign1 * gap;
			this.extLine1Start.y = this.start.y;
			this.extLine1End.x = dimX + sign1 * overrun;
			this.extLine1End.y = this.start.y;

			const sign2 = dimX >= this.end.x ? 1 : -1;
			this.extLine2Start.x = this.end.x + sign2 * gap;
			this.extLine2Start.y = this.end.y;
			this.extLine2End.x = dimX + sign2 * overrun;
			this.extLine2End.y = this.end.y;
		}
	}

	_calculateGeometry(){
		// Calculate dimension line endpoints (offset from start/end)
		this.dimLineStart.x = this.start.x + this.perpendicular.x * this.offset;
		this.dimLineStart.y = this.start.y + this.perpendicular.y * this.offset;
		this.dimLineEnd.x = this.end.x + this.perpendicular.x * this.offset;
		this.dimLineEnd.y = this.end.y + this.perpendicular.y * this.offset;

		// Text position at midpoint of dimension line
		this.textPosition.x = (this.dimLineStart.x + this.dimLineEnd.x) / 2;
		this.textPosition.y = (this.dimLineStart.y + this.dimLineEnd.y) / 2;

		// Extension lines - from measured points toward dimension line
		const gap = 6;       // Fixed gap from control point (world units)
		const overrun = 3;   // Fixed overrun past dim line (world units)

		const offsetSign = this.offset >= 0 ? 1 : -1;
		const absOffset = Math.abs(this.offset);

		this.extLine1Start.x = this.start.x + this.perpendicular.x * gap * offsetSign;
		this.extLine1Start.y = this.start.y + this.perpendicular.y * gap * offsetSign;
		this.extLine1End.x = this.start.x + this.perpendicular.x * (absOffset + overrun) * offsetSign;
		this.extLine1End.y = this.start.y + this.perpendicular.y * (absOffset + overrun) * offsetSign;

		this.extLine2Start.x = this.end.x + this.perpendicular.x * gap * offsetSign;
		this.extLine2Start.y = this.end.y + this.perpendicular.y * gap * offsetSign;
		this.extLine2End.x = this.end.x + this.perpendicular.x * (absOffset + overrun) * offsetSign;
		this.extLine2End.y = this.end.y + this.perpendicular.y * (absOffset + overrun) * offsetSign;
	}

	getSnapPOIs() {
		return [
			{ x: this.start.x, y: this.start.y, type: SnapType.ENDPOINT },
			{ x: this.end.x, y: this.end.y, type: SnapType.ENDPOINT },
			{ x: this.textPosition.x, y: this.textPosition.y, type: SnapType.ENDPOINT }
		];
	}

	getTransformablePoints() {
		return [this.start, this.end];
	}

	// Returns the measured distance
	length(){
		return this.value;
	}

	// Get formatted display text using the units system
	getDisplayText() {
		return units.format(this.value);
	}

	clone(){
		let d = new Dimension([
			this.start.x, this.start.y,
			this.end.x, this.end.y,
			this.offset,
			this.constraint
		]);
		d.type 		= this.type;
		d.geometry	= this.geometry;
		d.penStyle	= this.penStyle;
		d.colorToken= this.colorToken;
		d.groupId	= this.groupId;
		return d;
	}

	copyFrom(other){
		this.start.x = other.start.x;
		this.start.y = other.start.y;
		this.end.x = other.end.x;
		this.end.y = other.end.y;
		this.offset = other.offset;
		this.constraint = other.constraint;
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

	// translate() and rotate() inherited from Geometry base class

	// Scale - also scales offset
	scale(anchorX, anchorY, factor) {
		super.scale(anchorX, anchorY, factor);
		this.offset *= factor;
	}

	// Mirror - also flips offset direction
	mirror(x1, y1, x2, y2) {
		super.mirror(x1, y1, x2, y2);
		this.offset = -this.offset;
	}

	getInspectorSchema() {
		return dimensionSchema(this);
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
				if (this.constraint === 'horizontal') {
					this.offset = newY - this.start.y;
				} else if (this.constraint === 'vertical') {
					this.offset = newX - this.start.x;
				} else {
					const toNew = { x: newX - this.start.x, y: newY - this.start.y };
					this.offset = toNew.x * this.perpendicular.x + toNew.y * this.perpendicular.y;
				}
				break;
		}
		this.update();
	}

	toJSON() {
		return serializeDimension(this);
	}

	static fromJSON(data) {
		return deserializeDimension(data, Dimension);
	}

	draw(ctx, renderer) {
		const color = this.selected ? '#FF0000' : renderer.getPenStyleColor(this.penStyle);
		const arrowSize = 8;

		// Convert all points to screen coordinates
		const dimStart = renderer.toScreen(this.dimLineStart.x, this.dimLineStart.y);
		const dimEnd = renderer.toScreen(this.dimLineEnd.x, this.dimLineEnd.y);
		const textPos = renderer.toScreen(this.textPosition.x, this.textPosition.y);
		const ext1Start = renderer.toScreen(this.extLine1Start.x, this.extLine1Start.y);
		const ext1End = renderer.toScreen(this.extLine1End.x, this.extLine1End.y);
		const ext2Start = renderer.toScreen(this.extLine2Start.x, this.extLine2Start.y);
		const ext2End = renderer.toScreen(this.extLine2End.x, this.extLine2End.y);

		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineWidth = 0.5;

		// Draw extension lines
		ctx.beginPath();
		ctx.moveTo(ext1Start.x, ext1Start.y);
		ctx.lineTo(ext1End.x, ext1End.y);
		ctx.moveTo(ext2Start.x, ext2Start.y);
		ctx.lineTo(ext2End.x, ext2End.y);
		ctx.stroke();

		// Calculate direction vector for dimension line
		const dx = dimEnd.x - dimStart.x;
		const dy = dimEnd.y - dimStart.y;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len < 1) return;

		const unitX = dx / len;
		const unitY = dy / len;
		const perpX = -unitY;
		const perpY = unitX;

		// Get text dimensions for gap calculation
		ctx.font = '12px Arial';
		const displayText = this.getDisplayText('', 2);
		const textMetrics = ctx.measureText(displayText);
		const halfTextWidth = (textMetrics.width + 8) / 2;

		// Calculate gap in dimension line for text
		const gapStart = { x: textPos.x - unitX * halfTextWidth, y: textPos.y - unitY * halfTextWidth };
		const gapEnd = { x: textPos.x + unitX * halfTextWidth, y: textPos.y + unitY * halfTextWidth };

		// Draw dimension line with gap for text
		ctx.beginPath();
		ctx.moveTo(dimStart.x, dimStart.y);
		ctx.lineTo(gapStart.x, gapStart.y);
		ctx.moveTo(gapEnd.x, gapEnd.y);
		ctx.lineTo(dimEnd.x, dimEnd.y);
		ctx.stroke();

		// Draw arrows
		renderer.drawArrow(ctx, dimStart.x, dimStart.y, unitX, unitY, perpX, perpY, arrowSize);
		renderer.drawArrow(ctx, dimEnd.x, dimEnd.y, -unitX, -unitY, perpX, perpY, arrowSize);

		// Draw text
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

		const startPt = renderer.toScreen(this.start.x, this.start.y);
		ctx.beginPath();
		ctx.arc(startPt.x, startPt.y, handleRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		const endPt = renderer.toScreen(this.end.x, this.end.y);
		ctx.beginPath();
		ctx.arc(endPt.x, endPt.y, handleRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();

		// Text handle (diamond)
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
