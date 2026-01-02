import { Shape } from './Geometry.js';

export class Point
{
	// private members

	constructor(x = 0, y = 0)
	{
		this.x 			= x;
		this.y 			= y;
		this.shape		= null;
		this.distance	= null;
	}
	
	clone(){
		let p = new Point(this.x, this.y);
		p.shape = this.shape;
		p.distance = this.distance;
		return p;
	}
	
}



