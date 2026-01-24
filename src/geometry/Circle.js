import {Shape, Geometry, PenStyle} from './Geometry.js';
import {Point} from './Point.js';
import * as VectorUtils from './utils/VectorUtils.js';
import * as TransformUtils from './utils/TransformUtils.js';
import * as CircleUtils from './utils/CircleUtils.js';
import {circleSchema} from './InspectorSchemas.js';
import {serializeCircle, deserializeCircle} from './GeometrySerializers.js';

export class Circle extends Geometry
{
	constructor(params)
	{
		super();
		this.type 			= Shape.PLAIN;
		this.geometry		= Shape.CIRCLE;

		this.x 				= params[0];
		this.y 				= params[1];
		this.radius 		= params[2];
		this.radiusAngle	= params[3] !== undefined ? params[3] : 0; // Angle of radius control point (radians)
		this.update();
	}

	update(){
	
		// bounding box
		this.bounds.x 		= this.x - this.radius;
		this.bounds.y 		= this.y - this.radius;
		this.bounds.width 	= this.radius * 2;
		this.bounds.height 	= this.radius * 2;
	}

	clone(){
		const c 	= new Circle([this.x, this.y, this.radius, this.radiusAngle]);
		c.type 		= this.type;
		c.groupId	= this.groupId;
		c.penStyle	= this.penStyle;
		c.colorToken= this.colorToken;
		return c;
	}

	copyFrom(other) {
		this.x = other.x;
		this.y = other.y;
		this.radius = other.radius;
		this.radiusAngle = other.radiusAngle;
		this.type = other.type;
		this.geometry = other.geometry;
		this.penStyle = other.penStyle;
		this.update();
	}

	getSnapPOIs() {
		// POI 0 = center
		// POI 1 = radius control point at stored angle (selectable)
		// POI 2-5 = quadrant points for snapping (right, left, bottom, top)
		return [
			{ x: this.x, y: this.y },
			{
				x: this.x + Math.cos(this.radiusAngle) * this.radius,
				y: this.y + Math.sin(this.radiusAngle) * this.radius
			},
			{ x: this.x + this.radius, y: this.y },      // right
			{ x: this.x - this.radius, y: this.y },      // left
			{ x: this.x, y: this.y + this.radius },      // bottom
			{ x: this.x, y: this.y - this.radius }       // top
		];
	}

	/**
	 * Get control point type for tool behavior.
	 * POI 0 = center (move), POI 1 = radius (resize)
	 */
	getControlPointType(index) {
		return index === 1 ? 'resize' : 'move';
	}

	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if(!this.bounds.intersects(mouseRect)){
			return null;
		}

		// If the circle is degenerate, it can't be snapped as geometry.
		if(this.radius <= 0){return null;}

		const centerPoint = new Point(this.x, this.y);
		const distanceToCenter = VectorUtils.distance(mouse, centerPoint);

		if(distanceToCenter === 0){return null;}

		// How far the mouse is from the circle perimeter (radial error)
		const distanceFromPerimeter = Math.abs(distanceToCenter - this.radius);

		if(distanceFromPerimeter > pixelTolerance){return null;}

		// Project the mouse direction onto the circle perimeter.
		const directionX = (mouse.x - this.x) / distanceToCenter;
		const directionY = (mouse.y - this.y) / distanceToCenter;

		const point = new Point(
			this.x + (directionX * this.radius),
			this.y + (directionY * this.radius));

		point.distance = VectorUtils.distance(mouse, point);

		return point;
	}

	length() {
		return CircleUtils.circumference(this.radius);
	}

	getInspectorSchema() {
		return circleSchema(this);
	}

	// Get tangent angle (in degrees) at a point on the circle
	// Tangent is perpendicular to the radius at that point
	getTangentAngle(point) {
	
		// if point eq a POI, return precomputed tangent
		if(point.x == this.x && point.y == this.y){
			// center = no tangent
			return null;
		}else if (point.x == this.x){
			return (point.y > this.y) ? 90:-90;
		}else if (point.y == this.y){
			return (point.x > this.x) ? 0:180;
		}else 
			return CircleUtils.getTangentAngle(this.x, this.y, point.x, point.y);
	}

	// Translate the circle by offset
	translate(dx, dy){
		this.x += dx;
		this.y += dy;
		this.update();
	}

	// Scale the circle relative to an anchor point
	scale(anchorX, anchorY, factor){
		const scaled = TransformUtils.scalePoint(this.x, this.y, anchorX, anchorY, factor);
		this.x = scaled.x;
		this.y = scaled.y;
		this.radius = this.radius * Math.abs(factor);
		this.update();
	}

	// Rotate the circle around an anchor point by angle (in radians)
	rotate(anchorX, anchorY, angleRad) {
		const rotated = TransformUtils.rotatePoint(this.x, this.y, anchorX, anchorY, angleRad);
		this.x = rotated.x;
		this.y = rotated.y;
		// Rotate the radius control point angle too
		this.radiusAngle += angleRad;
		this.update();
	}

	// Mirror the circle across a line defined by two points
	mirror(x1, y1, x2, y2){
		const mirrored = TransformUtils.mirrorPoint(this.x, this.y, x1, y1, x2, y2);
		this.x = mirrored.x;
		this.y = mirrored.y;
		// Mirror the radius angle across the mirror line
		const lineAngle = Math.atan2(y2 - y1, x2 - x1);
		this.radiusAngle = 2 * lineAngle - this.radiusAngle;
		this.update();
	}

	// Update a specific control point by index
	// POI indices: 0=center, 1=radius control point
	updateControlPoint(index, newX, newY){
		switch(index){
			case 0: // center - move the circle
				this.x = newX;
				this.y = newY;
				break;
			case 1: // radius control point - update radius and angle
				this.radius = VectorUtils.distance({x: this.x, y: this.y}, {x: newX, y: newY});
				this.radiusAngle = Math.atan2(newY - this.y, newX - this.x);
				break;
		}
		this.update();
	}

	toJSON() {
		return serializeCircle(this);
	}

	static fromJSON(data) {
		return deserializeCircle(data, Circle);
	}

	draw(ctx, renderer) {
		const center = renderer.toScreen(this.x, this.y);
		const radius = renderer.toScreenScale(this.radius);

		// Optimization: when radius is huge, only draw visible arc
		// Skip for shapes in frames - screen coords don't include frame transform
		if (radius > 2000 && !this.frameId) {
			const angles = renderer.getVisibleArcAngles(center, radius);
			if (angles) {
				ctx.arc(center.x, center.y, radius, angles.start, angles.end);
			}
		} else {
			ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
		}
		ctx.stroke();
		renderer.resetPenStyle(ctx);
	}
}
