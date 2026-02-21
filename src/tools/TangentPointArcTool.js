import {Tool} 				from './Tool.js';
import {Shape} 				from '../geometry/Geometry.js';
import {TangentArc} 		from '../geometry/TangentArc.js';
import {Line} 				from '../geometry/Line.js';

import stage 				from '../core/Stage.js';
import toolManager			from './ToolManager.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';

import {AddShapeCommand} from '../core/Commands.js';

const STATE = Object.freeze({
	START: 0,    // pick start point
	TANGENT: 1,  // pick tangent direction
	END: 2       // pick endpoint
});

export class TangentPointArcTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Tangent Arc";
		this.usage 	= "Click or drag to set tangent line, then click or drag to set end point.";

		this.arc 			= null;
		this.tangentLine	= null;
		this.startPoint 	= null;
		this.tangentPoint 	= null;
		this.state 			= STATE.START;

		// Drag support for start-to-tangent segment
		this.isDragging		= false;
		this.dragStart		= null;

		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
		//console.log("TangentPointArcTool begin");
	}

	deactivate(){
		//console.log("TangentPointArcTool exit");
		this.reset();
	}
	updateCursor(){
		stage.setCursor('crosshair');
		//stage.setCursor('arcTan');
	}

	reset(){
		this.arc = null;
		this.tangentLine = null;
		this.startPoint = null;
		this.tangentPoint = null;
		this.state = STATE.START;
		this.isDragging = false;
		this.dragStart = null;
		data.clearTempShapes();
	}

	onMouseDown(e)
	{
		data.resetSnaps();

		if(this.state === STATE.START){
			// First click: set start point, show tangent line
			// Use data.snapPoint to capture DA snap for guide generation
			this.startPoint = {x: data.snapPoint.x, y: data.snapPoint.y};
			this.dragStart = {x: data.snapPoint.x, y: data.snapPoint.y};
			this.isDragging = false;

			this.tangentLine = new Line([
				this.startPoint.x, this.startPoint.y,
				this.startPoint.x, this.startPoint.y
			]);
			data.addTempShape(this.tangentLine);
			this.state = STATE.TANGENT;

			// create a guide reference from initial point
			draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);

		} else if(this.state === STATE.TANGENT && !this.isDragging){
			// Second click (click-click mode): set tangent direction
			this.commitTangent(data.snapPoint);

		} else if(this.state === STATE.END){
			// Third click: commit the arc
			if(this.arc){
				this.arc.update();
				data.clearTempShapes();
				undoManager.execute(new AddShapeCommand(this.arc));
			}
			this.reset();
		}

		stage.render();
	}

	commitTangent(currentPoint){
		this.tangentPoint = {x: currentPoint.x, y: currentPoint.y};
		this.isDragging = false;
		this.dragStart = null;
		this.state = STATE.END;
	}

	onMouseMove(e)
	{
		if(this.state === STATE.TANGENT && this.tangentLine){
			// Check if we've moved enough to consider this a drag
			if(this.dragStart && !this.isDragging){
				const dx = data.snapPoint.x - this.dragStart.x;
				const dy = data.snapPoint.y - this.dragStart.y;
				const screenDist = stage.worldToScreenScale(Math.sqrt(dx * dx + dy * dy));
				if(screenDist > 5){
					this.isDragging = true;
				}
			}

			// Update tangent line preview
			this.tangentLine.end.x = data.snapPoint.x;
			this.tangentLine.end.y = data.snapPoint.y;
			this.tangentLine.update();
			stage.render();
			return;
		}

		if(this.state === STATE.END){
			// Create/update TangentArc from start, tangent, and current endpoint
			if(!this.arc){
				// Switch from tangent line to arc
				this.tangentLine = null;
				data.clearTempShapes();
				this.arc = new TangentArc([
					this.startPoint.x, this.startPoint.y,
					this.tangentPoint.x, this.tangentPoint.y,
					data.snapPoint.x, data.snapPoint.y
				]);
				data.addTempShape(this.arc);
			} else {
				// Update endpoint
				this.arc.endPoint.x = data.snapPoint.x;
				this.arc.endPoint.y = data.snapPoint.y;
				this.arc.recalculate();
			}
			stage.render();
		}
	}

	onMouseUp(e){
		if(this.state === STATE.TANGENT && this.isDragging){
			// Drag complete: commit tangent direction
			this.commitTangent(data.snapPoint);
			stage.render();
		}
	}
}
