import {Tool} 				from './Tool.js';
import { Shape, PenStyle } 	from '../geometry/Geometry.js';
import {Line} 				from '../geometry/Line.js'
import {AddShapesCommand, 
		MirrorCommand} 		from '../core/Commands.js';

import draftingAssistant 	from '../geometry/DraftingAssistant.js';
import stage 				from '../core/Stage.js';
import toolManager			from './ToolManager.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';

export class MirrorTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.name 	= "Line";
		this.usage 	= "Click to set start point, drag or click again to set end point. Press Escape to cancel.";

		this.generateGuides 	= false; // Enable snapping for move operations

		this.line 				= false;
		this.prevLine 			= false;

		// Preview
		this.previewShapes 		= [];
		this.selected 			= [];

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}
	
	begin(){
		//console.log("begin Line Tool");


		this.selected = data.getSelected();
		if(this.selected.length === 0){
			this.usage = "No shapes selected. Select shapes first, then use Mirror tool.";
		} else {
			this.usage = "Click first point of mirror line.";
		}
		toolManager.updateToolNameDisplay();
	}

	deactivate(){
		//console.log("exit Line Tool");
	}
	
	updateCursor(){
		stage.setCursor('crosshair');
	}

	reset(){
		if(this.line)
			this.line = false
		data.resetSnaps();
		data.clearTempShapes();
		this.usage = "Click first point of mirror line.";
		stage.render();
	}

	onMouseDown(e)
	{
		data.resetSnaps();
		this.selected = data.getSelected();
		if(this.line){
			// we're in 2-click mode
		}else{
			this.line = data.getNewShape(Shape.LINE);
			this.line.penStyle = PenStyle.CENTERLINE
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
			this.line.end.y = data.snapPoint.y;
			
			this.updatePreview();
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
			console.log("applyMirror")
			this.applyMirror();
			this.reset()
		}
	}

	updatePreview(){
		this.previewShapes = this.selected.map(shape => {
			const clone = shape.clone();
			clone.mirror(this.line.start.x, this.line.start.y, this.line.end.x, this.line.end.y);
			return clone;
		});

		// Add mirror line to preview
// 		const mirrorLine = new Line([
// 			this.line.start.x, this.line.start.y,
// 			this.line.end.x, this.line.end.y
// 		]);
		data.setTempShapes(this.previewShapes);
		data.addTempShape(this.line);
	}

	applyMirror(){
		//if(!this.lineStart || !this.lineEnd) return;

		const duplicate = stage.optionKey;

		if(duplicate){
			// Create mirrored copies
			const clones = [];
			for(const shape of this.selected){
				const clone = shape.clone();
				clone.mirror(this.line.start.x, this.line.start.y, this.line.end.x, this.line.end.y);
				clones.push(clone);
			}
			undoManager.execute(new AddShapesCommand(clones));
		} else {
			// Mirror in place (use command for undo support)
			undoManager.execute(new MirrorCommand(
				[...this.selected],
				this.line.start.x, this.line.start.y,
				this.line.end.x, this.line.end.y
			));
		}
	}



}

