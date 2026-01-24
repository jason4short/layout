import {Point} 				from './Point.js';
import {Shape,
		Geometry,
		PenStyle} 			from './Geometry.js';
import {GeometryUtils}		from './GeometryUtils.js';

import * as VectorUtils 	from './utils/VectorUtils.js';
import * as TransformUtils 	from './utils/TransformUtils.js';
import * as AngleUtils 		from './utils/AngleUtils.js';
import {angleDimensionSchema} from './InspectorSchemas.js';
import {serializeAngleDimension, deserializeAngleDimension} from './GeometrySerializers.js';

/**
 * Angle dimension between two lines.
 * Shows the angle at their intersection with an arc and degree value.
 */
export class AngleDimension extends Geometry
{
	constructor(params)
	{
		super();
		this.type 		= Shape.DIMENSION;
		this.geometry 	= Shape.ANGLE_DIMENSION;
		this.penStyle 	= PenStyle.DIMENSION;

		// Vertex (intersection point of the two lines)
		this.vertex		= new Point(params[0], params[1]);

		// Angles of the two lines from the vertex (radians)
		this.startAngle	= params[2] || 0;
		this.endAngle	= params[3] || Math.PI / 2;

		// Arc radius (distance from vertex)
		this.arcRadius	= params[4] || 40;

		// Click points on each line (where extension lines start)
		this.click1		= params[5] ? new Point(params[5].x, params[5].y) : null;
		this.click2		= params[6] ? new Point(params[6].x, params[6].y) : null;

		// References to the actual line objects (for live updates)
		this.line1		= params[7] || null;
		this.line2		= params[8] || null;

		// Computed geometry for rendering
		this.arcStart	= new Point(0, 0);  // Point on arc at startAngle
		this.arcEnd		= new Point(0, 0);  // Point on arc at endAngle
		this.textPosition = new Point(0, 0);

		// Extension line endpoints (from click points toward arc)
		this.ext1Start	= new Point(0, 0);
		this.ext1End	= new Point(0, 0);
		this.ext2Start	= new Point(0, 0);
		this.ext2End	= new Point(0, 0);

		// Calculated angle value in degrees
		this.value = 0;

		this.update();
	}

	/**
	 * Update dimension from referenced lines.
	 * Call this when lines have been edited to keep dimension in sync.
	 */
	updateFromLines() {
		if (!this.line1 || !this.line2) return;

		// Recalculate vertex from line intersection
		const newVertex = GeometryUtils.lineIntersection(this.line1, this.line2);
		if (newVertex) {
			this.vertex.x = newVertex.x;
			this.vertex.y = newVertex.y;
		}

		// Get line tangent angles
		const tangent1 = Math.atan2(
			this.line1.end.y - this.line1.start.y,
			this.line1.end.x - this.line1.start.x
		);
		const tangent2 = Math.atan2(
			this.line2.end.y - this.line2.start.y,
			this.line2.end.x - this.line2.start.x
		);

		// Determine correct direction for each angle (toward click points)
		if (this.click1) {
			const toClick1 = Math.atan2(
				this.click1.y - this.vertex.y,
				this.click1.x - this.vertex.x
			);
			// Use tangent1 or tangent1 + PI depending on which is closer to toClick1
			const diff1 = AngleUtils.normalizeAngle(tangent1 - toClick1);
			const diff1Opp = AngleUtils.normalizeAngle(tangent1 + Math.PI - toClick1);
			this.startAngle = Math.abs(diff1) < Math.abs(diff1Opp) ? tangent1 : tangent1 + Math.PI;

			// Project click1 onto line1
			const proj1 = GeometryUtils.projectPointOntoLine(this.click1, this.line1);
			if (proj1) {
				this.click1.x = proj1.x;
				this.click1.y = proj1.y;
			}
		} else {
			this.startAngle = tangent1;
		}

		if (this.click2) {
			const toClick2 = Math.atan2(
				this.click2.y - this.vertex.y,
				this.click2.x - this.vertex.x
			);
			const diff2 = AngleUtils.normalizeAngle(tangent2 - toClick2);
			const diff2Opp = AngleUtils.normalizeAngle(tangent2 + Math.PI - toClick2);
			this.endAngle = Math.abs(diff2) < Math.abs(diff2Opp) ? tangent2 : tangent2 + Math.PI;

			// Project click2 onto line2
			const proj2 = GeometryUtils.projectPointOntoLine(this.click2, this.line2);
			if (proj2) {
				this.click2.x = proj2.x;
				this.click2.y = proj2.y;
			}
		} else {
			this.endAngle = tangent2;
		}

		this.update();
	}

