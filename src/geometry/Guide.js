import {Shape, Geometry} 	from './Geometry.js';
import {Line} 				from './Line.js';
import {Construction} 		from './Construction.js';

export class Guide extends Line
{
	constructor(params)
	{
		const x 			= params[0];
		const y 			= params[1];
		const angleDeg 		= params[2];
		const guideLength 	= params[3];
		let dx, dy; 
		
		switch (angleDeg){
			case 90:
				dx = 0;
				dy = -guideLength;
				break;
						
			case 0:
				dx = guideLength;
				dy = 0;
				break;
			
			case -45:
				dx = .707 * guideLength;
				dy = -.707 * guideLength;
				break;
			
			case 45:
				dx = .707 * guideLength;
				dy = .707 * guideLength;
				break;

			default:
				const angleRad = angleDeg * (Math.PI / 180);
				dx = Math.cos(angleRad) * guideLength;
				dy = -Math.sin(angleRad) * guideLength; // Negative because Y is flipped in canvas
		}
		
		super([		x - dx,
				 	y - dy,
				 	x + dx,
				 	y + dy]);
				 	
		this.type 		= Shape.GUIDE
	}
}
