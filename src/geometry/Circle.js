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
	
}

