import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import * as VectorUtils from '../geometry/utils/VectorUtils.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import {AddShapeCommand,
		AddConstructionCommand,
			MoveCommand} from '../core/Commands.js';

// Shape types for offset operations
const OFFSET_TYPE = {
	LINE: 'line',
	CIRCLE: 'circle',
	ARC: 'arc'
};

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

		this.name 	= "Offset";
		this.usage 	= "Click or drag to offset a line, arc, or circle.";

		this.generateGuides 	= false; // Enable snapping for move operations

		this.state 			= STATE.IDLE;
		this.offsetType		= null;  // OFFSET_TYPE.LINE, CIRCLE, or ARC
		this.originalShape 	= null;
		this.previewShape 	= null;
		this.createdShape 	= null;  // The committed shape (for dimension adjustment)

		// Drag state - lines
		this.dragStartPt 	= null;
		this.lineStartOrig 	= null;
		this.lineEndOrig 	= null;
		this.unitNormal 	= null;
		this.signedOffset 	= 0;

		// Drag state - circles/arcs
		this.centerOrig		= null;
		this.radiusOrig		= null;

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
		this.updateDimension = this.updateDimension.bind(this);
	}

	begin() {
		this.state = STATE.IDLE;
	}

	deactivate(){
		this.reset();
	}
	
	updateCursor(){
		stage.setCursor('crosshair');
//		stage.setCursor('parallel');
	}

	// Find the line closest to a point
	findClosestLine(lines, point) {
		let closest = null;
		let closestDist = Infinity;

		for (const line of lines) {
			const nearestPt = VectorUtils.closestPointOnSegment(point, line.start, line.end);
			const dist = VectorUtils.distance(point, nearestPt);
			if (dist < closestDist) {
				closestDist = dist;
				closest = line;
			}
		}

		return closest;
	}


	reset() {
		if (this.previewShape) {
			data.clearTempShapes();
			this.previewShape = null;
		}
		data.resetSnaps();
		data.clearGuides();
		this.state 			= STATE.IDLE;
		this.offsetType		= null;
		this.originalShape 	= null;
		this.createdShape 	= null;
		this.dragStartPt 	= null;
		this.lineStartOrig 	= null;
		this.lineEndOrig 	= null;
		this.unitNormal 	= null;
		this.signedOffset 	= 0;
		this.centerOrig		= null;
		this.radiusOrig		= null;
	}

	onMouseDown(e) {
		// If we were adjusting or dragging, reset for new operation
		if (this.state !== STATE.IDLE) {
			this.reset();
		}

		const clickedShape = data.getTargetShape();
		if (!clickedShape) return;

		this.dragStartPt = { x: data.snapPoint.x, y: data.snapPoint.y };

		// Handle circles
		if (clickedShape.geometry === Shape.CIRCLE) {
			this.offsetType = OFFSET_TYPE.CIRCLE;
			this.originalShape = clickedShape;
			this.previewShape = clickedShape.clone();
			this.previewShape.frameId = clickedShape.frameId;
			data.addTempShape(this.previewShape);

			this.centerOrig = { x: clickedShape.x, y: clickedShape.y };
			this.radiusOrig = clickedShape.radius;

			this.state = STATE.DRAGGING;
			stage.render();
			return;
		}

		// Handle arcs
		if (clickedShape.geometry === Shape.ARC || clickedShape.geometry === Shape.TANGENT_ARC) {
			this.offsetType = OFFSET_TYPE.ARC;
			this.originalShape = clickedShape;
			this.previewShape = clickedShape.clone();
			this.previewShape.frameId = clickedShape.frameId;
			data.addTempShape(this.previewShape);

			this.centerOrig = { x: clickedShape.x, y: clickedShape.y };
			this.radiusOrig = clickedShape.radius;

			this.state = STATE.DRAGGING;
			stage.render();
			return;
		}

		// Handle lines (and primitives with lines)
		let sourceLine = null;

		if (clickedShape.geometry === Shape.LINE) {
			// Direct line - use as-is
			sourceLine = clickedShape;
		} else if (typeof clickedShape.createLines === 'function') {
			// Primitive with edges (Board, Polygon) - find closest edge to snap point
			sourceLine = this.findClosestLine(clickedShape.createLines(), data.snapPoint);
		} else if (typeof clickedShape.createShapes === 'function') {
			// Slot - filter to just lines, find closest
			const lines = clickedShape.createShapes().filter(s => s.geometry === Shape.LINE);
			sourceLine = this.findClosestLine(lines, data.snapPoint);
		}

		if (!sourceLine) return;

		// Start dragging for line
		this.offsetType = OFFSET_TYPE.LINE;
		this.originalShape = sourceLine;
		this.previewShape = sourceLine.clone();
		this.previewShape.frameId = sourceLine.frameId;
		data.addTempShape(this.previewShape);

		this.lineStartOrig = { x: sourceLine.start.x, y: sourceLine.start.y };
		this.lineEndOrig = { x: sourceLine.end.x, y: sourceLine.end.y };

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
		if (!this.previewShape || !this.dragStartPt) return;

		const currentPt = { x: data.snapPoint.x, y: data.snapPoint.y };

		if (this.offsetType === OFFSET_TYPE.LINE) {
			// Project mouse delta onto line normal to get perpendicular offset
			const mouseDx = currentPt.x - this.dragStartPt.x;
			const mouseDy = currentPt.y - this.dragStartPt.y;
			this.signedOffset = mouseDx * this.unitNormal.x + mouseDy * this.unitNormal.y;
		} else {
			// For circles/arcs, offset is radial distance from center
			const distFromCenter = VectorUtils.distance(currentPt, this.centerOrig);
			this.signedOffset = distFromCenter - this.radiusOrig;
		}

		this.updatePreviewOffset(this.signedOffset);
		stage.render();
	}

	onMouseUp(e) {
		if (this.state !== STATE.DRAGGING) return;
		if (!this.previewShape) return;

		// Require minimum drag distance to avoid duplicating on click
		const currentPt = { x: data.snapPoint.x, y: data.snapPoint.y };
		const dragDist = VectorUtils.distance(currentPt, this.dragStartPt);
		if (stage.worldToScreenScale(dragDist) < 5) {
			this.reset();
			stage.render();
			return;
		}

		// Don't create if radius would be zero or negative for circles/arcs
		if (this.offsetType !== OFFSET_TYPE.LINE) {
			const newRadius = this.radiusOrig + this.signedOffset;
			if (newRadius <= 0) {
				this.reset();
				stage.render();
				return;
			}
		}

		// Commit the preview shape
		data.clearTempShapes();
		this.previewShape.update();

		if(this.previewShape.type == Shape.CONSTRUCTION){
			undoManager.execute(new AddConstructionCommand(this.previewShape));
		}else{
			undoManager.execute(new AddShapeCommand(this.previewShape));
		}

		// Keep reference for dimension adjustment
		this.createdShape = this.previewShape;
		this.previewShape = null;

		this.state = STATE.ADJUSTING;

		// Show dimension input
		stage.setInputCallback(this.updateDimension);
		stage.setDimensionInputValue(Math.abs(this.signedOffset).toFixed(2), 'Offset distance');

		stage.render();
	}

	updatePreviewOffset(offset) {
		if (!this.previewShape) return;

		if (this.offsetType === OFFSET_TYPE.LINE) {
			const tx = this.unitNormal.x * offset;
			const ty = this.unitNormal.y * offset;

			this.previewShape.start.x = this.lineStartOrig.x + tx;
			this.previewShape.start.y = this.lineStartOrig.y + ty;
			this.previewShape.end.x = this.lineEndOrig.x + tx;
			this.previewShape.end.y = this.lineEndOrig.y + ty;
		} else {
			// Circle or arc - adjust radius
			const newRadius = Math.max(0.1, this.radiusOrig + offset);
			this.previewShape.radius = newRadius;
		}

		this.previewShape.update();
	}

	updateDimension(newDim) {
		const dim = parseFloat(newDim);
		if (isNaN(dim) || dim === 0) return;
		if (this.state !== STATE.ADJUSTING) return;
		if (!this.createdShape) return;

		// Apply sign from original drag direction
		const signedDim = this.signedOffset < 0 ? -Math.abs(dim) : Math.abs(dim);

		if (this.offsetType === OFFSET_TYPE.LINE) {
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
					shape: this.createdShape,
					index: 0,
					oldX: this.createdShape.start.x,
					oldY: this.createdShape.start.y,
					newX: newStartX,
					newY: newStartY
				},
				{
					shape: this.createdShape,
					index: 1,
					oldX: this.createdShape.end.x,
					oldY: this.createdShape.end.y,
					newX: newEndX,
					newY: newEndY
				}
			];

			// Execute move command (handles undo and intersection recalculation)
			undoManager.execute(new MoveCommand(moveData));
		} else {
			// Circle or arc - update radius directly
			const newRadius = this.radiusOrig + signedDim;
			if (newRadius <= 0) return;

			this.createdShape.radius = newRadius;
			this.createdShape.update();
			data.rebuildPOIs();
			data.recalculateIntersectionsForShape(this.createdShape);
		}

		this.signedOffset = signedDim;

		stage.render();
	}
}
