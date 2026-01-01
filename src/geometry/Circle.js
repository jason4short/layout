import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';
	
export class Circle extends Geometry
{
	// private members

	constructor(params)
	{
		super();
		// this.init();		
		this.type 			= Shape.PLAIN;		
		this.geometry		= Shape.CIRCLE;
		
		this.x 				= params[0];
		this.y 				= params[1];
		this.radius 		= params[2];
		this.updateBoundingBox();
	}

	init(){
	}

	update(){
		this.updateBoundingBox();
	}

	updateBoundingBox()
	{
		this.bounds.x 		= this.x - this.radius;
		this.bounds.y 		= this.y - this.radius;
		this.bounds.width 	= this.radius * 2;
		this.bounds.height 	= this.radius * 2;
	}

	clone(){
		const c 	= new Circle([this.x, this.y, this.radius]);
		c.type 		= this.type;	
		return c;
	}
	
	getSnapPOIs() {
		return [
			{ x: this.x, y: this.y },
			{ x: this.x + this.radius, y: this.y },
			{ x: this.x - this.radius, y: this.y },
			{ x: this.x, y: this.y + this.radius},
			{ x: this.x, y: this.y - this.radius}
			
		];
	}
	
	getGeoSnap(mouse, mouseRect, pixelTolerance)
	{
		// Quick reject
		if(!this.bounds.intersects(mouseRect)){
			return null;
		}
		
		// If the circle is degenerate, it can’t be snapped as geometry.
		if(this.radius <= 0){return null;}

		const centerPoint = new Point(this.x, this.y);
		const distanceToCenter = this.distanceBetweenPoints(mouse, centerPoint);

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
		
		point.distance = this.distanceBetweenPoints(mouse, point);
		
		return point;
	}
	
	length() {
		return 2 * Math.PI * this.radius;
	}

	// Get tangent angle (in degrees) at a point on the circle
	// Tangent is perpendicular to the radius at that point
	getTangentAngle(point) {
		const radiusAngle = Math.atan2(point.y - this.y, point.x - this.x);
		// Tangent is perpendicular to radius (add 90°)
		const tangentAngle = radiusAngle + Math.PI / 2;
		return tangentAngle * (180 / Math.PI);
	}

	// Scale the circle relative to an anchor point
	scale(anchorX, anchorY, factor){
		this.x = anchorX + (this.x - anchorX) * factor;
		this.y = anchorY + (this.y - anchorY) * factor;
		this.radius = this.radius * Math.abs(factor);
		this.update();
	}

	// Mirror the circle across a line defined by two points
	mirror(x1, y1, x2, y2){
		const dx = x2 - x1;
		const dy = y2 - y1;
		const t = ((this.x - x1) * dx + (this.y - y1) * dy) / (dx * dx + dy * dy);
		const cx = x1 + t * dx;
		const cy = y1 + t * dy;
		this.x = 2 * cx - this.x;
		this.y = 2 * cy - this.y;
		// radius stays the same
		this.update();
	}

	// Update a specific control point by index
	// POI indices: 0=center, 1=right, 2=left, 3=bottom, 4=top
	updateControlPoint(index, newX, newY){
		switch(index){
			case 0: // center - move the circle
				this.x = newX;
				this.y = newY;
				break;
			case 1: // right quadrant
			case 2: // left quadrant
			case 3: // bottom quadrant
			case 4: // top quadrant
				// Calculate new radius from center to new point
				this.radius = Math.sqrt(
					Math.pow(newX - this.x, 2) +
					Math.pow(newY - this.y, 2)
				);
				break;
		}
		this.update();
	}
}

