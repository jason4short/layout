import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {Ellipse} 		from '../geometry/Ellipse.js';
import {AddShapeCommand} from '../core/Commands.js';

import stage 			from '../core/Stage.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import da 				from '../geometry/DraftingAssistant.js';

const STATE = Object.freeze({
	IDLE: 0,      // waiting for center point
	CENTER: 1     // center set, waiting for corner (click or drag)
});

export class CenterPointEllipseTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Center Ellipse";
		this.usage 	= "Click or drag from center to draw ellipse. Escape to cancel.";

		this.generateGuides = true;

		this.state		= STATE.IDLE;
		this.centerPt	= null;
		this.ellipse	= null;
		this.isDragging	= false;
		this.dragStart	= null;

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
	}

	deactivate(){
		this.reset();
	}

	updateCursor(){
		stage.setCursor('crosshair');
	}

	reset(){
		this.state = STATE.IDLE;
		this.centerPt = null;
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
			// First click: set center
			this.centerPt = {x: snapPt.x, y: snapPt.y};
			this.dragStart = {x: snapPt.x, y: snapPt.y};
			this.isDragging = false;

			// Create preview ellipse at center with 'center' controlMode
			this.ellipse = new Ellipse([this.centerPt.x, this.centerPt.y, 0, 0, 0, 0, 'center']);
			data.addTempShape(this.ellipse);

			this.state = STATE.CENTER;
			stage.render();

		} else if(this.state === STATE.CENTER && !this.isDragging){
			// Second click (click-click mode): commit
			this.commitEllipse(snapPt);
		}
	}

	onMouseMove(e)
	{
		if(this.state !== STATE.CENTER) return;

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

		this.updateEllipse(this.centerPt, snapPt);
		stage.render();
	}

	onMouseUp(e)
	{
		if(this.state !== STATE.CENTER) return;

		if(this.isDragging){
			// Drag complete: commit
			const snapPt = da.getCurrentSnapPoint();
			this.commitEllipse(snapPt);
		}
		// If not dragging, stay in CENTER state waiting for second click
	}

	commitEllipse(cornerPt)
	{
		// Calculate ellipse size
		const radiusX = Math.abs(cornerPt.x - this.centerPt.x);
		const radiusY = Math.abs(cornerPt.y - this.centerPt.y);

		// Check minimum size in screen pixels
		const screenRadiusX = stage.worldToScreenScale(radiusX);
		const screenRadiusY = stage.worldToScreenScale(radiusY);

		if(screenRadiusX > 5 || screenRadiusY > 5){
			// Finalize ellipse
			this.updateEllipse(this.centerPt, cornerPt);
			data.clearTempShapes();
			undoManager.execute(new AddShapeCommand(this.ellipse));
			this.ellipse = null;
		} else {
			data.clearTempShapes();
			this.ellipse = null;
		}

		this.state = STATE.IDLE;
		this.centerPt = null;
		this.isDragging = false;
		this.dragStart = null;
		stage.render();
	}

	updateEllipse(center, corner)
	{
		if(!this.ellipse) return;

		// Center stays fixed, radii are distances to corner
		const radiusX = Math.abs(corner.x - center.x);
		const radiusY = Math.abs(corner.y - center.y);

		this.ellipse.x = center.x;
		this.ellipse.y = center.y;
		this.ellipse.radiusX = radiusX;
		this.ellipse.radiusY = radiusY;
		// Set corner angle based on direction from center to corner
		this.ellipse.cornerAngle = Math.atan2(corner.y - center.y, corner.x - center.x);
		this.ellipse.update();
	}
}
