import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {GeometryUtils} 	from '../geometry/GeometryUtils.js';
import {Line} 			from '../geometry/Line.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import {AddShapeCommand} from '../core/Commands.js';

// Explicit states
const STATE = {
	IDLE: 0,
	FIRST_SELECTED: 1
};

export class ChamferTool extends Tool
{
	constructor()
	{
		super();

		this.name 		= "Chamfer";
		this.usage 		= "Click two lines to add a beveled corner. Option+click to keep original lines.";
		this.cursor 	= "cursor_chamfer";

		this.generateGuides = false;

		this.state 		= STATE.IDLE;
		this.firstLine 	= null;
		this.distance 	= 25;

		this.onMouseDown = this.onMouseDown.bind(this);
	}

	begin() {
		this.state = STATE.IDLE;
		toolManager.addEventListener('mouseDown', this.onMouseDown);
	}

	exit() {
		toolManager.removeEventListener('mouseDown', this.onMouseDown);
		this.reset();
	}
	updateCursor(){
		stage.setCursor('crosshair');
	}

	reset() {
		if (this.firstLine) {
			this.firstLine.selected = false;
		}
		this.state = STATE.IDLE;
		this.firstLine = null;
	}

	onMouseDown(e) {
		const clickedShape = data.getTargetShape(e);
		const isLine = clickedShape && clickedShape.geometry === Shape.LINE;

		if (!isLine) {
			if (this.state === STATE.FIRST_SELECTED) {
				this.reset();
				stage.render();
			}
			return;
		}

		switch (this.state) {
			case STATE.IDLE:
				this.firstLine = clickedShape;
				this.firstLine.selected = true;
				this.state = STATE.FIRST_SELECTED;
				stage.render();
				break;

			case STATE.FIRST_SELECTED:
				if (clickedShape === this.firstLine) return;

				const noTrim = stage.optionKey;
				this.createChamfer(this.firstLine, clickedShape, this.distance, noTrim);

				this.reset();
				stage.render();
				break;
		}
	}

	createChamfer(line1, line2, distance, noTrim) {
		const intersection = GeometryUtils.lineIntersection(line1, line2);
		if (!intersection) {
			console.log("Lines are parallel, cannot chamfer");
			return;
		}

		// Get directions away from intersection
		const dir1 = GeometryUtils.lineDirectionAwayFrom(line1, intersection);
		const dir2 = GeometryUtils.lineDirectionAwayFrom(line2, intersection);

		// Chamfer points at specified distance from intersection
		const chamferPt1 = {
			x: intersection.x + dir1.x * distance,
			y: intersection.y + dir1.y * distance
		};
		const chamferPt2 = {
			x: intersection.x + dir2.x * distance,
			y: intersection.y + dir2.y * distance
		};

		// Create chamfer line
		const chamferLine = new Line([
			chamferPt1.x, chamferPt1.y,
			chamferPt2.x, chamferPt2.y
		]);
		undoManager.execute(new AddShapeCommand(chamferLine));

		// Trim lines
		if (!noTrim) {
			GeometryUtils.trimLineAtPoint(line1, chamferPt1, dir1);
			GeometryUtils.trimLineAtPoint(line2, chamferPt2, dir2);
		}
	}
}
