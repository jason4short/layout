import {Shape, Geometry} 	from './Geometry.js';
import {Circle} 			from './Circle.js';
import {Point} 				from './Point.js';
import * as AngleUtils 		from './utils/AngleUtils.js';
import * as CircleUtils 	from './utils/CircleUtils.js';
import * as TransformUtils 	from './utils/TransformUtils.js';
import {arcSchema} 			from './InspectorSchemas.js';

export class Arc extends Circle
{
	constructor(params)
	{
		// params: [x, y, radius, startAngle, endAngle]
		super([params[0], params[1], params[2]]);
		this.geometry 	= Shape.ARC;
		this.startAngle = params[3];  // radians
		this.endAngle 	= params[4];  // radians
				
		this.startPt	= null;
		this.endPt 		= null;
		this.midPt 		= null;
		this.update()
	}

	clone(){
		const a 	= new Arc([this.x, this.y, this.radius, this.startAngle, this.endAngle]);
		a.type 		= this.type;
		a.groupId	= this.groupId;
		return a;
	}
	
	update(){
		this.POIs = [{ x: this.x, y: this.y }];  // center
		this.POIs.push(this.getPointAtAngle(this.startAngle));
		this.POIs.push(this.getPointAtAngle(this.endAngle));
		this.POIs.push(this.getPointAtAngle(this.getMidAngle()));

		// Only add quadrant points if they fall within the arc's angular range
		// Right (0°)
		if(this.containsAngle(0)){
			this.POIs.push({ x: this.x + this.radius, y: this.y });
		}
		// Left (π)
		if(this.containsAngle(Math.PI)){
			this.POIs.push({ x: this.x - this.radius, y: this.y });
		}
		// Bottom (π/2) - Y increases downward in screen coords
		if(this.containsAngle(Math.PI / 2)){
			this.POIs.push({ x: this.x, y: this.y + this.radius });
		}
		// Top (3π/2 or -π/2)
		if(this.containsAngle(-Math.PI / 2) || this.containsAngle(3 * Math.PI / 2)){
			this.POIs.push({ x: this.x, y: this.y - this.radius });
		}

		super.update();
	}
	copyFrom(other) {
		this.x 				= other.x;
		this.y 				= other.y;
		this.radius 		= other.radius;
		this.startAngle 	= other.startAngle;
		this.endAngle 		= other.endAngle;
		this.type 			= other.type;
		this.geometry 		= other.geometry;
		this.penStyle 		= other.penStyle;
		this.update();
	}

	// Check if an angle is within the arc's range
	containsAngle(angle) {
		return AngleUtils.isAngleInRange(angle, this.startAngle, this.endAngle);
	}

	// Get point on arc at given angle
	/*getPointAtAngle(angle) {
		return new Point(
			this.x + Math.cos(angle) * this.radius,
			this.y + Math.sin(angle) * this.radius
		);
	}*/
	
	// Get point on arc at given angle
	getPointAtAngle(angle) {
		return {
			x:this.x + Math.cos(angle) * this.radius,
			y:this.y + Math.sin(angle) * this.radius
		};
	}

	// Get the midpoint angle of the arc
	getMidAngle() {
		return AngleUtils.getMidAngle(this.startAngle, this.endAngle);
	}

	getSnapPOIs() {
		return this.POIs;
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if (!this.bounds.intersects(mouseRect)) {
			return null;
		}

		// If the arc is degenerate, it can't be snapped as geometry.
		if (this.radius <= 0) { return null; }

		const centerPoint = new Point(this.x, this.y);
		const distanceToCenter = this.distanceBetweenPoints(mouse, centerPoint);

		if (distanceToCenter === 0) { return null; }

		// How far the mouse is from the circle perimeter (radial error)
		const distanceFromPerimeter = Math.abs(distanceToCenter - this.radius);

		if (distanceFromPerimeter > pixelTolerance) { return null; }

		// Project the mouse direction onto the circle perimeter.
		const directionX = (mouse.x - this.x) / distanceToCenter;
		const directionY = (mouse.y - this.y) / distanceToCenter;

		// Check if the projected point is within the arc's angle range
		const angle = Math.atan2(directionY, directionX);
		if (!this.containsAngle(angle)) {
			return null;
		}

		const point = new Point(
			this.x + (directionX * this.radius),
			this.y + (directionY * this.radius)
		);

		point.distance = this.distanceBetweenPoints(mouse, point);

		return point;
	}

