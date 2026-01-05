import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import {AddShapeCommand,
		AddConstructionCommand,
			MoveCommand} from '../core/Commands.js';

const STATE = {
	IDLE: 0,		// Waiting for click on a line
	DRAGGING: 1,	// Dragging to set offset distance
	ADJUSTING: 2	// Line created, user can type new dimension
};

export class ParallelLineTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Parallel Line";
		this.usage 	= "Click a line, then drag to create a parallel copy at an offset distance.";
		this.cursor = "cursor_parallel";

		this.state 			= STATE.IDLE;
		this.originalLine 	= null;
		this.previewLine 	= null;
		this.createdLine 	= null;  // The committed line (for dimension adjustment)

		// Drag state
		this.dragStartPt 	= null;
		this.lineStartOrig 	= null;
		this.lineEndOrig 	= null;
		this.unitNormal 	= null;
		this.signedOffset 	= 0;

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
		this.updateDimension = this.updateDimension.bind(this);
	}

	begin() {
		this.state = STATE.IDLE;
		toolManager.addEventListener('mouseDown', this.onMouseDown);
		toolManager.addEventListener('mouseMove', this.onMouseMove);
		toolManager.addEventListener('mouseUp', this.onMouseUp);
	}

	exit() {
		toolManager.removeEventListener('mouseDown', this.onMouseDown);
		toolManager.removeEventListener('mouseMove', this.onMouseMove);
		toolManager.removeEventListener('mouseUp', this.onMouseUp);
		this.reset();
	}
	
	updateCursor(){
		stage.setCursor('parallel');
	}


	reset() {
		if (this.previewLine) {
			data.removeTempShape();
			this.previewLine = null;
		}

		this.state 			= STATE.IDLE;
		this.originalLine 	= null;
		this.createdLine 	= null;
		this.dragStartPt 	= null;
		this.lineStartOrig 	= null;
		this.lineEndOrig 	= null;
		this.unitNormal 	= null;
		this.signedOffset 	= 0;
	}

	onMouseDown(e) {
		// If we were adjusting or dragging, reset for new operation
		if (this.state !== STATE.IDLE) {
			this.reset();
		}

		const clickedShape = data.getTargetShape();

		if (!clickedShape || clickedShape.geometry !== Shape.LINE) {
			return;
		}

		// Start dragging
		this.originalLine = clickedShape;
		this.previewLine = this.originalLine.clone();
		data.addTempShape(this.previewLine);

		//this.dragStartPt = { x: e.x, y: e.y };
		this.dragStartPt = { x: data.snapPoint.x, y: data.snapPoint.y };
		
		this.lineStartOrig = { x: this.originalLine.start.x, y: this.originalLine.start.y };
		this.lineEndOrig = { x: this.originalLine.end.x, y: this.originalLine.end.y };

		// Calculate perpendicular unit normal
		const dx = this.lineEndOrig.x - this.lineStartOrig.x;
		const dy = this.lineEndOrig.y - this.lineStartOrig.y;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len === 0) {
			this.reset();
			return;
		}

		// Perpendicular (rotated 90 degrees)
		this.unitNormal = { x: -dy / len, y: dx / len };

		this.state = STATE.DRAGGING;
		stage.render();
	}

	onMouseMove(e) {
		if (this.state !== STATE.DRAGGING) return;
		if (!this.previewLine || !this.dragStartPt) return;

		const currentPt = { x: data.snapPoint.x, y: data.snapPoint.y };

		// Project mouse delta onto line normal to get perpendicular offset
		const mouseDx = currentPt.x - this.dragStartPt.x;
		const mouseDy = currentPt.y - this.dragStartPt.y;

		this.signedOffset = mouseDx * this.unitNormal.x + mouseDy * this.unitNormal.y;

		this.updatePreviewOffset(this.signedOffset);
		stage.render();
	}

	onMouseUp(e) {
		if (this.state !== STATE.DRAGGING) return;
		if (!this.previewLine) return;

		// Commit the preview line
		data.removeTempShape();
		this.previewLine.update();
	
		if(this.previewLine.type == Shape.CONSTRUCTION){
			undoManager.execute(new AddConstructionCommand(this.previewLine));
		}else{
			undoManager.execute(new AddShapeCommand(this.previewLine));
		}

		// Keep reference for dimension adjustment
		this.createdLine = this.previewLine;
		this.previewLine = null;

		this.state = STATE.ADJUSTING;

		// Show dimension input
		stage.setInputCallback(this.updateDimension);
		stage.setDimensionInputValue(Math.abs(this.signedOffset).toFixed(2));

		stage.render();
	}

	updatePreviewOffset(offset) {
		if (!this.previewLine) return;

		const tx = this.unitNormal.x * offset;
		const ty = this.unitNormal.y * offset;

		this.previewLine.start.x = this.lineStartOrig.x + tx;
		this.previewLine.start.y = this.lineStartOrig.y + ty;
		this.previewLine.end.x = this.lineEndOrig.x + tx;
		this.previewLine.end.y = this.lineEndOrig.y + ty;
		this.previewLine.update();
	}

	updateDimension(newDim) {
		const dim = parseFloat(newDim);
		if (isNaN(dim) || dim === 0) return;
		if (this.state !== STATE.ADJUSTING) return;
		if (!this.createdLine) return;

		// Apply sign from original drag direction
		const signedDim = this.signedOffset < 0 ? -Math.abs(dim) : Math.abs(dim);

		const tx = this.unitNormal.x * signedDim;
		const ty = this.unitNormal.y * signedDim;

		// Calculate new positions
		const newStartX = this.lineStartOrig.x + tx;
		const newStartY = this.lineStartOrig.y + ty;
		const newEndX = this.lineEndOrig.x + tx;
		const newEndY = this.lineEndOrig.y + ty;

		// Build move data for undo (indices: 0=start, 1=end)
		const moveData = [
			{
				shape: this.createdLine,
				index: 0,
				oldX: this.createdLine.start.x,
				oldY: this.createdLine.start.y,
				newX: newStartX,
				newY: newStartY
			},
			{
				shape: this.createdLine,
				index: 1,
				oldX: this.createdLine.end.x,
				oldY: this.createdLine.end.y,
				newX: newEndX,
				newY: newEndY
			}
		];

		// Execute move command (handles undo and intersection recalculation)
		undoManager.execute(new MoveCommand(moveData));

		this.signedOffset = signedDim;

		stage.render();
	}
}
