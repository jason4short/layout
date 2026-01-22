import {Tool}			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {Spline} 		from '../geometry/Spline.js';
import {Line} 			from '../geometry/Line.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import da 				from '../geometry/DraftingAssistant.js';

import {AddShapeCommand} from '../core/Commands.js';

const STATE = Object.freeze({
	START: 0,      // pick start point (p0)
	END: 1,        // pick end point (p3)
	CONTROL1: 2,   // pick first control handle (p1)
	CONTROL2: 3    // pick second control handle (p2)
});

export class SplineTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Spline";
		this.usage 	= "Click or drag start to end, then click two control handles to shape the curve.";

		this.spline 		= null;
		this.linePreview	= null;
		this.state 			= STATE.START;

		this.p0 = null;
		this.p1 = null;
		this.p2 = null;
		this.p3 = null;

		// Drag support for start-to-end segment
		this.isDragging		= false;
		this.dragStart		= null;

		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}

	begin(){
	}

	exit(){
		this.reset();
	}

	reset(){
		this.state 			= STATE.START;
		this.p0 			= null;
		this.p1 			= null;
		this.p2 			= null;
		this.p3 			= null;

		this.spline 		= null;
		this.linePreview 	= null;
		this.isDragging		= false;
		this.dragStart		= null;
		data.clearTempShapes();
		data.resetSnaps();
	}
	updateCursor(){
		stage.setCursor('spline', 0, 0);
	}

	onMouseDown(e)
	{
		const snap = da.getCurrentSnapPoint();

		switch(this.state){
			case STATE.START:
				// First click: set start point (p0)
				this.p0 = {x: snap.x, y: snap.y};
				this.dragStart = {x: snap.x, y: snap.y};
				this.isDragging = false;

				// Create guide reference from start point (pass a copy)
				da.setCurrentSnapPoint({x: this.p0.x, y: this.p0.y}, true);

				this.linePreview = data.getNewShape(Shape.LINE);
				data.addTempShape(this.linePreview);
				this.state = STATE.END;
				break;

			case STATE.END:
				if(!this.isDragging){
					// Second click (click-click mode): commit end point
					this.commitEndPoint(snap);
				}
				break;

			case STATE.CONTROL1:
				// Third click: set first control handle (p1)
				this.p1 = {x: snap.x, y: snap.y};
				this.spline.p1.x = this.p1.x;
				this.spline.p1.y = this.p1.y;
				this.spline.update();

				// Create guide reference from first control point
				// Pass a copy to avoid storing a reference to spline.p1
				da.setCurrentSnapPoint({x: this.p1.x, y: this.p1.y}, true);

				this.state = STATE.CONTROL2;
				break;

			case STATE.CONTROL2:
				// Fourth click: set second control handle (p2) and commit
				this.p2 = {x: snap.x, y: snap.y};
				this.spline.p2.x = this.p2.x;
				this.spline.p2.y = this.p2.y;
				this.spline.update();

				// Create guide reference from second control point (pass a copy)
				da.setCurrentSnapPoint({x: this.p2.x, y: this.p2.y}, true);

				// Commit the spline
				undoManager.execute(new AddShapeCommand(this.spline));

				this.reset()
				break;
		}

		stage.render();
	}

	commitEndPoint(snap){
		data.clearTempShapes();

		// Set end point (p3)
		this.p3 = {x: snap.x, y: snap.y};
		// Default control handles to 1/3 and 2/3 along the line
		this.p1 = {
			x: this.p0.x + (this.p3.x - this.p0.x) / 3,
			y: this.p0.y + (this.p3.y - this.p0.y) / 3
		};
		this.p2 = {
			x: this.p0.x + 2 * (this.p3.x - this.p0.x) / 3,
			y: this.p0.y + 2 * (this.p3.y - this.p0.y) / 3
		};
		// Create spline preview
		this.spline = new Spline([
			this.p0.x, this.p0.y,
			this.p1.x, this.p1.y,
			this.p2.x, this.p2.y,
			this.p3.x, this.p3.y
		]);
		data.addTempShape(this.spline);

		// Create guide reference from end point (pass a copy)
		da.setCurrentSnapPoint({x: this.p3.x, y: this.p3.y}, true);

		this.isDragging = false;
		this.dragStart = null;
		this.state = STATE.CONTROL1;
	}

	onMouseMove(e)
	{
		const snap = da.getCurrentSnapPoint();

		if(this.state === STATE.END && this.p0){
			// Check if we've moved enough to consider this a drag
			if(this.dragStart && !this.isDragging){
				const dx = snap.x - this.dragStart.x;
				const dy = snap.y - this.dragStart.y;
				const screenDist = stage.worldToScreenScale(Math.sqrt(dx * dx + dy * dy));
				if(screenDist > 5){
					this.isDragging = true;
				}
			}

			if(this.linePreview){
				this.linePreview.end.x = snap.x;
				this.linePreview.end.y = snap.y;
			}
		}

		if(this.state === STATE.CONTROL1 && this.spline){
			// Update p1 to cursor position
			this.spline.p1.x = snap.x;
			this.spline.p1.y = snap.y;
			this.spline.update();
		}

		if(this.state === STATE.CONTROL2 && this.spline){
			// Update p2 to cursor position
			this.spline.p2.x = snap.x;
			this.spline.p2.y = snap.y;
			this.spline.update();
		}

		stage.render();
	}

	onMouseUp(e){
		if(this.state === STATE.END && this.isDragging){
			// Drag complete: commit end point
			const snap = da.getCurrentSnapPoint();
			this.commitEndPoint(snap);
			stage.render();
		}
	}

}