	update(){
		// Calculate the angle value (always positive, smaller angle)
		let angleDiff = this.endAngle - this.startAngle;

		// Normalize to [0, 2PI)
		while (angleDiff < 0) angleDiff += Math.PI * 2;
		while (angleDiff >= Math.PI * 2) angleDiff -= Math.PI * 2;

		// Store the sweep angle
		this.sweepAngle = angleDiff;

		// Convert to degrees for display
		this.value = angleDiff * (180 / Math.PI);

		// Calculate arc endpoints
		this.arcStart.x = this.vertex.x + Math.cos(this.startAngle) * this.arcRadius;
		this.arcStart.y = this.vertex.y + Math.sin(this.startAngle) * this.arcRadius;

		this.arcEnd.x = this.vertex.x + Math.cos(this.endAngle) * this.arcRadius;
		this.arcEnd.y = this.vertex.y + Math.sin(this.endAngle) * this.arcRadius;

		// Extension lines: from click points (with gap) to past the arc
		const gap = 3;  // Gap between click point marker and line start
		const extPastArc = this.arcRadius * 1.15;  // Minimum extension past arc

		if (this.click1) {
			// Direction from vertex along startAngle (outward)
			const dirX1 = Math.cos(this.startAngle);
			const dirY1 = Math.sin(this.startAngle);
			const distFromVertex1 = VectorUtils.distance(this.click1, this.vertex);

			// ext1Start: click point with gap toward vertex (so click marker is visible)
			this.ext1Start.x = this.click1.x - dirX1 * gap;
			this.ext1Start.y = this.click1.y - dirY1 * gap;

			// ext1End: extend past arc OR past click point, whichever is further
			const ext1Dist = Math.max(extPastArc, distFromVertex1 + 5);
			this.ext1End.x = this.vertex.x + dirX1 * ext1Dist;
			this.ext1End.y = this.vertex.y + dirY1 * ext1Dist;
		} else {
			// Fallback: from vertex outward
			this.ext1Start.x = this.vertex.x;
			this.ext1Start.y = this.vertex.y;
			this.ext1End.x = this.vertex.x + Math.cos(this.startAngle) * extPastArc;
			this.ext1End.y = this.vertex.y + Math.sin(this.startAngle) * extPastArc;
		}

		if (this.click2) {
			const dirX2 = Math.cos(this.endAngle);
			const dirY2 = Math.sin(this.endAngle);
			const distFromVertex2 = VectorUtils.distance(this.click2, this.vertex);

			// ext2Start: click point with gap toward vertex
			this.ext2Start.x = this.click2.x - dirX2 * gap;
			this.ext2Start.y = this.click2.y - dirY2 * gap;

			// ext2End: extend past arc OR past click point
			const ext2Dist = Math.max(extPastArc, distFromVertex2 + 5);
			this.ext2End.x = this.vertex.x + dirX2 * ext2Dist;
			this.ext2End.y = this.vertex.y + dirY2 * ext2Dist;
		} else {
			this.ext2Start.x = this.vertex.x;
			this.ext2Start.y = this.vertex.y;
			this.ext2End.x = this.vertex.x + Math.cos(this.endAngle) * extPastArc;
			this.ext2End.y = this.vertex.y + Math.sin(this.endAngle) * extPastArc;
		}

		// Text position at midpoint of arc, slightly outside
		const midAngle = this.startAngle + angleDiff / 2;
		const textRadius = this.arcRadius + 15;
		this.textPosition.x = this.vertex.x + Math.cos(midAngle) * textRadius;
		this.textPosition.y = this.vertex.y + Math.sin(midAngle) * textRadius;

		// Update bounding box - include click points
		let minX = this.vertex.x - extPastArc;
		let minY = this.vertex.y - extPastArc;
		let maxX = this.vertex.x + extPastArc;
		let maxY = this.vertex.y + extPastArc;

		if (this.click1) {
			minX = Math.min(minX, this.click1.x);
			minY = Math.min(minY, this.click1.y);
			maxX = Math.max(maxX, this.click1.x);
			maxY = Math.max(maxY, this.click1.y);
		}
		if (this.click2) {
			minX = Math.min(minX, this.click2.x);
			minY = Math.min(minY, this.click2.y);
			maxX = Math.max(maxX, this.click2.x);
			maxY = Math.max(maxY, this.click2.y);
		}

		const padding = 30;
		this.bounds.x = minX - padding;
		this.bounds.y = minY - padding;
		this.bounds.width = maxX - minX + padding * 2;
		this.bounds.height = maxY - minY + padding * 2;
	}

	getSnapPOIs() {
		// POIs: 0=vertex (not selectable), 1=click1, 2=click2, 3=textPosition
		return [
			this.vertex,
			this.click1 || this.arcStart,  // fallback if no click point
			this.click2 || this.arcEnd,
			this.textPosition
		];
	}

	// Returns the angle in degrees
	length(){
		return this.value;
	}

