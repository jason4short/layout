import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {Arc} 			from '../geometry/Arc.js';
import {Line} 			from '../geometry/Line.js';
import {AddShapeCommand} from '../core/Commands.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import da 				from '../geometry/DraftingAssistant.js';

const STATE = Object.freeze({
	CENTER: 0,     // pick center point
	RADIUS: 1,     // pick radius and start angle
	END_ANGLE: 2   // pick end angle
});

export class CenterPointArcTool extends Tool
{
	constructor()
	{
		super();

		this.name 			= "Center Arc";
		this.usage 			= "Click or drag from center to set radius and start angle, then click to set end angle.";

		this.arc 			= null;
		this.radiusLine		= null;
		this.centerPoint 	= null;
		this.radius 		= 0;
		this.startAngle 	= 0;
		this.state 			= STATE.CENTER;

		// Drag support for center-to-radius segment
		this.isDragging		= false;
		this.dragStart		= null;

		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
		//console.log("CenterPointArcTool begin");
	}

	deactivate(){
		//console.log("CenterPointArcTool exit");
		this.reset();
	}

	updateCursor(){
		stage.setCursor('arc');
	}
	
	reset(){
		this.arc = null;
		this.radiusLine = null;
		this.centerPoint = null;
		this.radius = 0;
		this.startAngle = 0;
		this.state = STATE.CENTER;
		this.isDragging = false;
		this.dragStart = null;
		data.clearTempShapes();
	}

	onMouseDown(e)
	{
		const currentPoint = da.getCurrentSnapPoint();

		if(this.state === STATE.CENTER){
			// First click: set center point, show radius line
			this.centerPoint = {x: currentPoint.x, y: currentPoint.y};
			this.dragStart = {x: currentPoint.x, y: currentPoint.y};
			this.isDragging = false;

			this.radiusLine = new Line([
				this.centerPoint.x, this.centerPoint.y,
				this.centerPoint.x, this.centerPoint.y
			]);
			data.addTempShape(this.radiusLine);
			this.state = STATE.RADIUS;

		} else if(this.state === STATE.RADIUS && !this.isDragging){
			// Second click (click-click mode): set radius and start angle
			this.commitRadius(currentPoint);

		} else if(this.state === STATE.END_ANGLE){
			// Third click: commit the arc
			if(this.arc && this.radius > 0){
				this.arc.update();
				data.clearTempShapes();
				undoManager.execute(new AddShapeCommand(this.arc));
			}
			this.reset();
		}

		stage.render();
	}

	commitRadius(currentPoint){
		const dx = currentPoint.x - this.centerPoint.x;
		const dy = currentPoint.y - this.centerPoint.y;
		this.radius = Math.sqrt(dx * dx + dy * dy);
		this.startAngle = Math.atan2(dy, dx);

		// Create arc with zero sweep initially
		this.arc = new Arc([
			this.centerPoint.x,
			this.centerPoint.y,
			this.radius,
			this.startAngle,
			this.startAngle
		]);
		data.clearTempShapes();
		this.radiusLine = null;
		data.addTempShape(this.arc);

		this.isDragging = false;
		this.dragStart = null;
		this.state = STATE.END_ANGLE;
	}

	onMouseMove(e)
	{
		const currentPoint = da.getCurrentSnapPoint();

		if(this.state === STATE.RADIUS && this.radiusLine){
			// Check if we've moved enough to consider this a drag
			if(this.dragStart && !this.isDragging){
				const dx = currentPoint.x - this.dragStart.x;
				const dy = currentPoint.y - this.dragStart.y;
				const screenDist = stage.worldToScreenScale(Math.sqrt(dx * dx + dy * dy));
				if(screenDist > 5){
					this.isDragging = true;
				}
			}

			// Update radius line preview
			this.radiusLine.end.x = currentPoint.x;
			this.radiusLine.end.y = currentPoint.y;
			this.radiusLine.update();
			stage.render();
			return;
		}

		if(this.state === STATE.END_ANGLE && this.arc){
			// Update arc end angle
			const dx = currentPoint.x - this.centerPoint.x;
			const dy = currentPoint.y - this.centerPoint.y;
			const endAngle = Math.atan2(dy, dx);

			this.arc.endAngle = endAngle;
			this.arc.update();
			stage.render();
		}
	}
	
	onMouseUp(e){
		if(this.state === STATE.RADIUS && this.isDragging){
			// Drag complete: commit radius and start angle
			const currentPoint = da.getCurrentSnapPoint();
			this.commitRadius(currentPoint);
			stage.render();
		}
	}
}
