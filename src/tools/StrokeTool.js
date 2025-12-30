import {Shape} 			from '../geometry/Geometry.js';
import {Tool} 			from "./Tool.js";
import {Line} 			from '../geometry/Line.js'
import {Construction} 	from '../geometry/Construction.js'
import stage 			from '../core/Stage.js';
import data 			from '../data/Data.js';

export class StrokeTool extends Tool
{
	// private members

	constructor()
	{
		super();
		this.drawing = false;
		this.Line = false;

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
		this.onKeyDown 			= this.onKeyDown.bind(this);
		this.onKeyUp 			= this.onKeyUp.bind(this);
	}

	
	begin(){
		//console.log("begin Stroke Tool");
		stage.addEventListener('keyUp', 		this.onKeyUp);
		stage.addEventListener('mouseUp', 		this.onMouseUp);
		stage.addEventListener('mouseMove', 	this.onMouseMove);
		stage.addEventListener('mouseDown', 	this.onMouseDown);
	}

	exit(){
		//console.log("exit Stroke Tool");
		stage.removeEventListener('keyUp', 		this.onKeyUp);
		stage.removeEventListener('mouseUp', 	this.onMouseUp);
		stage.removeEventListener('mouseMove', 	this.onMouseMove);
		stage.removeEventListener('mouseDown', 	this.onMouseDown);
	}
	
	onKeyUp(e){
	}

	onMouseDown(e)
	{
		this.line = new Line([data.snapPoint.x, data.snapPoint.y, data.snapPoint.x, data.snapPoint.y]);
// 		this.line = data.getNewShape(shape.LINE);
	}
	
	onMouseMove(e){
// 		if(this.line){
// 			this.line.end.x = e.x
// 			this.line.end.y = e.y
// 		}
	}


	onMouseUp(e){
		if(this.line){
			this.line.end.x = e.x
			this.line.end.y = e.y

			const angleDeg = this.line.getAngleDeg();
			const gesture = this.determineGestureFromAngle(angleDeg);
			//console.log("angleDeg:", angleDeg.toFixed(2), "gesture:", gesture);
			
			if(gesture == 'up' || gesture == 'down'){
				data.addConstruction(new Construction([this.line.start.x, this.line.start.y, 90]));
	
			}else if (gesture == 'right' || gesture == 'left'){
				data.addConstruction(new Construction([this.line.start.x, this.line.start.y, 0]));
	
			}else if (gesture == 'upLeft'){
				// zoom out
			
			}else if (gesture == 'downRight'){
				// zoom in
				
			}
			
			this.line = false;
		}
		stage.render();		
	}
	
	
	determineGestureFromAngle(angleDeg){
		// Normalize to [0, 360)
		let normalizedAngle = angleDeg % 360;
		if(normalizedAngle < 0){ normalizedAngle += 360; }
	
		// Shift so sector centers align with multiples of 45° (±22.5° boundaries)
		// Rounding to nearest multiple of 45° gives the correct sector.
		const sectorIndex = Math.round(normalizedAngle / 45) % 8;
	
		const sectorToGesture = [
			"right",     // 0 × 45° → 0°   (E)
			"upRight",   // 1 × 45° → 45°  (NE)
			"up",        // 2 × 45° → 90°  (N)
			"upLeft",    // 3 × 45° → 135° (NW)
			"left",      // 4 × 45° → 180° (W)
			"downLeft",  // 5 × 45° → 225° (SW)
			"down",      // 6 × 45° → 270° (S)
			"downRight"  // 7 × 45° → 315° (SE)
		];
	
		return sectorToGesture[sectorIndex];
	}

}