	// Get formatted display text
	getDisplayText(units = '', precision = 1) {
		return this.value.toFixed(precision) + '°';
	}

	clone(){
		let d = new AngleDimension([
			this.vertex.x, this.vertex.y,
			this.startAngle,
			this.endAngle,
			this.arcRadius,
			this.click1 ? { x: this.click1.x, y: this.click1.y } : null,
			this.click2 ? { x: this.click2.x, y: this.click2.y } : null,
			this.line1,
			this.line2
		]);
		d.type 		= this.type;
		d.geometry	= this.geometry;
		d.penStyle	= this.penStyle;
		d.colorToken= this.colorToken;
		d.groupId	= this.groupId;
		return d;
	}

	copyFrom(other){
		this.vertex.x = other.vertex.x;
		this.vertex.y = other.vertex.y;
		this.startAngle = other.startAngle;
		this.endAngle = other.endAngle;
		this.arcRadius = other.arcRadius;
		if (other.click1) {
			this.click1 = new Point(other.click1.x, other.click1.y);
		} else {
			this.click1 = null;
		}
		if (other.click2) {
			this.click2 = new Point(other.click2.x, other.click2.y);
		} else {
			this.click2 = null;
		}
		this.line1 = other.line1;
		this.line2 = other.line2;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.update();
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if (!this.bounds.intersects(mouseRect)) return null;

		// Check if close to arc
		const distFromVertex = VectorUtils.distance(mouse, this.vertex);
		const distFromArc = Math.abs(distFromVertex - this.arcRadius);

		if (distFromArc < pixelTolerance) {
			// Check if within the angle range
			const mouseAngle = Math.atan2(mouse.y - this.vertex.y, mouse.x - this.vertex.x);
			if (AngleUtils.isAngleInRange(mouseAngle, this.startAngle, this.endAngle)) {
				// Return point on arc
				return {
					x: this.vertex.x + Math.cos(mouseAngle) * this.arcRadius,
					y: this.vertex.y + Math.sin(mouseAngle) * this.arcRadius
				};
			}
		}
		return null;
	}

	// Translate the dimension
	translate(dx, dy){
		TransformUtils.translatePointInPlace(this.vertex, dx, dy);
		if (this.click1) TransformUtils.translatePointInPlace(this.click1, dx, dy);
		if (this.click2) TransformUtils.translatePointInPlace(this.click2, dx, dy);
		this.update();
	}

	// Scale the dimension relative to an anchor point
	scale(anchorX, anchorY, factor){
		TransformUtils.scalePointInPlace(this.vertex, anchorX, anchorY, factor);
		if (this.click1) TransformUtils.scalePointInPlace(this.click1, anchorX, anchorY, factor);
		if (this.click2) TransformUtils.scalePointInPlace(this.click2, anchorX, anchorY, factor);
		this.arcRadius *= Math.abs(factor);
		this.update();
	}

	// Rotate the dimension around an anchor point
	rotate(anchorX, anchorY, angleRad) {
		TransformUtils.rotatePointInPlace(this.vertex, anchorX, anchorY, angleRad);
		if (this.click1) TransformUtils.rotatePointInPlace(this.click1, anchorX, anchorY, angleRad);
		if (this.click2) TransformUtils.rotatePointInPlace(this.click2, anchorX, anchorY, angleRad);
		this.startAngle += angleRad;
		this.endAngle += angleRad;
		this.update();
	}

	// Mirror the dimension across a line
	mirror(x1, y1, x2, y2){
		TransformUtils.mirrorPointInPlace(this.vertex, x1, y1, x2, y2);
		if (this.click1) TransformUtils.mirrorPointInPlace(this.click1, x1, y1, x2, y2);
		if (this.click2) TransformUtils.mirrorPointInPlace(this.click2, x1, y1, x2, y2);
		const lineAngle = Math.atan2(y2 - y1, x2 - x1);
		this.startAngle = 2 * lineAngle - this.startAngle;
		this.endAngle = 2 * lineAngle - this.endAngle;
		// Swap to maintain direction
		const temp = this.startAngle;
		this.startAngle = this.endAngle;
		this.endAngle = temp;
		// Also swap click points
		const tempClick = this.click1;
		this.click1 = this.click2;
		this.click2 = tempClick;
		this.update();
	}

