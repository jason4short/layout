import {Shape} 			from '../geometry/Geometry.js';
import {Tool} 			from "./Tool.js";
import {Line} 			from '../geometry/Line.js'
import {Construction} 	from '../geometry/Construction.js'
import {Rectangle} 		from '../geometry/Rectangle.js'

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';

export class StrokeTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.name 	= "Gesture";
		this.usage 	= "Draw gestures to create construction lines or trigger commands.";
		this.cursor = "cursor_gesture";

		this.generateGuides = false;

		this.active 		= false;

		this.drawing 		= false;
		this.Line 			= false;

		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}


	activate(){
		data.resetSnaps();		
		this.active 		= true;
		console.log("begin Stroke Tool");
// 		toolManager.addEventListener('mouseUp', 		this.onMouseUp);
// 		toolManager.addEventListener('mouseMove', 	this.onMouseMove);
// 		toolManager.addEventListener('mouseDown', 	this.onMouseDown);
	}

	deactivate(){
		console.log("exit Stroke Tool");
		this.active 		= false;
// 		toolManager.removeEventListener('mouseUp', 	this.onMouseUp);
// 		toolManager.removeEventListener('mouseMove', 	this.onMouseMove);
// 		toolManager.removeEventListener('mouseDown', 	this.onMouseDown);
	}


	onMouseDown(e)
	{
		this.line = new Line([data.snapPoint.x, data.snapPoint.y, data.snapPoint.x, data.snapPoint.y]);
// 		this.line = data.getNewShape(shape.LINE);
	}
	
	onMouseMove(e){
		if(this.line){
			this.line.end.x = e.x;
			this.line.end.y = e.y;

			// Show zoom box preview for downRight gesture
			const x = Math.min(this.line.start.x, this.line.end.x);
			const y = Math.min(this.line.start.y, this.line.end.y);
			const width = Math.abs(this.line.end.x - this.line.start.x);
			const height = Math.abs(this.line.end.y - this.line.start.y);

			stage.renderer.zoomRect = new Rectangle(x, y, width, height);
			stage.render();
		}
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
				// Zoom out - pop view stack
				stage.popView();

			}else if (gesture == 'downRight'){
				// Zoom into box defined by gesture
				const x = Math.min(this.line.start.x, this.line.end.x);
				const y = Math.min(this.line.start.y, this.line.end.y);
				const width = Math.abs(this.line.end.x - this.line.start.x);
				const height = Math.abs(this.line.end.y - this.line.start.y);

				// Only zoom if box has meaningful size
				if(width > 10 && height > 10){
					stage.zoomToRect(new Rectangle(x, y, width, height));
				}

			}else if (gesture == 'upRight'){
				data.deleteConstructions();
			}else if (gesture == 'downLeft'){
				toolManager.dispatchEvent('keyUp', {key:'v'});
			}
			
			this.line = false;
			stage.renderer.zoomRect = null;
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

