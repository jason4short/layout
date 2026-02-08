import {Tool} 				from './Tool.js';
import { Shape, 	
		PenStyle } 			from '../geometry/Geometry.js';
			
import {GeometryUtils} 		from '../geometry/GeometryUtils.js';
import * as AngleUtils		from '../geometry/utils/AngleUtils.js';
import {Arc} 				from '../geometry/Arc.js';
import {Line} 				from '../geometry/Line.js';
	
import stage 				from '../core/Stage.js';
import toolManager			from './ToolManager.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';

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
		this.usage 	= "Click two shapes (lines, arcs, or circles) to add a rounded corner. Option+click near intersection for quick fillet.";

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

	deactivate(){
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
		//this.lastFillet 	= null;
		stage.render();
	}

	onMouseDown(e) {
		const snapPt 	= draftingAssistant.getCurrentSnapPoint();

		// Option+click: quick fillet at nearest intersection
		if (stage.optionKey) {
			const clickPt 	= { x: e.x, y: e.y };
			this.quickFillet(clickPt);
			return;
		}

		const clickedShape = data.getTargetShape();		
		const isValidShape = isFilletableShape(clickedShape);

		switch (this.state) {
			case STATE.IDLE:
				if (!isValidShape) return;

				// Select first shape, start potential drag
				this.firstShape 			= clickedShape;
				this.firstClickPt 			= snapPt;
				this.firstShape.selected 	= true;
				this.state 					= STATE.FIRST_SELECTED;

				// Create preview line
				this.linePreview 			= new Line([snapPt.x, snapPt.y, snapPt.x, snapPt.y]);
				this.linePreview.penStyle 	= PenStyle.HIDDEN

				data.addTempShape(this.linePreview);
				stage.render();
				break;

			case STATE.FIRST_SELECTED:
				if (!isValidShape) {
					// Clicked empty space - cancel
					this.reset();
					return;
				}
				if (clickedShape === this.firstShape) return;

				// Second shape clicked - create fillet
				this.completeFillet(clickedShape, snapPt);
				break;

		}
	}

	onMouseMove(e) {
		if (this.state === STATE.DRAGGING || this.state === STATE.FIRST_SELECTED) {
				this.state 	= STATE.DRAGGING;
		
			const snapPt = draftingAssistant.getCurrentSnapPoint();
			if (this.linePreview) {
				this.linePreview.end.x = snapPt.x;
				this.linePreview.end.y = snapPt.y;
				stage.render();
			}
		}
	}

	onMouseUp(e) {
		if (this.state !== STATE.DRAGGING) return;

		const releasePt 	= draftingAssistant.getCurrentSnapPoint();		
		const secondShape 	= data.getTargetShape();
		
		const isValidSecond = isFilletableShape(secondShape) &&
							  secondShape !== this.firstShape;

		if (isValidSecond) {
			this.completeFillet(secondShape, releasePt);
		}
		console.log("mouse up reset")
		this.reset();
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
			console.log("jason")
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

		// XXX radius can be zero - then it's a simple trim or extension. no need to create the arc. 
		
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
		arc.groupId = line1.groupId || line2.groupId; // Inherit group
		data.addShape(arc);

		this.lastFillet.arc = arc;
		
		GeometryUtils.trimLineKeepClickSide(line1, intersection, clickPt1, tangent1);
		GeometryUtils.trimLineKeepClickSide(line2, intersection, clickPt2, tangent2);

		// Execute FilletCommand to track everything for undo
		undoManager.execute(new FilletCommand(arc, line1, line2, line1Original, line2Original));

		return arc;
	}

	/**
	 * Create a fillet between a line and a circular shape (arc or circle).
	 * Uses simple distance-based scoring - pick candidate whose tangents are closest to clicks.
	 */
	createFilletLineArc(line, lineClickPt, circularShape, arcClickPt, radius) {
		const arcCenter = { x: circularShape.x, y: circularShape.y };
		const arcRadius = circularShape.radius;
		const isCircle = circularShape.geometry === Shape.CIRCLE;

		// Clone original states BEFORE any modifications
		const lineOriginal = line.clone();
		const arcOriginal = isCircle ? null : circularShape.clone();

		// Find ALL candidates from both tangency types
		const candidates = [];

		for (const isInternal of [false, true]) {
			if (isInternal && radius >= arcRadius) continue;

			const targetDist = isInternal ? Math.abs(arcRadius - radius) : arcRadius + radius;

			const pts = GeometryUtils.circleLineOffsetIntersection(
				arcCenter, targetDist, line, radius
			);

			for (const center of pts) {
				const tLine = GeometryUtils.projectPointOntoLine(center, line);
				const tArc = this.tangentPoint(arcCenter, arcRadius, center);
				if (!tLine || !tArc) continue;

				// Check if tangent point is on the arc (not just the circle)
				if (!isCircle) {
					const tArcAngle = Math.atan2(tArc.y - arcCenter.y, tArc.x - arcCenter.x);
					if (!circularShape.containsAngle(tArcAngle)) continue;
				}

				// Score by distance from tangent points to click points
				const score = GeometryUtils.distance(tLine, lineClickPt) +
							  GeometryUtils.distance(tArc, arcClickPt);

				candidates.push({
					center,
					tLine,
					tArc,
					score,
					isInternal
				});
			}
		}

		if (candidates.length === 0) {
			console.log("No valid fillet candidates found");
			return null;
		}

		// Select best match (lowest score = tangents closest to clicks)
		candidates.sort((a, b) => a.score - b.score);
		const best = candidates[0];

		// STEP 9: Create fillet arc
		const arcAngle1 = Math.atan2(best.tLine.y - best.center.y, best.tLine.x - best.center.x);
		const arcAngle2 = Math.atan2(best.tArc.y - best.center.y, best.tArc.x - best.center.x);

		let sweep1to2 = arcAngle2 - arcAngle1;
		if (sweep1to2 < 0) sweep1to2 += Math.PI * 2;
		let sweep2to1 = arcAngle1 - arcAngle2;
		if (sweep2to1 < 0) sweep2to1 += Math.PI * 2;

		let arcStartAngle, arcEndAngle;
		if (sweep1to2 <= sweep2to1) {
			arcStartAngle = arcAngle1;
			arcEndAngle = arcAngle2;
		} else {
			arcStartAngle = arcAngle2;
			arcEndAngle = arcAngle1;
		}

		const filletArc = new Arc([best.center.x, best.center.y, radius, arcStartAngle, arcEndAngle]);
		filletArc.groupId = line.groupId || circularShape.groupId;
		data.addShape(filletArc);

		// Trim line and arc
		GeometryUtils.trimLineKeepClickSide(line, best.tLine, lineClickPt, best.tLine);

		if (!isCircle) {
			this.trimArc(circularShape, best.tArc, arcClickPt);
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

		undoManager.execute(new FilletCommand(filletArc, line, circularShape, lineOriginal, arcOriginal));

		return filletArc;
	}

	/**
	 * Create a fillet between two circular shapes (arcs or circles).
	 * Uses the validated algorithm: find corner, input vector, dot product selection.
	 */
	createFilletArcArc(circShape1, clickPt1, circShape2, clickPt2, radius) {
		const c1 = { x: circShape1.x, y: circShape1.y };
		const r1 = circShape1.radius;
		const isCircle1 = circShape1.geometry === Shape.CIRCLE;

		const c2 = { x: circShape2.x, y: circShape2.y };
		const r2 = circShape2.radius;
		const isCircle2 = circShape2.geometry === Shape.CIRCLE;

		// Clone original states BEFORE any modifications
		const shape1Original = isCircle1 ? null : circShape1.clone();
		const shape2Original = isCircle2 ? null : circShape2.clone();

		// STEP 1: Find arc intersections
		const arcIntersections = GeometryUtils.circleCircleIntersection(c1.x, c1.y, r1, c2.x, c2.y, r2);
		if (arcIntersections.length === 0) {
			console.log("Arcs don't intersect - cannot fillet");
			return null;
		}

		// STEP 2: Find click midpoint
		const clickMidpoint = {
			x: (clickPt1.x + clickPt2.x) / 2,
			y: (clickPt1.y + clickPt2.y) / 2
		};

		// STEP 3: Find closest intersection to midpoint → corner
		let corner = arcIntersections[0];
		if (arcIntersections.length > 1) {
			const d0 = GeometryUtils.distance(arcIntersections[0], clickMidpoint);
			const d1 = GeometryUtils.distance(arcIntersections[1], clickMidpoint);
			corner = d0 <= d1 ? arcIntersections[0] : arcIntersections[1];
		}

		// STEP 4: Define input vector (corner → click midpoint)
		const inputVector = {
			x: clickMidpoint.x - corner.x,
			y: clickMidpoint.y - corner.y
		};
		const inputLen = Math.sqrt(inputVector.x * inputVector.x + inputVector.y * inputVector.y);
		if (inputLen < 1e-10) {
			console.log("Click midpoint too close to corner");
			return null;
		}

		// STEP 5: Find fillet candidates (one per tangency combo, closest to corner)
		const candidates = [];
		const combos = [
			{ name: "EXT-EXT", d1: r1 + radius, d2: r2 + radius, int1: false, int2: false },
			{ name: "EXT-INT", d1: r1 + radius, d2: Math.abs(r2 - radius), int1: false, int2: true },
			{ name: "INT-EXT", d1: Math.abs(r1 - radius), d2: r2 + radius, int1: true, int2: false },
			{ name: "INT-INT", d1: Math.abs(r1 - radius), d2: Math.abs(r2 - radius), int1: true, int2: true },
		];

		for (const combo of combos) {
			if (combo.int1 && radius >= r1) continue;
			if (combo.int2 && radius >= r2) continue;

			const pts = GeometryUtils.circleCircleIntersection(c1.x, c1.y, combo.d1, c2.x, c2.y, combo.d2);
			if (pts.length === 0) continue;

			// Pick the candidate closest to the chosen corner
			let bestPt = null;
			let bestDist = Infinity;
			for (const pt of pts) {
				const d = GeometryUtils.distance(pt, corner);
				if (d < bestDist) {
					bestDist = d;
					bestPt = pt;
				}
			}

			const center = bestPt;
			const t1 = this.tangentPoint(c1, r1, center);
			const t2 = this.tangentPoint(c2, r2, center);
			if (!t1 || !t2) continue;

			// VALIDATION 1: Check if tangent points are on the arcs
			const t1Angle = Math.atan2(t1.y - c1.y, t1.x - c1.x);
			const t2Angle = Math.atan2(t2.y - c2.y, t2.x - c2.x);

			if (!isCircle1 && !circShape1.containsAngle(t1Angle)) continue;
			if (!isCircle2 && !circShape2.containsAngle(t2Angle)) continue;

			// VALIDATION 2: Check trimmed arc would have positive length
			if (!isCircle1) {
				const tangentToStart = Math.abs(AngleUtils.normalizeAngleSigned(t1Angle - circShape1.startAngle));
				const tangentToEnd = Math.abs(AngleUtils.normalizeAngleSigned(t1Angle - circShape1.endAngle));
				if (Math.min(tangentToStart, tangentToEnd) < 0.05) continue;
			}
			if (!isCircle2) {
				const tangentToStart = Math.abs(AngleUtils.normalizeAngleSigned(t2Angle - circShape2.startAngle));
				const tangentToEnd = Math.abs(AngleUtils.normalizeAngleSigned(t2Angle - circShape2.endAngle));
				if (Math.min(tangentToStart, tangentToEnd) < 0.05) continue;
			}

			// VALIDATION 3: Tangent points shouldn't be too far from corner
			const t1Dist = GeometryUtils.distance(t1, corner);
			const t2Dist = GeometryUtils.distance(t2, corner);
			if (t1Dist > radius * 4 || t2Dist > radius * 4) continue;

			candidates.push({
				center,
				t1,
				t2,
				combo: combo.name,
				int1: combo.int1,
				int2: combo.int2
			});
		}

		if (candidates.length === 0) {
			console.log("No valid fillet candidates found");
			return null;
		}

		// STEP 6 & 7: Compare vectors via dot product
		for (const c of candidates) {
			const toCenter = {
				x: c.center.x - corner.x,
				y: c.center.y - corner.y
			};
			const len2 = Math.sqrt(toCenter.x * toCenter.x + toCenter.y * toCenter.y);
			c.dot = (inputVector.x * toCenter.x + inputVector.y * toCenter.y) / (inputLen * len2);
		}

		// STEP 8: Select best match (highest dot product)
		candidates.sort((a, b) => b.dot - a.dot);
		const best = candidates[0];

		// VALIDATION 4: Must be reasonably aligned with user input
		const MIN_DOT = 0.3;
		if (best.dot < MIN_DOT) {
			console.log(`Fillet radius too large - best candidate not aligned (dot=${best.dot.toFixed(3)})`);
			return null;
		}

		// STEP 9: Create fillet arc
		const arcAngle1 = Math.atan2(best.t1.y - best.center.y, best.t1.x - best.center.x);
		const arcAngle2 = Math.atan2(best.t2.y - best.center.y, best.t2.x - best.center.x);

		let sweep1to2 = arcAngle2 - arcAngle1;
		if (sweep1to2 < 0) sweep1to2 += Math.PI * 2;
		let sweep2to1 = arcAngle1 - arcAngle2;
		if (sweep2to1 < 0) sweep2to1 += Math.PI * 2;

		let arcStartAngle, arcEndAngle;
		if (sweep1to2 <= sweep2to1) {
			arcStartAngle = arcAngle1;
			arcEndAngle = arcAngle2;
		} else {
			arcStartAngle = arcAngle2;
			arcEndAngle = arcAngle1;
		}

		const filletArc = new Arc([best.center.x, best.center.y, radius, arcStartAngle, arcEndAngle]);
		filletArc.groupId = circShape1.groupId || circShape2.groupId;
		data.addShape(filletArc);

		// STEP 10: Trim arcs using angle-based method
		if (!isCircle1) {
			this.trimArc(circShape1, best.t1, clickPt1);
		}
		if (!isCircle2) {
			this.trimArc(circShape2, best.t2, clickPt2);
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

		undoManager.execute(new FilletCommand(filletArc, circShape1, circShape2, shape1Original, shape2Original));

		return filletArc;
	}

	// Helper: get tangent point on arc from fillet center
	tangentPoint(arcCenter, arcRadius, filletCenter) {
		const dx = filletCenter.x - arcCenter.x;
		const dy = filletCenter.y - arcCenter.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 1e-10) return null;
		return {
			x: arcCenter.x + (dx / dist) * arcRadius,
			y: arcCenter.y + (dy / dist) * arcRadius
		};
	}

	// Trim arc at trimPoint, keeping the side where clickPoint is
	// Uses angle-based comparison (same as working FilletTest implementation)
	trimArc(arc, trimPoint, clickPoint) {
		const trimAngle = Math.atan2(trimPoint.y - arc.y, trimPoint.x - arc.x);
		const clickAngle = Math.atan2(clickPoint.y - arc.y, clickPoint.x - arc.x);

		// Check if click is in the angular range from startAngle to trimAngle
		const clickOnStartSide = AngleUtils.isAngleInRange(clickAngle, arc.startAngle, trimAngle);

		if (clickOnStartSide) {
			// Keep start → trim
			arc.endAngle = trimAngle;
		} else {
			// Keep trim → end
			arc.startAngle = trimAngle;
		}
		arc.update();
	}

	showRadiusInput() {
		stage.setInputCallback(this.updateRadius);
		stage.setDimensionInputValue(this.radius, 'Fillet radius');
	}

	updateRadius(newRadius) {
		console.log("updateRadius "+newRadius);
		
		const r = parseFloat(newRadius);
		if (isNaN(r) || r < 0) return;

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
