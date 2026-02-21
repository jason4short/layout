import {Tool} 				from './Tool.js';
import {Shape, Geometry} 	from '../geometry/Geometry.js';
import {Arc} 				from '../geometry/Arc.js';
import {Line} 				from '../geometry/Line.js';

import stage 				from '../core/Stage.js';
import toolManager			from './ToolManager.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import da 					from '../geometry/DraftingAssistant.js';

import {AddShapeCommand} 	from '../core/Commands.js';

const STATE = Object.freeze({
	START: 0,  // waiting for start point
	END: 1,    // waiting for end point
	MID: 2     // waiting for mid point (defines curvature)
});

export class ThreePointArcTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "3-Point Arc";
		this.usage 	= "Click or drag from start to end, then click to define curvature.";
		this.cursor = "cursor_arc";

		this.arc 			= null;
		this.linePreview	= null;
		this.startPoint 	= null;
		this.endPoint 		= null;
		this.state 			= STATE.START;

		// Drag support for start-to-end segment
		this.isDragging		= false;
		this.dragStart		= null;

		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseUp		= this.onMouseUp.bind(this);

	}

	begin(){
		//console.log("ThreePointArcTool begin");
	}

	deactivate(){
		//console.log("ThreePointArcTool exit");
		this.reset();
	}

	reset(){
		this.arc 			= null;
		this.linePreview 	= null;
		this.startPoint 	= null;
		this.endPoint 		= null;
		this.state 			= STATE.START;
		this.isDragging		= false;
		this.dragStart		= null;
		data.clearTempShapes();
	}

	updateCursor(){
		//stage.setCursor('arc3');
		stage.setCursor('crosshair');
	}

	onMouseDown(e)
	{
		data.resetSnaps();
		const currentPoint = da.getCurrentSnapPoint();

		if(this.state === STATE.START){
			// First click: set start point and create line preview
			this.startPoint = {x: currentPoint.x, y: currentPoint.y};
			this.dragStart = {x: currentPoint.x, y: currentPoint.y};
			this.isDragging = false;

			this.linePreview = new Line([
				this.startPoint.x, this.startPoint.y,
				this.startPoint.x, this.startPoint.y
			]);
			data.addTempShape(this.linePreview);
			this.state = STATE.END;

		} else if(this.state === STATE.END && !this.isDragging){
			// Second click (click-click mode): set end point
			this.endPoint = {x: currentPoint.x, y: currentPoint.y};

			// Update line to show the chord (start to end)
			this.linePreview.end.x = this.endPoint.x;
			this.linePreview.end.y = this.endPoint.y;
			this.linePreview.update();
			this.state = STATE.MID;

		} else if(this.state === STATE.MID){
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

	onMouseMove(e)
	{
		const currentPoint = da.getCurrentSnapPoint();

		// STATE.END: update line preview and check for drag
		if(this.state === STATE.END && this.linePreview){
			// Check if we've moved enough to consider this a drag
			if(this.dragStart && !this.isDragging){
				const dx = currentPoint.x - this.dragStart.x;
				const dy = currentPoint.y - this.dragStart.y;
				const screenDist = stage.worldToScreenScale(Math.sqrt(dx * dx + dy * dy));
				if(screenDist > 5){
					this.isDragging = true;
				}
			}

			this.linePreview.end.x = currentPoint.x;
			this.linePreview.end.y = currentPoint.y;
			this.linePreview.update();
			stage.render();
			return;
		}

		if(this.state !== STATE.MID){
			return;
		}

		// Calculate arc from 3 points: startPoint, endPoint, currentPoint
		const arcParams = Arc.calculateArcFrom3Points(
			this.startPoint,
			this.endPoint,
			currentPoint
		);

		if(arcParams){
			if(!this.arc){
				// Switch from line preview to arc preview
				if(this.linePreview){
					this.linePreview = null;
					data.clearTempShapes();
				}
				this.arc = new Arc([
					arcParams.cx,
					arcParams.cy,
					arcParams.radius,
					arcParams.startAngle,
					arcParams.endAngle
				]);
				data.addTempShape(this.arc);
			} else {
				this.arc.x 				= arcParams.cx;
				this.arc.y 				= arcParams.cy;
				this.arc.radius 		= arcParams.radius;
				this.arc.startAngle	 	= arcParams.startAngle;
				this.arc.endAngle 		= arcParams.endAngle;
				this.arc.update();
			}
		}

		stage.render();
	}

	onMouseUp(e){
		if(this.state === STATE.END && this.isDragging){
			// Drag complete: commit end point and move to MID state
			const currentPoint = da.getCurrentSnapPoint();
			this.endPoint = {x: currentPoint.x, y: currentPoint.y};

			// Update line to show the chord
			this.linePreview.end.x = this.endPoint.x;
			this.linePreview.end.y = this.endPoint.y;
			this.linePreview.update();

			this.isDragging = false;
			this.dragStart = null;
			this.state = STATE.MID;
			stage.render();
		}
	}

}
