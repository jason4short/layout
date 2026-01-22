import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {Ellipse} 		from '../geometry/Ellipse.js';

import stage 			from '../core/Stage.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import da 				from '../geometry/DraftingAssistant.js';

import {AddShapeCommand} from '../core/Commands.js';

const STATE = Object.freeze({
	IDLE: 0,          // waiting for first corner
	FIRST_CORNER: 1   // first corner set, waiting for second corner
});

export class OppositeCornerEllipseTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Corner Ellipse";
		this.usage 	= "Click first corner, then click or drag to opposite corner.";

		this.generateGuides = true;

		this.state		= STATE.IDLE;
		this.startPt	= null;
		this.ellipse	= null;
		this.isDragging	= false;
		this.dragStart	= null;

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
	}

	exit(){
		this.reset();
	}

	updateCursor(){
		stage.setCursor('crosshair');
	}

	reset(){
		this.state = STATE.IDLE;
		this.startPt = null;
		this.isDragging = false;
		this.dragStart = null;
		if(this.ellipse){
			data.clearTempShapes();
			this.ellipse = null;
		}
	}

	onMouseDown(e)
	{
		const snapPt = da.getCurrentSnapPoint();

		if(this.state === STATE.IDLE){
			// First click: set first corner
			this.startPt = {x: snapPt.x, y: snapPt.y};
			this.dragStart = {x: snapPt.x, y: snapPt.y};
			this.isDragging = false;

			// Create preview ellipse with 'corners' controlMode
			this.ellipse = new Ellipse([this.startPt.x, this.startPt.y, 0, 0, 0, 0, 'corners']);
			data.addTempShape(this.ellipse);

			this.state = STATE.FIRST_CORNER;
			stage.render();

		} else if(this.state === STATE.FIRST_CORNER && !this.isDragging){
			// Second click (click-click mode): commit
			this.commitEllipse(snapPt);
		}
	}

	onMouseMove(e)
	{
		if(this.state !== STATE.FIRST_CORNER) return;

		const snapPt = da.getCurrentSnapPoint();

		// Check if we've moved enough to consider this a drag
		if(this.dragStart && !this.isDragging){
			const dx = snapPt.x - this.dragStart.x;
			const dy = snapPt.y - this.dragStart.y;
			const screenDist = stage.worldToScreenScale(Math.sqrt(dx * dx + dy * dy));
			if(screenDist > 5){
				this.isDragging = true;
			}
		}

		this.updateEllipse(this.startPt, snapPt);
		stage.render();
	}

	onMouseUp(e)
	{
		if(this.state !== STATE.FIRST_CORNER) return;

		if(this.isDragging){
			// Drag complete: commit
			const snapPt = da.getCurrentSnapPoint();
			this.commitEllipse(snapPt);
		}
		// If not dragging, stay in FIRST_CORNER state waiting for second click
	}

	commitEllipse(endPt)
	{
		// Calculate ellipse size
		const width = Math.abs(endPt.x - this.startPt.x);
		const height = Math.abs(endPt.y - this.startPt.y);

		// Check minimum size in screen pixels
		const screenWidth = stage.worldToScreenScale(width);
		const screenHeight = stage.worldToScreenScale(height);

		if(screenWidth > 5 || screenHeight > 5){
			// Finalize ellipse
			this.updateEllipse(this.startPt, endPt);
			data.clearTempShapes();
			undoManager.execute(new AddShapeCommand(this.ellipse));
			this.ellipse = null;
		} else {
			data.clearTempShapes();
			this.ellipse = null;
		}

		this.state = STATE.IDLE;
		this.startPt = null;
		this.isDragging = false;
		this.dragStart = null;
		stage.render();
	}

	updateEllipse(p1, p2)
	{
		if(!this.ellipse) return;

		// Calculate center and radii from opposite corners
		const centerX = (p1.x + p2.x) / 2;
		const centerY = (p1.y + p2.y) / 2;
		const radiusX = Math.abs(p2.x - p1.x) / 2;
		const radiusY = Math.abs(p2.y - p1.y) / 2;

		this.ellipse.x = centerX;
		this.ellipse.y = centerY;
		this.ellipse.radiusX = radiusX;
		this.ellipse.radiusY = radiusY;
		// Set corner angle based on direction from center to p2
		this.ellipse.cornerAngle = Math.atan2(p2.y - centerY, p2.x - centerX);
		this.ellipse.update();
	}
}
