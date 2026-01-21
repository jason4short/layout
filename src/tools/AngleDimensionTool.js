import {Tool} 				from './Tool.js';
import {Shape} 				from '../geometry/Geometry.js';
import {AngleDimension} 	from '../geometry/AngleDimension.js';
import {GeometryUtils} 		from '../geometry/GeometryUtils.js';
import {AddShapeCommand} 	from '../core/Commands.js';

import stage 				from '../core/Stage.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';

const STATE = {
	IDLE: 0,
	FIRST_LINE: 1,    // Have first line, waiting for second
	POSITIONING: 2    // Have both lines, positioning arc radius
};

export class AngleDimensionTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Angle Dimension";
		this.usage 	= "Click first line, click second line, click to position the angle arc.";

		this.generateGuides = false;

		this.state 			= STATE.IDLE;
		this.dimension 		= null;
		this.firstLine 		= null;
		this.firstClickPt 	= null;
		this.secondLine 	= null;
		this.secondClickPt 	= null;
		this.vertex 		= null;

		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
	}

	begin(){
		this.state = STATE.IDLE;
	}

	exit(){
		this.reset();
	}

	updateCursor(){
		stage.setCursor('crosshair');
	}

	reset(){
		if (this.firstLine) this.firstLine.selected = false;
		if (this.secondLine) this.secondLine.selected = false;

		this.state = STATE.IDLE;
		this.dimension = null;
		this.firstLine = null;
		this.firstClickPt = null;
		this.secondLine = null;
		this.secondClickPt = null;
		this.vertex = null;

		data.resetSnaps();
		data.clearGuides();
		data.clearTempShapes();
		stage.render();
	}

	onMouseDown(e)
	{
		const snap = { x: data.snapPoint.x, y: data.snapPoint.y };
		const clickedShape = data.getTargetShape();

		if (this.state === STATE.IDLE) {
			// First click - must be a line
			if (!clickedShape || clickedShape.geometry !== Shape.LINE) {
				return; // Ignore non-line clicks
			}

			this.firstLine = clickedShape;
			this.firstClickPt = snap;
			this.firstLine.selected = true;

			this.state = STATE.FIRST_LINE;
			stage.render();

		} else if (this.state === STATE.FIRST_LINE) {
			// Second click - must be a different line
			if (!clickedShape || clickedShape.geometry !== Shape.LINE) {
				return;
			}
			if (clickedShape === this.firstLine) {
				return; // Can't use same line
			}

			this.secondLine = clickedShape;
			this.secondClickPt = snap;
			this.secondLine.selected = true;

			// Calculate intersection
			this.vertex = GeometryUtils.lineIntersection(this.firstLine, this.secondLine);

			if (!this.vertex) {
				console.log("Lines are parallel, cannot create angle dimension");
				this.reset();
				return;
			}

			// Calculate angles of each line from the vertex
			// Use the direction toward the click points
			const angle1 = this.getLineAngleFromVertex(this.firstLine, this.vertex, this.firstClickPt);
			const angle2 = this.getLineAngleFromVertex(this.secondLine, this.vertex, this.secondClickPt);

			// Initial arc radius based on distance from vertex to click
			const dist1 = GeometryUtils.distance(this.vertex, this.firstClickPt);
			const dist2 = GeometryUtils.distance(this.vertex, this.secondClickPt);
			const arcRadius = Math.max(20, Math.min(dist1, dist2) * 0.6);

			// Create preview dimension with click points and line references
			this.dimension = new AngleDimension([
				this.vertex.x, this.vertex.y,
				angle1,
				angle2,
				arcRadius,
				{ x: this.firstClickPt.x, y: this.firstClickPt.y },
				{ x: this.secondClickPt.x, y: this.secondClickPt.y },
				this.firstLine,   // line1 reference
				this.secondLine   // line2 reference
			]);
			data.addTempShape(this.dimension);

			this.state = STATE.POSITIONING;
			stage.render();

		} else if (this.state === STATE.POSITIONING) {
			// Third click - commit
			data.clearTempShapes();
			undoManager.execute(new AddShapeCommand(this.dimension));

			this.firstLine.selected = false;
			this.secondLine.selected = false;
			this.reset();
		}
	}

	onMouseMove(e){
		if (this.state === STATE.POSITIONING && this.dimension) {
			// Adjust arc radius based on mouse distance from vertex
			const snap = data.snapPoint;
			const dist = GeometryUtils.distance(this.vertex, snap);
			this.dimension.arcRadius = Math.max(15, dist);
			this.dimension.update();
			stage.render();
		}
	}

	onMouseUp(e){
		// Click-based workflow
	}

	/**
	 * Get the angle of a line from a vertex point, in the direction of clickPt.
	 */
	getLineAngleFromVertex(line, vertex, clickPt) {
		// Get line direction
		const dx = line.end.x - line.start.x;
		const dy = line.end.y - line.start.y;

		// Check which direction points toward clickPt
		const toClick = {
			x: clickPt.x - vertex.x,
			y: clickPt.y - vertex.y
		};

		// Dot product to determine direction
		const dot = dx * toClick.x + dy * toClick.y;

		if (dot >= 0) {
			// Line direction points toward click
			return Math.atan2(dy, dx);
		} else {
			// Opposite direction points toward click
			return Math.atan2(-dy, -dx);
		}
	}
}
