import {Tool} 				from './Tool.js';
import {Shape} 				from '../geometry/Geometry.js';
import {Line} 				from '../geometry/Line.js';

import toolManager 			from './ToolManager.js';
import stage 				from '../core/Stage.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import da 					from '../geometry/DraftingAssistant.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';
import {AddShapesCommand}	from '../core/Commands.js';

const STATE = Object.freeze({
	IDLE: 0,          // waiting for first corner
	FIRST_CORNER: 1   // first corner set, waiting for second corner (click or drag)
});

export class BoxTool extends Tool
{
	constructor()
	{
		super();
		this.name 	= "Rectangle";
		this.usage 	= "Click to set first corner, then click or drag to opposite corner.";

		this.generateGuides = true;

		this.state			= STATE.IDLE;
		this.startPt		= null;
		this.previewLines	= [];  // 4 lines for box preview
		this.isDragging		= false;
		this.dragStart		= null;

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

	reset()
	{
		this.state = STATE.IDLE;
		this.startPt = null;
		this.isDragging = false;
		this.dragStart = null;

		// Remove preview lines
		data.clearTempShapes();
		this.previewLines = [];
	}

	onMouseDown(e)
	{
		data.resetSnaps();
		const snapPt = da.getCurrentSnapPoint();

		if(this.state === STATE.IDLE){
			// First click: set first corner
			this.startPt = {x: snapPt.x, y: snapPt.y};
			this.dragStart = {x: snapPt.x, y: snapPt.y};
			this.isDragging = false;

			// Create 4 preview lines
			for(let i = 0; i < 4; i++){
				const line = new Line([this.startPt.x, this.startPt.y, this.startPt.x, this.startPt.y]);
				this.previewLines.push(line);
			}
			data.setTempShapes(this.previewLines);
			draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);

			this.state = STATE.FIRST_CORNER;
			stage.render();

		} else if(this.state === STATE.FIRST_CORNER && !this.isDragging){
			// Second click (click-click mode): commit the box
			this.commitBox(snapPt);
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

		this.updateBoxLines(this.startPt, snapPt);
		stage.render();
	}

	onMouseUp(e)
	{
		if(this.state !== STATE.FIRST_CORNER) return;

		if(this.isDragging){
			// Drag complete: commit the box
			data.resetSnaps();
			const snapPt = da.getCurrentSnapPoint();
			this.commitBox(snapPt);
		}
		// If not dragging, stay in FIRST_CORNER state waiting for second click
	}

	commitBox(endPt)
	{
		// Calculate box size
		const width = Math.abs(endPt.x - this.startPt.x);
		const height = Math.abs(endPt.y - this.startPt.y);

		// Check minimum size in screen pixels
		const screenWidth = stage.worldToScreenScale(width);
		const screenHeight = stage.worldToScreenScale(height);

		if(screenWidth > 5 && screenHeight > 5){
			// Finalize line positions
			this.updateBoxLines(this.startPt, endPt);

			// Clear temp shapes before adding to data
			data.clearTempShapes();

			// Add lines via undo command
			undoManager.execute(new AddShapesCommand([...this.previewLines]));
			this.previewLines = [];
		} else {
			data.clearTempShapes();
			this.previewLines = [];
		}

		this.state = STATE.IDLE;
		this.startPt = null;
		this.isDragging = false;
		this.dragStart = null;
		stage.render();
	}

	updateBoxLines(p1, p2)
	{
		if(this.previewLines.length !== 4) return;

		// Determine actual corners
		const minX = Math.min(p1.x, p2.x);
		const maxX = Math.max(p1.x, p2.x);
		const minY = Math.min(p1.y, p2.y);
		const maxY = Math.max(p1.y, p2.y);

		// Top line
		this.previewLines[0].start.x = minX;
		this.previewLines[0].start.y = minY;
		this.previewLines[0].end.x = maxX;
		this.previewLines[0].end.y = minY;
		this.previewLines[0].update();

		// Right line
		this.previewLines[1].start.x = maxX;
		this.previewLines[1].start.y = minY;
		this.previewLines[1].end.x = maxX;
		this.previewLines[1].end.y = maxY;
		this.previewLines[1].update();

		// Bottom line
		this.previewLines[2].start.x = maxX;
		this.previewLines[2].start.y = maxY;
		this.previewLines[2].end.x = minX;
		this.previewLines[2].end.y = maxY;
		this.previewLines[2].update();

		// Left line
		this.previewLines[3].start.x = minX;
		this.previewLines[3].start.y = maxY;
		this.previewLines[3].end.x = minX;
		this.previewLines[3].end.y = minY;
		this.previewLines[3].update();
	}
}
