import {Shape, Geometry} from './Geometry.js';
import {Point} from './Point.js';
import {Line} from './Line.js';

const GUIDE_LENGTH = 10000; // Large enough to appear infinite

// params: [x, y, angleDegrees]
export class Construction extends Line
{
	constructor(params)
	{
		const x = params[0];
		const y = params[1];
		const angleDeg = params[2];
		const angleRad = angleDeg * (Math.PI / 180);

		// Calculate endpoints extending in both directions from origin point
		const dx = Math.cos(angleRad) * GUIDE_LENGTH;
		const dy = -Math.sin(angleRad) * GUIDE_LENGTH; // Negative because Y is flipped in canvas

		const sx = x - dx;
		const sy = y - dy;
		const ex = x + dx;
		const ey = y + dy;

		super([sx, sy, ex, ey]);

		this.angle = angleDeg;
		this.type = Shape.CONSTRUCTION;
	}

	init(){
	}

	getAngleRadians(){
		return this.angle * (Math.PI / 180);
	}

	getAngleDeg(){
		return this.angle;
	}

	toJSON() {
		return {
			geometry: this.geometry,
			type: this.type,
			x: this.mid.x,
			y: this.mid.y,
			angle: this.angle
		};
	}

	static fromJSON(data) {
		return new Construction([data.x, data.y, data.angle]);
	}
}
