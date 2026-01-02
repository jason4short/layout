import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {GeometryUtils} 	from '../geometry/GeometryUtils.js';
import {Line} 			from '../geometry/Line.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import { ChamferCommand } from '../core/Commands.js';

// Explicit states for the chamfer tool
const STATE = {
	IDLE: 0,            // Waiting for first line click
	FIRST_SELECTED: 1,  // First line selected, waiting for second
	DRAGGING: 2         // Mouse down, dragging to second line
};

export class ChamferTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Chamfer";
		this.usage 	= "Click two lines to add a beveled corner. Shift+click near intersection for quick chamfer.";
		this.cursor = "cursor_chamfer";

		this.generateGuides = false;

		// State machine
		this.state 			= STATE.IDLE;
		this.firstLine 		= null;
		this.firstClickPt 	= null;
		this.distance 		= 25;

		// Preview
		this.linePreview 	= null;

		// For distance adjustment after creation
		this.lastChamfer 	= null;  // {chamferLine, line1, line2, line1Original, line2Original, clickPt1, clickPt2}

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
		this.updateDistance = this.updateDistance.bind(this);
	}

	begin() {
		this.state = STATE.IDLE;

		stage.setCursor('chamfer');

		toolManager.addEventListener('mouseDown', this.onMouseDown);
		toolManager.addEventListener('mouseMove', this.onMouseMove);
		toolManager.addEventListener('mouseUp', this.onMouseUp);
	}

	exit() {
		stage.setCursor('crosshairs');

		toolManager.removeEventListener('mouseDown', this.onMouseDown);
		toolManager.removeEventListener('mouseMove', this.onMouseMove);
		toolManager.removeEventListener('mouseUp', this.onMouseUp);
		this.reset();
	}

	updateCursor(){
		stage.setCursor('chamfer');
	}

	reset() {
		if (this.firstLine) {
			this.firstLine.selected = false;
		}
		if (this.linePreview) {
			data.removeTempShape();
			this.linePreview = null;
		}

		this.state 			= STATE.IDLE;
		this.firstLine 		= null;
		this.firstClickPt 	= null;
	}

	onMouseDown(e) {
		const clickPt = { x: e.x, y: e.y };
		const snapPt = data.getCurrentSnapPoint();

		// Shift+click: quick chamfer at nearest intersection
		if (stage.shiftKey) {
			this.quickChamfer(clickPt);
			return;
		}

		const clickedShape = data.getTargetShape(e);
		const isLine = clickedShape && clickedShape.geometry === Shape.LINE;

		switch (this.state) {
			case STATE.IDLE:
				if (!isLine) return;

				// Select first line, start potential drag
				this.firstLine 			= clickedShape;
				this.firstClickPt 		= clickPt;
				this.firstLine.selected = true;
				this.state 				= STATE.DRAGGING;

				// Create preview line
				this.linePreview = new Line([snapPt.x, snapPt.y, snapPt.x, snapPt.y]);
				data.addTempShape(this.linePreview);
				stage.render();
				break;

			case STATE.FIRST_SELECTED:
				if (!isLine) {
					// Clicked empty space - cancel
					this.reset();
					stage.render();
					return;
				}
				if (clickedShape === this.firstLine) return;

				// Second line clicked - create chamfer
				this.completeChamfer(clickedShape, clickPt);
				break;

			case STATE.DRAGGING:
				// Shouldn't happen - mouseUp handles this
				break;
		}
	}

	onMouseMove(e) {
		if (this.state === STATE.DRAGGING || this.state === STATE.FIRST_SELECTED) {
			const snapPt = data.getCurrentSnapPoint();
			if (this.linePreview) {
				this.linePreview.end.x = snapPt.x;
				this.linePreview.end.y = snapPt.y;
				this.linePreview.update();
				stage.render();
			}
		}
	}

	onMouseUp(e) {
		if (this.state !== STATE.DRAGGING) return;

		const releasePt = { x: e.x, y: e.y };
		const dragDist = GeometryUtils.distance(this.firstClickPt, releasePt);
		const secondLine = data.getTargetShape(e);
		const isValidSecond = secondLine &&
							  secondLine.geometry === Shape.LINE &&
							  secondLine !== this.firstLine;

		if (isValidSecond) {
			// Released on a valid second line - create chamfer
			this.completeChamfer(secondLine, releasePt);

		} else if (dragDist < 5) {
			// Small movement = click, wait for second click
			this.state = STATE.FIRST_SELECTED;

		} else {
			// Dragged to empty space - cancel
			this.reset();
			stage.render();
		}
	}

	completeChamfer(secondLine, secondClickPt) {
		const chamferLine = this.createChamfer(
			this.firstLine, this.firstClickPt,
			secondLine, secondClickPt,
			this.distance
		);

		if (chamferLine) {
			this.showDistanceInput();
		}

		this.reset();
		stage.render();
	}

	// Shift+click: find two lines at nearest intersection and chamfer them
	quickChamfer(clickPt) {
		const lines = data.getShapes().filter(s => s.geometry === Shape.LINE);
		if (lines.length < 2) return;

		// Find nearest intersection to click
		let bestIntersection = null;
		let bestDist = Infinity;
		let bestPair = null;

		for (let i = 0; i < lines.length; i++) {
			for (let j = i + 1; j < lines.length; j++) {
				const intersection = GeometryUtils.lineIntersection(lines[i], lines[j]);
				if (intersection) {
					const dist = GeometryUtils.distance(intersection, clickPt);
					if (dist < bestDist) {
						bestDist = dist;
						bestIntersection = intersection;
						bestPair = [lines[i], lines[j]];
					}
				}
			}
		}

		if (!bestIntersection || bestDist > 80) {
			console.log("No intersection found near click");
			return;
		}

		const chamferLine = this.createChamfer(bestPair[0], clickPt, bestPair[1], clickPt, this.distance);
		if (chamferLine) {
			this.showDistanceInput();
		}
		stage.render();
	}

	createChamfer(line1, clickPt1, line2, clickPt2, distance) {
		const intersection = GeometryUtils.lineIntersection(line1, line2);
		if (!intersection) {
			console.log("Lines are parallel, cannot chamfer");
			return null;
		}

		// Clone original line states BEFORE any modifications
		const line1Original = line1.clone();
		const line2Original = line2.clone();

		// Save original state for distance adjustment
		this.lastChamfer = {
			chamferLine: null,
			line1,
			line2,
			line1Original: {
				start: { x: line1.start.x, y: line1.start.y },
				end: { x: line1.end.x, y: line1.end.y }
			},
			line2Original: {
				start: { x: line2.start.x, y: line2.start.y },
				end: { x: line2.end.x, y: line2.end.y }
			},
			clickPt1,
			clickPt2
		};

		// Get directions along each line toward the click points (away from intersection)
		const dir1 = GeometryUtils.lineDirectionToward(line1, intersection, clickPt1);
		const dir2 = GeometryUtils.lineDirectionToward(line2, intersection, clickPt2);

		// Chamfer points at specified distance from intersection
		const chamferPt1 = {
			x: intersection.x + dir1.x * distance,
			y: intersection.y + dir1.y * distance
		};
		const chamferPt2 = {
			x: intersection.x + dir2.x * distance,
			y: intersection.y + dir2.y * distance
		};

		// Create chamfer line and add directly (command will track it)
		const chamferLine = new Line([
			chamferPt1.x, chamferPt1.y,
			chamferPt2.x, chamferPt2.y
		]);
		data.addShape(chamferLine);

		this.lastChamfer.chamferLine = chamferLine;

		// Trim lines
		GeometryUtils.trimLineAtPoint(line1, chamferPt1, dir1);
		GeometryUtils.trimLineAtPoint(line2, chamferPt2, dir2);

		// Execute ChamferCommand to track everything for undo
		undoManager.execute(new ChamferCommand(chamferLine, line1, line2, line1Original, line2Original));

		return chamferLine;
	}

	showDistanceInput() {
		stage.setInputCallback(this.updateDistance);
		stage.setDimensionInputValue(this.distance);
	}

	updateDistance(newDistance) {
		const d = parseFloat(newDistance);
		if (isNaN(d) || d <= 0) return;

		if (!this.lastChamfer || !this.lastChamfer.chamferLine) {
			this.distance = d;
			return;
		}

		const { chamferLine, line1, line2, line1Original, line2Original, clickPt1, clickPt2 } = this.lastChamfer;

		// Delete old chamfer line
		data.deleteShape(chamferLine);

		// Restore lines to original state
		line1.start.x = line1Original.start.x;
		line1.start.y = line1Original.start.y;
		line1.end.x = line1Original.end.x;
		line1.end.y = line1Original.end.y;
		line1.update();

		line2.start.x = line2Original.start.x;
		line2.start.y = line2Original.start.y;
		line2.end.x = line2Original.end.x;
		line2.end.y = line2Original.end.y;
		line2.update();

		// Create new chamfer with new distance
		this.distance = d;

		// Temporarily clear lastChamfer to prevent recursion issues
		const savedClickPts = { clickPt1, clickPt2, line1, line2 };
		this.lastChamfer = null;

		this.createChamfer(savedClickPts.line1, savedClickPts.clickPt1,
						  savedClickPts.line2, savedClickPts.clickPt2, d);

		stage.render();
	}
}
