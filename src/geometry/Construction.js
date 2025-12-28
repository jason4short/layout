import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';
import {Line} from './Line.js';

// params: [this.line.start.x, this.line.start.y, 90]
export class Construction extends Line
{
	constructor(params)
	{
		// vertical
		if(params[2] == 90){
			const sx	 	= params[0];
			const sy 		= - 1000;
			const ex 		= params[0];
			const ey 		= 1000;	
			super([sx, sy, ex, ey]);
			
		// Horizontal
		}else{
			const sx	 	= -1000;
			const sy 		= params[1];
			const ex 		= 1000;
			const ey 		= params[1];	
			super([sx, sy, ex, ey]);
		}
		this.angle  		= params[2];
		this.type 			= Shape.CONSTRUCTION;
	}

	init(){
	}

	getAngleRadians(){
		return this.angleDeg * (Math.PI / 180);
	}
	
	getAngleDeg(){
		return angleDeg;
	}
}
