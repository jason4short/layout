import {Tool} 	from './Tool.js';
import {Shape} from '../geometry/Geometry.js';
import {Line} 	from '../geometry/Line.js'

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import {AddShapeCommand} from '../core/Commands.js';

export class LineTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.name 	= "Line";
		this.usage 	= "Click to set start point, drag or click again to set end point. Press Escape to cancel.";
		this.cursor = "cursor_crosshair";

		this.line 				= false;
		this.prevLine 			= false;

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);

		this.updateDimension 	= this.updateDimension.bind(this);
	}
	
	begin(){
		//console.log("begin Line Tool");
		toolManager.addEventListener('mouseDown',		this.onMouseDown);
		toolManager.addEventListener('mouseMove',		this.onMouseMove);
	}

	exit(){
		//console.log("exit Line Tool");
		toolManager.removeEventListener('mouseUp', 	this.onMouseUp);
		toolManager.removeEventListener('mouseMove', 	this.onMouseMove);
		toolManager.removeEventListener('mouseDown', 	this.onMouseDown);
	}
	
	reset(){
		toolManager.removeEventListener('mouseUp', this.onMouseUp);
		if(this.line)
			this.line = false
		data.resetSnaps();
		data.removeTempShape();
		stage.render();
	}

	onMouseDown(e)
	{
		data.resetSnaps();
		toolManager.addEventListener('mouseUp', 		this.onMouseUp);

		if(this.line){
			// we're in 2-click mode
		}else{
			this.line = data.getNewShape(Shape.LINE);
			data.addTempShape(this.line);
		}
	}
	
	onMouseMove(e){
		//console.log("move!")
		//console.log(data.snapPoint.x)

		if(this.line){
			this.line.end.x = data.snapPoint.x
			this.line.end.y = data.snapPoint.y
			stage.render();
		}
	}

	onMouseUp(e){
		data.resetSnaps();
		toolManager.removeEventListener('mouseUp', 	this.onMouseUp);
		
		if(!this.line)return;
		
		this.line.end.x = data.snapPoint.x
		this.line.end.y = data.snapPoint.y
		
		if(this.line.length() < 5){
			// do nothing, we're still defining the line
		}else{
			this.line.update();
			undoManager.execute(new AddShapeCommand(this.line));
			data.removeTempShape();
			stage.render();
			stage.setInputCallback(this.updateDimension)
			stage.setDimensionInputValue(this.line.length());
			this.prevLine 	= this.line;
			this.line 		= null;
		}
	}
	
	updateDimension(newDim){
		this.prevLine.scaleToDim(newDim);
		stage.render();
	}	
}

