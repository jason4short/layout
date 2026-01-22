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
		this.usage 	= "Click 4 points: start, end, then two control handles to shape the curve.";

		this.spline 		= null;
		this.linePreview	= null;
		this.state 			= STATE.START;

		this.p0 = null;
		this.p1 = null;
		this.p2 = null;
		this.p3 = null;

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
		data.clearTempShapes();
	}
	updateCursor(){
		stage.setCursor('spline', 0, 0);
	}

	onMouseDown(e)
	{
		data.resetSnaps();
		const snap = da.getCurrentSnapPoint();

		switch(this.state){
			case STATE.START:
				// First click: set start point (p0)
				this.p0 = {x: snap.x, y: snap.y};
				this.linePreview = data.getNewShape(Shape.LINE);
				data.addTempShape(this.linePreview);
				this.state = STATE.END;
				break;

			case STATE.END:
				data.clearTempShapes();

				// Second click: set end point (p3)
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
				this.state = STATE.CONTROL1;
				break;

			case STATE.CONTROL1:
				// Third click: set first control handle (p1)
				this.p1 = {x: snap.x, y: snap.y};
				this.spline.p1.x = this.p1.x;
				this.spline.p1.y = this.p1.y;
				this.spline.update();
				this.state = STATE.CONTROL2;
				break;

			case STATE.CONTROL2:
				// Fourth click: set second control handle (p2) and commit
				this.p2 = {x: snap.x, y: snap.y};
				this.spline.p2.x = this.p2.x;
				this.spline.p2.y = this.p2.y;
				this.spline.update();

				// Commit the spline
				undoManager.execute(new AddShapeCommand(this.spline));

				this.reset()
				break;
		}

		stage.render();
	}

	onMouseMove(e)
	{
		const snap = da.getCurrentSnapPoint();

		if(this.state === STATE.END && this.p0){
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
		
	}

}
