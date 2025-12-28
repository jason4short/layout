import {Tool} from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class ParallelLineTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.originalLine 					= null;
		this.previewLine 					= null;
		
		this.dragStartMousePoint 			= null;
		this.originalStartPointAtDragStart 	= null;
		this.originalEndPointAtDragStart 	= null;
		this.originalUnitNormalAtDragStart 	= null;
		this.signedPerpendicularOffset		= 0;
		
		this.onMouseMove 					= this.onMouseMove.bind(this);
		this.onMouseDown 					= this.onMouseDown.bind(this);
		this.onMouseUp 						= this.onMouseUp.bind(this);
		this.onKeyUp 						= this.onKeyUp.bind(this);
		this.updateDimension 				= this.updateDimension.bind(this);
	}

	begin(){
		console.log("begin ParallelTool");
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		console.log("exit ParallelTool");
		stage.removeEventListener('keyUp', 		this.onKeyUp);
		stage.removeEventListener('mouseUp', 	this.onMouseUp);
		stage.removeEventListener('mouseMove', 	this.onMouseMove);
		stage.removeEventListener('mouseDown', 	this.onMouseDown);
	}

	onKeyUp(e){
		if(e.key === 'Escape' && this.previewLine){
			this.resetDragState();
			stage.render();
		}
	}

	onMouseDown(e)
	{
		console.log('[ParallelLineTool] mouseDown');
		const startMousePoint = data.getCurrentSnapPoint();

		const selectedShape = data.getTargetShape(startMousePoint);
	
		if(!selectedShape || selectedShape.geometry !== Shape.LINE){
			console.log('[ParallelLineTool] No line selected. Drag not started.');
			this.resetDragState();
			stage.render();
			return;
		}

		stage.addEventListener('keyUp', 	this.onKeyUp);
		stage.addEventListener('mouseUp', 	this.onMouseUp);
		stage.addEventListener('mouseMove', this.onMouseMove);

		this.originalLine 	= selectedShape;
		this.previewLine 	= this.originalLine.clone();
		data.addTempShape(this.previewLine);

		this.dragStartMousePoint = {x: data.snapPoint.x, y: data.snapPoint.y};

		this.originalStartPointAtDragStart = {
			x: this.originalLine.start.x,
			y: this.originalLine.start.y
		};

		this.originalEndPointAtDragStart = {
			x: this.originalLine.end.x,
			y: this.originalLine.end.y
		};

		const lineDeltaX = this.originalEndPointAtDragStart.x - this.originalStartPointAtDragStart.x;
		const lineDeltaY = this.originalEndPointAtDragStart.y - this.originalStartPointAtDragStart.y;

		const lineLength = Math.sqrt((lineDeltaX * lineDeltaX) + (lineDeltaY * lineDeltaY));

		if(lineLength === 0){
			this.resetDragState();
			stage.render();
			return;
		}

		// Perpendicular unit normal (rotated 90 degrees)
		this.originalUnitNormalAtDragStart = {
			x: -lineDeltaY / lineLength,
			y: lineDeltaX / lineLength
		};
		
		
		stage.render();
	}

	/**
	 * Mouse move translates the cloned line by the mouse delta (in world space).
	 * Because we use data.snapPoint, the translation snaps to other geometry automatically.
	 */
	onMouseMove(e)
	{
		if(!this.previewLine || !this.dragStartMousePoint){
			return;
		}
		const currentMousePoint = data.getCurrentSnapPoint ? data.getCurrentSnapPoint() : {x: e.x, y: e.y};

		const mouseDeltaX 			= currentMousePoint.x - this.dragStartMousePoint.x;
		const mouseDeltaY 			= currentMousePoint.y - this.dragStartMousePoint.y;

		// Project mouse delta onto the line normal to get the signed perpendicular offset
		this.signedPerpendicularOffset =
			(mouseDeltaX * this.originalUnitNormalAtDragStart.x) +
			(mouseDeltaY * this.originalUnitNormalAtDragStart.y);

		this.offsetLine(this.signedPerpendicularOffset);
	}
	
	offsetLine(newDim){
	
		const translationX 			= this.originalUnitNormalAtDragStart.x * newDim;
		const translationY 			= this.originalUnitNormalAtDragStart.y * newDim;

		this.previewLine.start.x 	= this.originalStartPointAtDragStart.x + translationX;
		this.previewLine.start.y 	= this.originalStartPointAtDragStart.y + translationY;

		this.previewLine.end.x 		= this.originalEndPointAtDragStart.x + translationX;
		this.previewLine.end.y 		= this.originalEndPointAtDragStart.y + translationY;
		
		this.previewLine.update();

		stage.render();
	}

	/**
	 * Mouse up commits the preview line as a new shape.
	 */
	onMouseUp(e)
	{
		if(!this.previewLine){
			return;
		}

		this.previewLine.update();
		data.addShape(this.previewLine);

		//this.resetDragState();
		stage.render();
		stage.setInputCallback(this.updateDimension)
		stage.setDimensionInputValue(Math.abs(this.signedPerpendicularOffset));
		
	}

	updateDimension(newDim){
		//this.prevLine.scaleToDim(newDim);
		if(this.signedPerpendicularOffset < 0)
			newDim = -newDim;

		this.offsetLine(newDim);

		this.previewLine = null;
		stage.render();
	}

	/**
	 * Clear all state for the current drag operation.
	 */
	resetDragState()
	{
//		this.originalLine = null;
		//this.previewLine = null;

		this.dragStartMousePoint = null;
		this.originalStartPointAtDragStart = null;
		this.originalEndPointAtDragStart = null;
		this.originalUnitNormalAtDragStart = null;	
	}
}