	// Arc length = radius * angle span
	length() {
		return CircleUtils.arcLength(this.radius, this.startAngle, this.endAngle);
	}

	getInspectorSchema() {
		return arcSchema(this);
	}

	// Static factory: Calculate arc parameters from 3 points
	static calculateArcFrom3Points(p1, p2, p3) {
		return CircleUtils.calculateArcFrom3Points(p1, p2, p3);
	}

	// Static helper: Check if angle is in range from start to end (counterclockwise)
	static angleInRange(angle, start, end) {
		return AngleUtils.isAngleInRange(angle, start, end);
	}

	// Scale the arc relative to an anchor point
	scale(anchorX, anchorY, factor){
		const scaled = TransformUtils.scalePoint(this.x, this.y, anchorX, anchorY, factor);
		this.x = scaled.x;
		this.y = scaled.y;
		this.radius = this.radius * Math.abs(factor);
		this.update();
	}

	// Rotate the arc around an anchor point by angle (in radians)
	rotate(anchorX, anchorY, angleRad) {
		const rotated = TransformUtils.rotatePoint(this.x, this.y, anchorX, anchorY, angleRad);
		this.x = rotated.x;
		this.y = rotated.y;
		// Rotate the arc angles too
		this.startAngle += angleRad;
		this.endAngle += angleRad;
		this.update();
	}

	// Mirror the arc across a line defined by two points
	mirror(x1, y1, x2, y2){
		// Mirror center
		const mirrored = TransformUtils.mirrorPoint(this.x, this.y, x1, y1, x2, y2);
		this.x = mirrored.x;
		this.y = mirrored.y;

		// Mirror line angle
		const lineAngle = TransformUtils.getMirrorLineAngle(x1, y1, x2, y2);

		// Reflect angles across the mirror line and swap (direction reverses)
		const newStart = TransformUtils.mirrorAngle(this.endAngle, lineAngle);
		const newEnd = TransformUtils.mirrorAngle(this.startAngle, lineAngle);
		this.startAngle = newStart;
		this.endAngle = newEnd;

		this.update();
	}

	// Update a specific control point by index
	// POI indices: 0=center, 1=start endpoint, 2=end endpoint, 3=midpoint
	updateControlPoint(index, newX, newY){
		switch(index){
			case 0: // center - move the arc
				this.x = newX;
				this.y = newY;
				break;
			case 1: // start endpoint - change startAngle and radius
				this.startAngle = Math.atan2(newY - this.y, newX - this.x);
				this.radius = Math.sqrt(
					Math.pow(newX - this.x, 2) +
					Math.pow(newY - this.y, 2)
				);
				break;
			case 2: // end endpoint - change endAngle and radius
				this.endAngle = Math.atan2(newY - this.y, newX - this.x);
				this.radius = Math.sqrt(
					Math.pow(newX - this.x, 2) +
					Math.pow(newY - this.y, 2)
				);
				break;
			case 3: // midpoint - change radius only
				this.radius = Math.sqrt(
					Math.pow(newX - this.x, 2) +
					Math.pow(newY - this.y, 2)
				);
				break;
		}
		this.update();
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			penStyle: this.penStyle,
			x: this.x,
			y: this.y,
			radius: this.radius,
			startAngle: this.startAngle,
			endAngle: this.endAngle
		};
	}

	static fromJSON(data) {
		const arc = new Arc([data.x, data.y, data.radius, data.startAngle, data.endAngle]);
		arc.type = data.type;
		if(data.penStyle) arc.penStyle = data.penStyle;
		return arc;
	}

	draw(ctx, renderer) {
		const center = renderer.toScreen(this.x, this.y);
		const radius = renderer.toScreenScale(this.radius);

		ctx.arc(center.x, center.y, radius, this.startAngle, this.endAngle);
		ctx.stroke();
		renderer.resetPenStyle(ctx);
	}
}
