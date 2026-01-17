import {Tool} 				from './Tool.js';
import {Shape} 				from '../geometry/Geometry.js';
import {Line} 				from '../geometry/Line.js'
import {AddShapeCommand} 	from '../core/Commands.js';

import stage 				from '../core/Stage.js';
import toolManager			from './ToolManager.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';

export class LineTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.name 	= "Line";
		this.usage 	= "Click to set start point, drag or click again to set end point. Press Escape to cancel.";

		this.line 				= false;
		this.prevLine 			= false;

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);

		this.updateDimension 	= this.updateDimension.bind(this);
	}
	
	begin(){
		//console.log("begin Line Tool");
	}

	exit(){
		//console.log("exit Line Tool");
	}
	
	updateCursor(){
		stage.setCursor('crosshair');
	}

	reset(){
		if(this.line)
			this.line = false
		data.resetSnaps();
		data.clearGuides();
		data.clearTempShapes();
		stage.render();
	}

	onMouseDown(e)
	{
		data.resetSnaps();

		if(this.line){
			// we're in 2-click mode
		}else{
			this.line = data.getNewShape(Shape.LINE);
			data.addTempShape(this.line);
			// create a guide reference from initial point
			draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);
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

		if(!this.line)return;
		
		// Check minimum length in screen pixels (not world units)
		const screenLength = stage.worldToScreenScale(this.line.length());
		if(screenLength < 5){
			// do nothing, we're still defining the line
		}else{
			this.line.update();
			undoManager.execute(new AddShapeCommand(this.line));
			stage.setInputCallback(this.updateDimension)
			stage.setDimensionInputValue(this.line.length());
			this.prevLine 	= this.line;
			this.reset()
		}
	}
	
	updateDimension(newDim){
		this.prevLine.scaleToDim(newDim);
		stage.render();
	}	
}

