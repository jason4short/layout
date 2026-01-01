import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {GeometryUtils} 	from '../geometry/GeometryUtils.js';
import {Arc} 			from '../geometry/Arc.js';
import {Line} 			from '../geometry/Line.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import {AddShapeCommand} from '../core/Commands.js';

// Explicit states for the fillet tool
const STATE = {
	IDLE: 0,            // Waiting for first line click
	FIRST_SELECTED: 1,  // First line selected, waiting for second
	DRAGGING: 2         // Mouse down, dragging to second line
};

export class FilletTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Fillet";
		this.usage 	= "Click two lines to add a rounded corner. Option+click near intersection for quick fillet.";
		this.cursor = "cursor_fillet";

		this.generateGuides = false;

		// State machine
		this.state 			= STATE.IDLE;
		this.firstLine 		= null;
		this.firstClickPt 	= null;
		this.radius 		= 25;

		// Preview
		this.linePreview 	= null;

		// For radius adjustment after creation
		this.lastFillet 	= null;  // {arc, line1, line2, line1Original, line2Original, clickPt1, clickPt2}

		this.onMouseDown 	= this.onMouseDown.bind(this);
		this.onMouseMove 	= this.onMouseMove.bind(this);
		this.onMouseUp 		= this.onMouseUp.bind(this);
		this.updateRadius 	= this.updateRadius.bind(this);
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

		// Option+click: quick fillet at nearest intersection
		if (stage.optionKey) {
			this.quickFillet(clickPt);
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

				// Second line clicked - create fillet
				this.completeFillet(clickedShape, clickPt);
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
			// Released on a valid second line - create fillet
			this.completeFillet(secondLine, releasePt);

		} else if (dragDist < 5) {
			// Small movement = click, wait for second click
			this.state = STATE.FIRST_SELECTED;

		} else {
			// Dragged to empty space - cancel
			this.reset();
			stage.render();
		}
	}

	completeFillet(secondLine, secondClickPt) {
		const arc = this.createFillet(
			this.firstLine, this.firstClickPt,
			secondLine, secondClickPt,
			this.radius
		);

		if (arc) {
			this.showRadiusInput();
		}

		this.reset();
		stage.render();
	}

	// Option+click: find two lines at nearest intersection and fillet them
	quickFillet(clickPt) {
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

		const arc = this.createFillet(bestPair[0], clickPt, bestPair[1], clickPt, this.radius);
		if (arc) {
			this.showRadiusInput();
		}
		stage.render();
	}

	createFillet(line1, clickPt1, line2, clickPt2, radius) {
		const intersection = GeometryUtils.lineIntersection(line1, line2);
		if (!intersection) {
			console.log("Lines are parallel, cannot fillet");
			return null;
		}

		// Save original state for radius adjustment
		this.lastFillet = {
			arc: null,
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

		// Get directions along each line toward the click points
		const dir1 = GeometryUtils.lineDirectionToward(line1, intersection, clickPt1);
		const dir2 = GeometryUtils.lineDirectionToward(line2, intersection, clickPt2);

		// Calculate angle between lines
		const angle = GeometryUtils.angleBetweenVectors(dir1, dir2);

		if (angle < 0.01 || angle > Math.PI - 0.01) {
			console.log("Lines are nearly parallel, cannot fillet");
			return null;
		}

		// Bisector direction (points into the corner)
		const bisector = GeometryUtils.normalize(GeometryUtils.addVectors(dir1, dir2));

		// Distance from intersection to arc center along bisector
		const halfAngle = angle / 2;
		const distToCenter = radius / Math.sin(halfAngle);

		// Arc center
		const center = {
			x: intersection.x + bisector.x * distToCenter,
			y: intersection.y + bisector.y * distToCenter
		};

		// Tangent points (project center onto each line)
		const tangent1 = GeometryUtils.projectPointOntoLine(center, line1);
		const tangent2 = GeometryUtils.projectPointOntoLine(center, line2);

		// Calculate arc angles
		const angle1 = Math.atan2(tangent1.y - center.y, tangent1.x - center.x);
		const angle2 = Math.atan2(tangent2.y - center.y, tangent2.x - center.x);

		// Choose shorter arc direction
		let ccwSweep = angle2 - angle1;
		if (ccwSweep < 0) ccwSweep += Math.PI * 2;

		let altSweep = angle1 - angle2;
		if (altSweep < 0) altSweep += Math.PI * 2;

		let arcStartAngle, arcEndAngle;
		if (ccwSweep <= altSweep) {
			arcStartAngle = angle1;
			arcEndAngle = angle2;
		} else {
			arcStartAngle = angle2;
			arcEndAngle = angle1;
		}

		// Create fillet arc
		const arc = new Arc([center.x, center.y, radius, arcStartAngle, arcEndAngle]);
		undoManager.execute(new AddShapeCommand(arc));

		this.lastFillet.arc = arc;

		// Trim lines
		GeometryUtils.trimLineAtPoint(line1, tangent1, dir1);
		GeometryUtils.trimLineAtPoint(line2, tangent2, dir2);

		return arc;
	}

	showRadiusInput() {
		stage.setInputCallback(this.updateRadius);
		stage.setDimensionInputValue(this.radius);
	}

	updateRadius(newRadius) {
		const r = parseFloat(newRadius);
		if (isNaN(r) || r <= 0) return;

		if (!this.lastFillet || !this.lastFillet.arc) {
			this.radius = r;
			return;
		}

		const { arc, line1, line2, line1Original, line2Original, clickPt1, clickPt2 } = this.lastFillet;

		// Delete old arc
		data.deleteShape(arc);

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

		// Create new fillet with new radius
		this.radius = r;

		// Temporarily clear lastFillet to prevent recursion issues
		const savedClickPts = { clickPt1, clickPt2, line1, line2 };
		this.lastFillet = null;

		this.createFillet(savedClickPts.line1, savedClickPts.clickPt1,
						  savedClickPts.line2, savedClickPts.clickPt2, r);

		stage.render();
	}
}
