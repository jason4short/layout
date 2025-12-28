import {Tool} 		from './Tool.js';

import {Shape} 		from '../geometry/Geometry.js';
import {Circle} 	from '../geometry/Circle.js';
import stage 		from '../core/Stage.js';
import data 		from '../data/Data.js';

const MIN_RAD 		= 5; // intersections only snap if within 12px on screen

export class CircleTool extends Tool
{
	// private members
	constructor()
	{
		super();

		this.circle 				= false;
			
		this.minRadius 				= 5;

		this.onMouseMove 			= this.onMouseMove.bind(this);
		this.onMouseDown 			= this.onMouseDown.bind(this);
		this.onMouseUp 				= this.onMouseUp.bind(this);
		this.onKeyUp 				= this.onKeyUp.bind(this);
	}

	begin(){
		console.log("circle tool begin");
	
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseUp', this.onMouseUp);
		stage.addEventListener('mouseMove', this.onMouseMove);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		console.log("circle tool exit");
		stage.removeEventListener('keyUp', this.onKeyUp);
		stage.removeEventListener('mouseUp', this.onMouseUp);
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseDown', this.onMouseDown);
	}

	onKeyUp(e){
		//console.log("circle tool keyup");
		if(e.key === 'Escape' && this.circle){
			this.circle = false;
			stage.render();
		}
	}
	
	
	onMouseDown(e)
	{
// 		console.log("circle tool onMouseDown");
	
// 		this.mouseDownPoint 	= data.getCurrentSnapPoint();
// 		this.hasDragged 		= false;

		if(this.circle){
			// Second click: we’ll commit on mouseUp.

		}else{
			this.circle = data.getNewShape(Shape.CIRCLE);
			data.addTempShape(this.circle);
		}
	}

	onMouseMove(e)
	{
		if(!this.circle){
			return;
		}
		const currentPoint = data.getCurrentSnapPoint();
		this.circle.radius = this.distanceBetweenPoints(this.circle, currentPoint);

		stage.render();
	}

	onMouseUp(e)
	{
		if(this.circle.radius < MIN_RAD){
			// do nothing, we're still defining the circle

		}else{
			this.circle.update();
			data.addShape(this.circle)
			data.removeTempShape();
			this.circle = false;
			stage.render();
		}
		stage.render();
	}
}