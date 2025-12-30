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
		this.prevCircle 			= null;
		this.lastDiameter 			= 50;  // Default diameter for option-click

		this.minRadius 				= 5;

		this.onMouseMove 			= this.onMouseMove.bind(this);
		this.onMouseDown 			= this.onMouseDown.bind(this);
		this.onMouseUp 				= this.onMouseUp.bind(this);
		this.onKeyUp 				= this.onKeyUp.bind(this);
		this.updateDiameter 		= this.updateDiameter.bind(this);
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
		// Option-click: create circle with stored diameter at click point
		if(stage.optionKey){
			const snapPt = data.getCurrentSnapPoint();
			const circle = new Circle([snapPt.x, snapPt.y, this.lastDiameter / 2]);
			data.addShape(circle);
			this.prevCircle = circle;
			stage.setInputCallback(this.updateDiameter);
			stage.setDimensionInputValue(this.lastDiameter);
			stage.render();
			return;
		}

		if(this.circle){
			// Second click: we'll commit on mouseUp.

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
		if(!this.circle) return;

		if(this.circle.radius < MIN_RAD){
			// do nothing, we're still defining the circle

		}else{
			this.circle.update();
			data.addShape(this.circle);
			data.removeTempShape();

			// Store for diameter editing
			this.prevCircle = this.circle;
			this.lastDiameter = this.circle.radius * 2;

			// Show diameter in input field
			stage.setInputCallback(this.updateDiameter);
			stage.setDimensionInputValue(this.lastDiameter);

			this.circle = false;
		}
		stage.render();
	}

	updateDiameter(newDiameter)
	{
		const d = parseFloat(newDiameter);
		if(isNaN(d) || d <= 0) return;

		if(this.prevCircle){
			this.prevCircle.radius = d / 2;
			this.prevCircle.update();
			stage.render();
		}

		// Always update stored diameter for next option-click
		this.lastDiameter = d;
	}
}