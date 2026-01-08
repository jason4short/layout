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

export class SplineTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Spline";
		this.usage 	= "Click 4 points: start, end, then two control handles to shape the curve.";

		this.spline 		= null;
		this.linePreview	= null;
		this.step 			= 0;  // 0: p0, 1: p3, 2: p1, 3: p2

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
		this.step 			= 0;
		this.p0 			= null;
		this.p1 			= null;
		this.p2 			= null;
		this.p3 			= null;
		
		this.spline 		= null;
		this.linePreview 	= null;
		data.removeTempShape();
	}
	updateCursor(){
		stage.setCursor('spline', 0, 0);
	}

	onMouseDown(e)
	{
		data.resetSnaps();
		const snap = da.getCurrentSnapPoint();

		switch(this.step){
			case 0:
				// First click: set start point (p0)
				this.p0 = {x: snap.x, y: snap.y};
				this.linePreview = data.getNewShape(Shape.LINE);
				data.addTempShape(this.linePreview);
				this.step = 1;
				break;

			case 1:
				data.removeTempShape();
					
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
				this.step = 2;
				break;

			case 2:
				// Third click: set first control handle (p1)
				this.p1 = {x: snap.x, y: snap.y};
				this.spline.p1.x = this.p1.x;
				this.spline.p1.y = this.p1.y;
				this.spline.update();
				this.step = 3;
				break;

			case 3:
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

		if(this.step === 1 && this.p0){
			console.log("lp")
			if(this.linePreview){
				this.linePreview.end.x = snap.x;
				this.linePreview.end.y = snap.y;
			}
		}

		if(this.step === 2 && this.spline){
			// Update p1 to cursor position
			this.spline.p1.x = snap.x;
			this.spline.p1.y = snap.y;
			this.spline.update();
		}

		if(this.step === 3 && this.spline){
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
