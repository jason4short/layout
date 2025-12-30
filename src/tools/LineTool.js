import {Tool} 	from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Line} 	from '../geometry/Line.js'
import stage 	from '../core/Stage.js';
import data 	from '../data/Data.js';

export class LineTool extends Tool
{
	// private members

	constructor()
	{
		super();
		this.line 				= false;
		this.prevLine 			= false;

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
		//this.onKeyDown 			= this.onKeyDown.bind(this);
		this.onKeyUp 			= this.onKeyUp.bind(this);
		this.updateDimension 	= this.updateDimension.bind(this);
	}
	
	begin(){
		console.log("begin Line Tool");
		stage.addEventListener('mouseDown',		this.onMouseDown);
		stage.addEventListener('mouseMove',		this.onMouseMove);
	}

	exit(){
		console.log("exit Line Tool");
		stage.removeEventListener('keyUp', 		this.onKeyUp);
		stage.removeEventListener('mouseUp', 	this.onMouseUp);
		stage.removeEventListener('mouseMove', 	this.onMouseMove);
		stage.removeEventListener('mouseDown', 	this.onMouseDown);
	}
	
	onKeyUp(e){
		if (e.key === 'Escape' && this.line){
			this.line = false;
			stage.render();
		}
	}

	onMouseDown(e)
	{
		stage.addEventListener('keyUp', 		this.onKeyUp);
		stage.addEventListener('mouseUp', 		this.onMouseUp);

		if(this.line){
			// we're in 2-click mode
			console.log("2-click mode")
		}else{
			console.log("start line")
			this.line = data.getNewShape(Shape.LINE);
			data.addTempShape(this.line);
		}
		//stage.render();
	}
	
	onMouseMove(e){
		//console.log("move!")
		//console.log(data.snapPoint.x)

		if(this.line){
			console.log("rubber band me")
			this.line.end.x = data.snapPoint.x
			this.line.end.y = data.snapPoint.y
			stage.render();
		}
	}

	onMouseUp(e){
		stage.removeEventListener('keyUp', 		this.onKeyUp);
		stage.removeEventListener('mouseUp', 	this.onMouseUp);
// 		stage.removeEventListener('mouseMove', 	this.onMouseMove);
		
		if(!this.line)return;
		
		this.line.end.x = data.snapPoint.x
		this.line.end.y = data.snapPoint.y
		
		if(this.line.length() < 5){
			console.log("its a click! ")
			// do nothing, we're still defining the line		
		}else{
			console.log("its a line! ")
			this.line.update();
			data.addShape(this.line);
			data.removeTempShape();
			stage.render();
			stage.setInputCallback(this.updateDimension)
			stage.setDimensionInputValue(this.line.length());
			this.prevLine = this.line;
			this.line = false;
		}
	}
	
	updateDimension(newDim){
		this.prevLine.scaleToDim(newDim);
		stage.render();
	}	
}

