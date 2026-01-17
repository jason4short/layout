import {Tool} 			from './Tool.js';
import {Shape} 			from '../geometry/Geometry.js';
import {GeometryUtils} 	from '../geometry/GeometryUtils.js';
import {Arc} 			from '../geometry/Arc.js';
import {Line} 			from '../geometry/Line.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';
import undoManager		from '../core/UndoManager.js';
import da 				from '../geometry/DraftingAssistant.js';

import { FilletCommand } from '../core/Commands.js';

// Helper to check if shape is a circular type (arc or circle)
const isCircularShape = (shape) => {
	return shape && (shape.geometry === Shape.ARC ||
					 shape.geometry === Shape.CIRCLE ||
					 shape.geometry === Shape.TANGENT_ARC);
};

// Helper to check if shape is fillettable
const isFilletableShape = (shape) => {
	return shape && (shape.geometry === Shape.LINE || isCircularShape(shape));
};

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
		this.usage 	= "Click two shapes (lines, arcs, or circles) to add a rounded corner. Shift+click near intersection for quick fillet.";

		this.generateGuides = false;

		// State machine
		this.state 			= STATE.IDLE;
		this.firstShape 	= null;
		this.firstClickPt 	= null;
		this.radius 		= 20;

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
		this.showRadiusInput()
	}

	exit() {
		toolManager.removeEventListener('mouseDown', this.onMouseDown);
		toolManager.removeEventListener('mouseMove', this.onMouseMove);
		toolManager.removeEventListener('mouseUp', this.onMouseUp);
		stage.setInputCallback(null);
		this.reset();
	}

	updateCursor(){
		stage.setCursor('fillet');
	}

	reset() {
		console.log("Reset!!")
		if (this.firstShape) {
			this.firstShape.selected = false;
		}
		if (this.linePreview) {
			data.clearTempShapes();
			this.linePreview = null;
		}

		this.state 			= STATE.IDLE;
		this.firstShape 	= null;
		this.firstClickPt 	= null;
		this.lastFillet 	= null;
	}

	onMouseDown(e) {
		const clickPt = { x: e.x, y: e.y };
		const snapPt = da.getCurrentSnapPoint();

		// Option+click: quick fillet at nearest intersection
		if (stage.shiftKey) {
			this.quickFillet(clickPt);
			return;
		}

		const clickedShape = data.getTargetShape();		
		const isValidShape = isFilletableShape(clickedShape);

		switch (this.state) {
			case STATE.IDLE:
				if (!isValidShape) return;

				// Select first shape, start potential drag
				this.firstShape 		= clickedShape;
				this.firstClickPt 		= snapPt;
				this.firstShape.selected = true;
				this.state 				= STATE.DRAGGING;

				// Create preview line
				this.linePreview = new Line([snapPt.x, snapPt.y, snapPt.x, snapPt.y]);
				data.addTempShape(this.linePreview);
				stage.render();
				break;

			case STATE.FIRST_SELECTED:
				if (!isValidShape) {
					// Clicked empty space - cancel
					this.reset();
					stage.render();
					return;
				}
				if (clickedShape === this.firstShape) return;

				// Second shape clicked - create fillet
				this.completeFillet(clickedShape, clickPt);
				break;

			case STATE.DRAGGING:
				// Shouldn't happen - mouseUp handles this
				break;
		}
	}

	onMouseMove(e) {
		if (this.state === STATE.DRAGGING || this.state === STATE.FIRST_SELECTED) {
			const snapPt = da.getCurrentSnapPoint();
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

		//const releasePt = { x: e.x, y: e.y };
		const releasePt = da.getCurrentSnapPoint();
		
		const dragDist = GeometryUtils.distance(this.firstClickPt, releasePt);
		const secondShape = data.getTargetShape();
		
		const isValidSecond = isFilletableShape(secondShape) &&
							  secondShape !== this.firstShape;

		if (isValidSecond) {
			// Released on a valid second shape - create fillet
			this.completeFillet(secondShape, releasePt);

		} else if (dragDist < 5) {
			// Small movement = click, wait for second click
			this.state = STATE.FIRST_SELECTED;

		} else {
			// Dragged to empty space - cancel
			this.reset();
			stage.render();
		}
	}

	completeFillet(secondShape, secondClickPt) {
		const shape1 		= this.firstShape;
		const isLine1 		= shape1.geometry === Shape.LINE;
		const isCircular1 	= isCircularShape(shape1);

		const shape2 		= secondShape;
		const isLine2 		= shape2.geometry === Shape.LINE;		
		const isCircular2 	= isCircularShape(shape2);

		let arc = null;

		if (isLine1 && isLine2) {
			// Line-Line fillet (original behavior)
			arc = this.createFilletLineLine(shape1, this.firstClickPt, shape2, secondClickPt, this.radius);

		} else if (isLine1 && isCircular2) {
			// Line-Arc/Circle fillet
			arc = this.createFilletLineArc(shape1, this.firstClickPt, shape2, secondClickPt, this.radius);

		} else if (isCircular1 && isLine2) {
			// Arc/Circle-Line fillet (swap order)
			arc = this.createFilletLineArc(shape2, secondClickPt, shape1, this.firstClickPt, this.radius);

		} else if (isCircular1 && isCircular2) {
			// Arc-Arc fillet
			arc = this.createFilletArcArc(shape1, this.firstClickPt, shape2, secondClickPt, this.radius);
		}

		if (arc) {
			this.showRadiusInput();
		}

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

		const arc = this.createFilletLineLine(bestPair[0], clickPt, bestPair[1], clickPt, this.radius);
		if (arc) {
			this.showRadiusInput();
		}
		stage.render();
	}

	createFilletLineLine(line1, clickPt1, line2, clickPt2, radius) {
	
		const intersection = GeometryUtils.lineIntersection(line1, line2); // a point
		
		if (!intersection) {
			console.log("Lines are parallel, cannot fillet");
			return null;
		}

		// Clone original line states BEFORE any modifications
		const line1Original = line1.clone();
		const line2Original = line2.clone();

		// Save original state for radius adjustment
		this.lastFillet = {
			arc: null,
			shape1: line1,
			shape2: line2,
			shape1Original: line1Original,
			shape2Original: line2Original,
			clickPt1,
			clickPt2,
			type: 'lineLine'
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

		// Create fillet arc and add directly (command will track it)
		const arc = new Arc([center.x, center.y, radius, arcStartAngle, arcEndAngle]);
		data.addShape(arc);

		this.lastFillet.arc = arc;

		// Trim lines - keep the side the user clicked on
		//GeometryUtils.trimLineKeepClickSide(line1, tangent1, clickPt1);
		//GeometryUtils.trimLineKeepClickSide(line2, tangent2, clickPt2);
		
		GeometryUtils.trimLineKeepClickSide(line1, intersection, clickPt1, tangent1);
		GeometryUtils.trimLineKeepClickSide(line2, intersection, clickPt2, tangent2);

		// Execute FilletCommand to track everything for undo
		undoManager.execute(new FilletCommand(arc, line1, line2, line1Original, line2Original));

		return arc;
	}

	/**
	 * Create a fillet between a line and a circular shape (arc or circle).
	 * The fillet arc will be tangent to both the line and the circular shape.
	 */
	createFilletLineArc(line, lineClickPt, circularShape, arcClickPt, radius) {
		const arcCenter = { x: circularShape.x, y: circularShape.y };
		const arcRadius = circularShape.radius;
		const isCircle = circularShape.geometry === Shape.CIRCLE;

		// Clone original states BEFORE any modifications
		const lineOriginal = line.clone();
		const arcOriginal = isCircle ? null : circularShape.clone();

		// Try both internal and external tangency, pick the best result
		let bestCenter = null;
		let bestScore = Infinity;
		let bestIsInternal = false;

		for (const isInternal of [false, true]) {
			// Target distance from fillet center to arc center
			const targetDistFromArcCenter = isInternal
				? Math.abs(arcRadius - radius)
				: arcRadius + radius;

			// Skip if internal tangency would require fillet larger than arc
			if (isInternal && radius >= arcRadius) continue;

			// Find candidate fillet centers
			const candidates = GeometryUtils.circleLineOffsetIntersection(
				arcCenter, targetDistFromArcCenter, line, radius
			);

			for (const center of candidates) {
				// Verify the tangent point on line
				const tangentOnLine = GeometryUtils.projectPointOntoLine(center, line);

				// Verify the tangent point on arc/circle
				const tangentOnArc = GeometryUtils.tangentPointOnArc(arcCenter, arcRadius, center, isInternal);
				if (!tangentOnArc) continue;

				// For arcs (not circles), check if tangent point is within arc's angle range
				if (!isCircle) {
					const tangentAngle = Math.atan2(tangentOnArc.y - arcCenter.y, tangentOnArc.x - arcCenter.x);
					if (!circularShape.containsAngle(tangentAngle)) continue;
				}

				// Score by distance from tangent points to click points
				// This better reflects "is the fillet in the right corner"
				const score = GeometryUtils.distance(tangentOnLine, lineClickPt) +
							  GeometryUtils.distance(tangentOnArc, arcClickPt);

				if (score < bestScore) {
					bestScore = score;
					bestCenter = center;
					bestIsInternal = isInternal;
				}
			}
		}

		if (!bestCenter) {
			console.log("No valid fillet position found");
			return null;
		}

		const isInternal = bestIsInternal;

		// Calculate tangent points
		const tangentOnLine = GeometryUtils.projectPointOntoLine(bestCenter, line);
		const tangentOnArc = GeometryUtils.tangentPointOnArc(arcCenter, arcRadius, bestCenter, isInternal);

		// Calculate fillet arc angles
		const angle1 = Math.atan2(tangentOnLine.y - bestCenter.y, tangentOnLine.x - bestCenter.x);
		const angle2 = Math.atan2(tangentOnArc.y - bestCenter.y, tangentOnArc.x - bestCenter.x);

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
		const filletArc = new Arc([bestCenter.x, bestCenter.y, radius, arcStartAngle, arcEndAngle]);
		data.addShape(filletArc);

		// Trim line - keep the side the user clicked on
		GeometryUtils.trimLineKeepClickSide(line, tangentOnLine, lineClickPt, tangentOnLine);
		//GeometryUtils.trimLineKeepClickSide(line, intersection, lineClickPt, tangentOnLine);

		// Trim arc - keep the side the user clicked on
		if (!isCircle) {
			GeometryUtils.trimArcKeepClickSide(circularShape, tangentOnArc, arcClickPt);
		}

		// Save for radius adjustment and undo
		this.lastFillet = {
			arc: filletArc,
			shape1: line,
			shape2: circularShape,
			shape1Original: lineOriginal,
			shape2Original: arcOriginal,
			clickPt1: lineClickPt,
			clickPt2: arcClickPt,
			type: 'lineArc'
		};

		// Execute command for undo (using generic shape handling)
		undoManager.execute(new FilletCommand(filletArc, line, circularShape, lineOriginal, arcOriginal));

		return filletArc;
	}

	/**
	 * Create a fillet between two circular shapes (arcs or circles).
	 * The fillet arc will be tangent to both circular shapes.
	 */
	createFilletArcArc(circShape1, clickPt1, circShape2, clickPt2, radius) {
		const center1 = { x: circShape1.x, y: circShape1.y };
		const radius1 = circShape1.radius;
		const isCircle1 = circShape1.geometry === Shape.CIRCLE;

		const center2 = { x: circShape2.x, y: circShape2.y };
		const radius2 = circShape2.radius;
		const isCircle2 = circShape2.geometry === Shape.CIRCLE;

		// Clone original states BEFORE any modifications
		const shape1Original = isCircle1 ? null : circShape1.clone();
		const shape2Original = isCircle2 ? null : circShape2.clone();

		// Try all combinations of internal/external tangency
		let bestCenter = null;
		let bestScore = Infinity;
		let bestIsInternal1 = false;
		let bestIsInternal2 = false;

		for (const isInternal1 of [false, true]) {
			for (const isInternal2 of [false, true]) {
				// Skip invalid internal tangency cases
				if (isInternal1 && radius >= radius1) continue;
				if (isInternal2 && radius >= radius2) continue;

				// Target distances from fillet center to each arc center
				const targetDist1 = isInternal1 ? Math.abs(radius1 - radius) : radius1 + radius;
				const targetDist2 = isInternal2 ? Math.abs(radius2 - radius) : radius2 + radius;

				// Find candidate fillet centers using circle-circle intersection
				const candidates = GeometryUtils.circleCircleIntersection(
					center1.x, center1.y, targetDist1,
					center2.x, center2.y, targetDist2
				);

				for (const center of candidates) {
					// Calculate tangent points
					const tangent1 = GeometryUtils.tangentPointOnArc(center1, radius1, center, isInternal1);
					const tangent2 = GeometryUtils.tangentPointOnArc(center2, radius2, center, isInternal2);

					if (!tangent1 || !tangent2) continue;

					// For arcs (not circles), check if tangent points are within angle ranges
					if (!isCircle1) {
						const angle1 = Math.atan2(tangent1.y - center1.y, tangent1.x - center1.x);
						if (!circShape1.containsAngle(angle1)) continue;
					}

					if (!isCircle2) {
						const angle2 = Math.atan2(tangent2.y - center2.y, tangent2.x - center2.x);
						if (!circShape2.containsAngle(angle2)) continue;
					}

					// Score by distance from tangent points to click points
					const score = GeometryUtils.distance(tangent1, clickPt1) +
								  GeometryUtils.distance(tangent2, clickPt2);

					if (score < bestScore) {
						bestScore = score;
						bestCenter = center;
						bestIsInternal1 = isInternal1;
						bestIsInternal2 = isInternal2;
					}
				}
			}
		}

		if (!bestCenter) {
			console.log("No valid fillet position found - tangent points may be outside arc ranges");
			return null;
		}

		const isInternal1 = bestIsInternal1;
		const isInternal2 = bestIsInternal2;

		// Calculate tangent points with the best center
		const tangent1 = GeometryUtils.tangentPointOnArc(center1, radius1, bestCenter, isInternal1);
		const tangent2 = GeometryUtils.tangentPointOnArc(center2, radius2, bestCenter, isInternal2);

		// Calculate fillet arc angles
		const arcAngle1 = Math.atan2(tangent1.y - bestCenter.y, tangent1.x - bestCenter.x);
		const arcAngle2 = Math.atan2(tangent2.y - bestCenter.y, tangent2.x - bestCenter.x);

		// Choose shorter arc direction
		let ccwSweep = arcAngle2 - arcAngle1;
		if (ccwSweep < 0) ccwSweep += Math.PI * 2;

		let altSweep = arcAngle1 - arcAngle2;
		if (altSweep < 0) altSweep += Math.PI * 2;

		let arcStartAngle, arcEndAngle;
		if (ccwSweep <= altSweep) {
			arcStartAngle = arcAngle1;
			arcEndAngle = arcAngle2;
		} else {
			arcStartAngle = arcAngle2;
			arcEndAngle = arcAngle1;
		}

		// Create fillet arc
		const filletArc = new Arc([bestCenter.x, bestCenter.y, radius, arcStartAngle, arcEndAngle]);
		data.addShape(filletArc);

		// Trim arcs - keep the side the user clicked on
		if (!isCircle1) {
			GeometryUtils.trimArcKeepClickSide(circShape1, tangent1, clickPt1);
		}
		if (!isCircle2) {
			GeometryUtils.trimArcKeepClickSide(circShape2, tangent2, clickPt2);
		}

		// Save for radius adjustment and undo
		this.lastFillet = {
			arc: filletArc,
			shape1: circShape1,
			shape2: circShape2,
			shape1Original,
			shape2Original,
			clickPt1,
			clickPt2,
			type: 'arcArc'
		};

		// Execute command for undo
		undoManager.execute(new FilletCommand(filletArc, circShape1, circShape2, shape1Original, shape2Original));

		return filletArc;
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
			this.lastFillet = null;
			console.log("set r "+this.radius)
			return;
		}

		const { arc, shape1, shape2, shape1Original, shape2Original, clickPt1, clickPt2, type } = this.lastFillet;

		// Delete old arc
		data.deleteShape(arc);

		// Restore shapes to original state (if they were trimmed)
		if (shape1Original) {
			shape1.copyFrom(shape1Original);
		}
		if (shape2Original) {
			shape2.copyFrom(shape2Original);
		}

		// Update radius
		this.radius = r;

		// Clear lastFillet to prevent recursion
		this.lastFillet = null;

		// Re-create fillet with new radius based on type
		if (type === 'lineArc') {
			this.createFilletLineArc(shape1, clickPt1, shape2, clickPt2, r);
		} else if (type === 'arcArc') {
			this.createFilletArcArc(shape1, clickPt1, shape2, clickPt2, r);
		} else {
			// Default: line-line fillet
			this.createFilletLineLine(shape1, clickPt1, shape2, clickPt2, r);
		}

		stage.render();
	}
}
