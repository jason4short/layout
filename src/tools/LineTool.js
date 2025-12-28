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
		this.onKeyDown 			= this.onKeyDown.bind(this);
		this.onKeyUp 			= this.onKeyUp.bind(this);
		this.updateDimension 	= this.updateDimension.bind(this);
	}
	
	begin(){
		console.log("begin Line Tool");
		stage.addEventListener('keyUp', 		this.onKeyUp);
		stage.addEventListener('mouseUp', 		this.onMouseUp);
		stage.addEventListener('mouseMove',		this.onMouseMove);
		stage.addEventListener('mouseDown',		this.onMouseDown);
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
		if(this.line){
		
		}else{
			this.line = data.getNewShape(Shape.LINE);
			data.addTempShape(this.line);
		}
		//stage.render();
	}
	
	onMouseMove(e){
		//console.log(data.snapPoint.x)
		if(this.line){
			this.line.end.x = data.snapPoint.x
			this.line.end.y = data.snapPoint.y
			stage.render();
		}
	}

	onMouseUp(e){
		if(this.line.length() < 5){
			// do nothing, we're still defining the line		
		}else{
			this.line.update();
			data.addShape(this.line)
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

