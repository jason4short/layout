import {Tool} 				from './Tool.js';
import {Shape} 				from '../geometry/Geometry.js';
import {Dimension} 			from '../geometry/Dimension.js';
import {RadialDimension} 	from '../geometry/RadialDimension.js';
import {AddShapeCommand} 	from '../core/Commands.js';

import stage 				from '../core/Stage.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';

const STATE = {
	IDLE: 0,
	FIRST_POINT: 1,   // Have first point, waiting for second (linear)
	SECOND_POINT: 2,  // Have both points, waiting for offset click (linear)
	RADIAL: 3         // Clicked on circle/arc, waiting for position click
};

// Helper to check if shape is a circular type
const isCircularShape = (shape) => {
	return shape && (shape.geometry === Shape.ARC ||
					 shape.geometry === Shape.CIRCLE ||
					 shape.geometry === Shape.TANGENT_ARC);
};

export class DimensionTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Dimension";
		this.usage 	= "Click two points for linear dimension, or click a circle/arc for radius dimension. Option+click for diameter.";

		this.generateGuides 	= false;

		this.state 				= STATE.IDLE;
		this.dimension 			= null;
		this.startPoint 		= null;
		this.endPoint 			= null;

		// For radial dimensions
		this.targetShape 		= null;
		this.radialMode 		= 'radius';  // 'radius' or 'diameter'

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}

	begin(){
		this.state = STATE.IDLE;
	}

	deactivate(){
		this.reset();
	}

	updateCursor(){
		stage.setCursor('crosshair');
	}

	reset(){
		this.state = STATE.IDLE;
		this.dimension = null;
		this.startPoint = null;
		this.endPoint = null;
		this.targetShape = null;
		this.radialMode = 'radius';
		data.resetSnaps();
		data.clearGuides();
		data.clearTempShapes();
		stage.render();
	}

	onMouseDown(e)
	{
		data.resetSnaps();
		const snap = { x: data.snapPoint.x, y: data.snapPoint.y };

		if(this.state === STATE.IDLE){
			// Check if user clicked on a circle or arc
			const clickedShape = data.getTargetShape();

			if (isCircularShape(clickedShape)) {
				// Start radial dimension workflow
				this.targetShape = clickedShape;
				this.radialMode = stage.optionKey ? 'diameter' : 'radius';

				// Calculate initial angle from center to click point
				const angle = Math.atan2(
					snap.y - clickedShape.y,
					snap.x - clickedShape.x
				);

				// Create preview radial dimension
				this.dimension = new RadialDimension([
					clickedShape.x, clickedShape.y,
					clickedShape.radius,
					angle,
					this.radialMode,
					30  // default text offset
				]);
				data.addTempShape(this.dimension);

				this.state = STATE.RADIAL;

			} else {
				// Start linear dimension workflow
				this.startPoint = snap;

				// Create preview dimension with zero offset
				this.dimension = new Dimension([
					snap.x, snap.y,
					snap.x, snap.y,
					0
				]);
				data.addTempShape(this.dimension);

				// Create guides from first point
				draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);

				this.state = STATE.FIRST_POINT;
			}

		} else if(this.state === STATE.FIRST_POINT){
			// Second click - set end point
			this.endPoint = snap;

			// Update dimension with end point
			this.dimension.end.x = snap.x;
			this.dimension.end.y = snap.y;
			this.dimension.update();

			this.state = STATE.SECOND_POINT;

		} else if(this.state === STATE.SECOND_POINT){
			// Third click - set offset and commit
			const offset = this.calculateOffset(snap);
			this.dimension.offset = offset;
			this.dimension.update();

			// Commit the dimension
			data.clearTempShapes();
			undoManager.execute(new AddShapeCommand(this.dimension));

			this.reset();

		} else if(this.state === STATE.RADIAL){
			// Commit the radial dimension
			data.clearTempShapes();
			undoManager.execute(new AddShapeCommand(this.dimension));

			this.reset();
		}

		stage.render();
	}

	onMouseMove(e){
		if(this.state === STATE.FIRST_POINT && this.dimension){
			// Update end point while dragging
			this.dimension.end.x = data.snapPoint.x;
			this.dimension.end.y = data.snapPoint.y;
			this.dimension.update();
			stage.render();

		} else if(this.state === STATE.SECOND_POINT && this.dimension){
			// Update offset based on mouse position
			const offset = this.calculateOffset(data.snapPoint);
			this.dimension.offset = offset;
			this.dimension.update();
			stage.render();

		} else if(this.state === STATE.RADIAL && this.dimension){
			// Update text position based on mouse position
			const snap = data.snapPoint;
			const center = this.dimension.center;

			// Set text position to mouse location
			this.dimension.textX = snap.x;
			this.dimension.textY = snap.y;

			// Calculate angle from center to text (arrow always points toward center)
			this.dimension.angle = Math.atan2(
				snap.y - center.y,
				snap.x - center.x
			);

			// Allow toggling mode with shift key during preview
			this.dimension.mode = stage.optionKey ? 'diameter' : 'radius';

			this.dimension.update();
			stage.render();
		}
	}

	onMouseUp(e){
		// We use click-based workflow, not drag
	}

	// Calculate perpendicular offset from mouse position to the measurement line
	calculateOffset(mousePoint){
		const start = this.startPoint;
		const end = this.endPoint;

		// Vector from start to end
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const len = Math.sqrt(dx * dx + dy * dy);

		if(len === 0) return 0;

		// Unit perpendicular vector
		const perpX = -dy / len;
		const perpY = dx / len;

		// Vector from start to mouse
		const toMouseX = mousePoint.x - start.x;
		const toMouseY = mousePoint.y - start.y;

		// Project onto perpendicular to get signed offset
		const offset = toMouseX * perpX + toMouseY * perpY;

		return offset;
	}
}