	// Update a specific control point by index
	// POI indices: 0=vertex (not selectable), 1=click1, 2=click2, 3=textPosition
	updateControlPoint(index, newX, newY){
		switch(index){
			case 0: // vertex - not selectable, but keep for compatibility
				this.vertex.x = newX;
				this.vertex.y = newY;
				break;
			case 1: // click1 - free 2D movement, updates startAngle direction
				if (this.click1) {
					this.click1.x = newX;
					this.click1.y = newY;
					// Update startAngle to point toward new click position
					this.startAngle = Math.atan2(newY - this.vertex.y, newX - this.vertex.x);
				}
				break;
			case 2: // click2 - free 2D movement, updates endAngle direction
				if (this.click2) {
					this.click2.x = newX;
					this.click2.y = newY;
					// Update endAngle to point toward new click position
					this.endAngle = Math.atan2(newY - this.vertex.y, newX - this.vertex.x);
				}
				break;
			case 3: // textPosition - change arc radius only (doesn't affect click points)
				this.arcRadius = Math.max(15, VectorUtils.distance({x: newX, y: newY}, this.vertex) - 15);
				break;
		}
		this.update();
	}

	getInspectorSchema() {
		return angleDimensionSchema(this);
	}

	toJSON() {
		return serializeAngleDimension(this);
	}

	static fromJSON(data) {
		return deserializeAngleDimension(data, AngleDimension);
	}

	draw(ctx, renderer) {
		const color = this.selected ? '#FF0000' : '#111111';
		const arrowSize = 8;

		// Convert points to screen coordinates
		const vertex = renderer.toScreen(this.vertex.x, this.vertex.y);
		const arcStart = renderer.toScreen(this.arcStart.x, this.arcStart.y);
		const arcEnd = renderer.toScreen(this.arcEnd.x, this.arcEnd.y);
		const ext1Start = renderer.toScreen(this.ext1Start.x, this.ext1Start.y);
		const ext1End = renderer.toScreen(this.ext1End.x, this.ext1End.y);
		const ext2Start = renderer.toScreen(this.ext2Start.x, this.ext2Start.y);
		const ext2End = renderer.toScreen(this.ext2End.x, this.ext2End.y);
		const textPos = renderer.toScreen(this.textPosition.x, this.textPosition.y);
		const arcRadius = renderer.toScreenScale(this.arcRadius);

		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineWidth = 0.5;

		// Draw extension lines from click points (with gap) to past the arc
		ctx.beginPath();
		ctx.moveTo(ext1Start.x, ext1Start.y);
		ctx.lineTo(ext1End.x, ext1End.y);
		ctx.moveTo(ext2Start.x, ext2Start.y);
		ctx.lineTo(ext2End.x, ext2End.y);
		ctx.stroke();

		// Draw arc between the two angles
		ctx.beginPath();
		ctx.arc(vertex.x, vertex.y, arcRadius, this.startAngle, this.endAngle);
		ctx.stroke();

		// Draw arrows at arc ends (pointing along the arc tangent)
		// Arrow at arcStart - tangent is perpendicular to radius, pointing CCW
		const tangent1X = -Math.sin(this.startAngle);
		const tangent1Y = Math.cos(this.startAngle);
		const perp1X = Math.cos(this.startAngle);
		const perp1Y = Math.sin(this.startAngle);
		renderer.drawArrow(ctx, arcStart.x, arcStart.y, tangent1X, tangent1Y, perp1X, perp1Y, arrowSize);

		// Arrow at arcEnd - tangent pointing CW (opposite)
		const tangent2X = Math.sin(this.endAngle);
		const tangent2Y = -Math.cos(this.endAngle);
		const perp2X = Math.cos(this.endAngle);
		const perp2Y = Math.sin(this.endAngle);
		renderer.drawArrow(ctx, arcEnd.x, arcEnd.y, tangent2X, tangent2Y, perp2X, perp2Y, arrowSize);

		// Draw text
		ctx.font = '12px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const displayText = this.getDisplayText();
		ctx.fillText(displayText, textPos.x, textPos.y);
	}

	drawHandles(ctx, renderer) {
		if (!this.showControlPoints) return;

		const handleRadius = 4;
		ctx.lineWidth = 0.5;
		ctx.strokeStyle = '#666666';
		ctx.fillStyle = '#FFFFFF';

		// Click point handles (draggable - these are the selectable control points)
		if (this.click1) {
			const click1Scr = renderer.toScreen(this.click1.x, this.click1.y);
			ctx.beginPath();
			ctx.arc(click1Scr.x, click1Scr.y, handleRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
		if (this.click2) {
			const click2Scr = renderer.toScreen(this.click2.x, this.click2.y);
			ctx.beginPath();
			ctx.arc(click2Scr.x, click2Scr.y, handleRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}

		// Text handle (diamond, draggable)
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

	/**
	 * Link line references by ID. Called after all shapes are loaded.
	 */
	linkLines(shapesById) {
		if (this._line1Id && shapesById.has(this._line1Id)) {
			this.line1 = shapesById.get(this._line1Id);
			delete this._line1Id;
		}
		if (this._line2Id && shapesById.has(this._line2Id)) {
			this.line2 = shapesById.get(this._line2Id);
			delete this._line2Id;
		}
	}
}
