/**
 * FilletTest - Step-by-step fillet debugging tool.
 * Simplified to show all candidates and let us figure out selection.
 */

import { Tool } from './Tool.js';
import { Shape } from '../geometry/Geometry.js';
import { Arc } from '../geometry/Arc.js';
import { Circle } from '../geometry/Circle.js';

import { GeometryUtils } from '../geometry/GeometryUtils.js';
import * as AngleUtils from '../geometry/utils/AngleUtils.js';
import stage from '../core/Stage.js';
import toolManager from './ToolManager.js';
import data from '../data/Data.js';
import draftingAssistant from '../geometry/DraftingAssistant.js';

export class FilletTest extends Tool {
	constructor() {
		super();
		this.name = "Fillet Test";
		this.usage = "Click two arcs to test fillet algorithm step by step.";
		this.generateGuides = false;

		this.firstArc = null;
		this.firstClickPt = null;
		this.secondArc = null;
		this.secondClickPt = null;
		this.radius = 20;
		this.debugShapes = [];

		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
	}

	onMouseMove(e) {}
	onMouseUp(e) {}

	begin() {
		this.reset();
		toolManager.addEventListener('mouseDown', this.onMouseDown);
		stage.setInputCallback((r) => {
			this.radius = parseFloat(r) || 20;
			console.log("Fillet radius:", this.radius);
		});
		stage.setDimensionInputValue(this.radius, 'Fillet radius');
	}

	deactivate() {
		toolManager.removeEventListener('mouseDown', this.onMouseDown);
		stage.setInputCallback(null);
		this.clearDebug();
		this.reset();
	}

	reset() {
		if (this.firstArc) this.firstArc.selected = false;
		if (this.secondArc) this.secondArc.selected = false;
		this.firstArc = null;
		this.firstClickPt = null;
		this.secondArc = null;
		this.secondClickPt = null;
		this.clearDebug();
	}

	clearDebug() {
		for (const shape of this.debugShapes) {
			data.deleteShape(shape);
		}
		this.debugShapes = [];
	}

	addDebugCircle(x, y, radius, color = 'red') {
		const circle = new Circle([x, y, radius]);
		circle.strokeColor = color;
		circle.lineWidth = 1;
		data.addShape(circle);
		this.debugShapes.push(circle);
		return circle;
	}

	addDebugArc(x, y, radius, startAngle, endAngle, color = 'red') {
		const arc = new Arc([x, y, radius, startAngle, endAngle]);
		arc.strokeColor = color;
		arc.lineWidth = 2;
		data.addShape(arc);
		this.debugShapes.push(arc);
		return arc;
	}

	onMouseDown(e) {
		const snapPt = draftingAssistant.getCurrentSnapPoint();
		const clickPt = snapPt ? { x: snapPt.x, y: snapPt.y } : { x: e.x, y: e.y };
		const target = data.getTargetShape();

		const isCircular = target && (
			target.geometry === Shape.ARC ||
			target.geometry === Shape.CIRCLE ||
			target.geometry === Shape.TANGENT_ARC
		);

		if (!isCircular) {
			console.log("Please click on an arc or circle.");
			return;
		}

		if (!this.firstArc) {
			this.firstArc = target;
			this.firstClickPt = clickPt;
			this.firstArc.selected = true;
			console.log("First arc selected. Click second arc.");
			stage.render();
		} else if (target !== this.firstArc) {
			this.secondArc = target;
			this.secondClickPt = clickPt;
			this.secondArc.selected = true;
			this.runFilletTest();
		}
	}

	runFilletTest() {
		console.log("\n========== FILLET TEST ==========");
		console.log("Radius:", this.radius);

		const arc1 = this.firstArc;
		const arc2 = this.secondArc;
		const click1 = this.firstClickPt;
		const click2 = this.secondClickPt;

		const c1 = { x: arc1.x, y: arc1.y };
		const r1 = arc1.radius;
		const c2 = { x: arc2.x, y: arc2.y };
		const r2 = arc2.radius;

		// STEP 1: Find the two arc intersections
		console.log("\n--- STEP 1: Find arc intersections ---");
		const arcIntersections = GeometryUtils.circleCircleIntersection(c1.x, c1.y, r1, c2.x, c2.y, r2);
		console.log(`Found ${arcIntersections.length} intersection(s)`);

		if (arcIntersections.length === 0) {
			console.log("Arcs don't intersect!");
			stage.render();
			return;
		}

		// Mark all intersections
		for (const pt of arcIntersections) {
			this.addDebugCircle(pt.x, pt.y, 4, 'gray');
			console.log(`  Intersection at (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
		}

		// STEP 2: Find midpoint of user clicks
		console.log("\n--- STEP 2: Find click midpoint ---");
		const clickMidpoint = {
			x: (click1.x + click2.x) / 2,
			y: (click1.y + click2.y) / 2
		};
		console.log(`Click midpoint: (${clickMidpoint.x.toFixed(1)}, ${clickMidpoint.y.toFixed(1)})`);
		this.addDebugCircle(clickMidpoint.x, clickMidpoint.y, 4, 'blue');

		// STEP 3: Find closest intersection to midpoint
		console.log("\n--- STEP 3: Find closest intersection to midpoint ---");
		let corner = arcIntersections[0];
		if (arcIntersections.length > 1) {
			const d0 = GeometryUtils.distance(arcIntersections[0], clickMidpoint);
			const d1 = GeometryUtils.distance(arcIntersections[1], clickMidpoint);
			corner = d0 <= d1 ? arcIntersections[0] : arcIntersections[1];
			console.log(`Distances: ${d0.toFixed(1)} vs ${d1.toFixed(1)}`);
		}
		console.log(`Chosen corner: (${corner.x.toFixed(1)}, ${corner.y.toFixed(1)})`);
		this.addDebugCircle(corner.x, corner.y, 6, 'red');

		// STEP 4: Define input vector (corner → click midpoint)
		console.log("\n--- STEP 4: Define input vector ---");
		const inputVector = {
			x: clickMidpoint.x - corner.x,
			y: clickMidpoint.y - corner.y
		};
		const inputAngle = Math.atan2(inputVector.y, inputVector.x);
		console.log(`Input vector: (${inputVector.x.toFixed(1)}, ${inputVector.y.toFixed(1)}) angle=${(inputAngle * 180/Math.PI).toFixed(1)}°`);

		// STEP 5: Find the 4 fillet options (one per tangency combo, closest to corner)
		console.log("\n--- STEP 5: Find fillet candidates (closest to corner) ---");
		const candidates = [];
		const combos = [
			{ name: "EXT-EXT", d1: r1 + this.radius, d2: r2 + this.radius, int1: false, int2: false, color: 'green' },
			{ name: "EXT-INT", d1: r1 + this.radius, d2: Math.abs(r2 - this.radius), int1: false, int2: true, color: 'orange' },
			{ name: "INT-EXT", d1: Math.abs(r1 - this.radius), d2: r2 + this.radius, int1: true, int2: false, color: 'purple' },
			{ name: "INT-INT", d1: Math.abs(r1 - this.radius), d2: Math.abs(r2 - this.radius), int1: true, int2: true, color: 'cyan' },
		];

		for (const combo of combos) {
			if (combo.int1 && this.radius >= r1) continue;
			if (combo.int2 && this.radius >= r2) continue;

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

			// VALIDATION 1: Check if tangent points are on the arcs (not just the circles)
			const t1Angle = Math.atan2(t1.y - c1.y, t1.x - c1.x);
			const t2Angle = Math.atan2(t2.y - c2.y, t2.x - c2.x);

			if (arc1.geometry === Shape.ARC || arc1.geometry === Shape.TANGENT_ARC) {
				if (!arc1.containsAngle(t1Angle)) {
					console.log(`  ${combo.name} REJECTED: tangent1 outside arc1 range`);
					continue;
				}
			}
			if (arc2.geometry === Shape.ARC || arc2.geometry === Shape.TANGENT_ARC) {
				if (!arc2.containsAngle(t2Angle)) {
					console.log(`  ${combo.name} REJECTED: tangent2 outside arc2 range`);
					continue;
				}
			}

			// VALIDATION 2: Check trimmed arc would have positive length
			// The tangent point must be between the corner and the far end of the arc
			const cornerAngle1 = Math.atan2(corner.y - c1.y, corner.x - c1.x);
			const cornerAngle2 = Math.atan2(corner.y - c2.y, corner.x - c2.x);

			// For arc1: check that trimming leaves some arc
			if (arc1.geometry === Shape.ARC || arc1.geometry === Shape.TANGENT_ARC) {
				const cornerToStart = Math.abs(AngleUtils.normalizeAngleSigned(cornerAngle1 - arc1.startAngle));
				const cornerToEnd = Math.abs(AngleUtils.normalizeAngleSigned(cornerAngle1 - arc1.endAngle));
				const tangentToStart = Math.abs(AngleUtils.normalizeAngleSigned(t1Angle - arc1.startAngle));
				const tangentToEnd = Math.abs(AngleUtils.normalizeAngleSigned(t1Angle - arc1.endAngle));

				// Tangent should be between corner and one of the endpoints
				const minRemaining = Math.min(tangentToStart, tangentToEnd);
				if (minRemaining < 0.05) { // Less than ~3 degrees remaining
					console.log(`  ${combo.name} REJECTED: arc1 would be too short after trim`);
					continue;
				}
			}

			if (arc2.geometry === Shape.ARC || arc2.geometry === Shape.TANGENT_ARC) {
				const tangentToStart = Math.abs(AngleUtils.normalizeAngleSigned(t2Angle - arc2.startAngle));
				const tangentToEnd = Math.abs(AngleUtils.normalizeAngleSigned(t2Angle - arc2.endAngle));

				const minRemaining = Math.min(tangentToStart, tangentToEnd);
				if (minRemaining < 0.05) {
					console.log(`  ${combo.name} REJECTED: arc2 would be too short after trim`);
					continue;
				}
			}

			// VALIDATION 3: Tangent points shouldn't be too far from corner
			const t1DistFromCorner = GeometryUtils.distance(t1, corner);
			const t2DistFromCorner = GeometryUtils.distance(t2, corner);
			const maxTangentDist = this.radius * 4; // Reasonable limit

			if (t1DistFromCorner > maxTangentDist || t2DistFromCorner > maxTangentDist) {
				console.log(`  ${combo.name} REJECTED: tangent points too far from corner (${t1DistFromCorner.toFixed(1)}, ${t2DistFromCorner.toFixed(1)})`);
				continue;
			}

			candidates.push({
				center,
				t1,
				t2,
				combo: combo.name,
				color: combo.color,
				int1: combo.int1,
				int2: combo.int2
			});

			this.addDebugCircle(center.x, center.y, 4, combo.color);
			console.log(`  ${combo.name} at (${center.x.toFixed(1)}, ${center.y.toFixed(1)}) dist=${bestDist.toFixed(1)}`);
		}

		if (candidates.length === 0) {
			console.log("No valid candidates found!");
			stage.render();
			return;
		}

		// STEP 6 & 7: Define vectors from corner to each candidate, compare to input vector
		console.log("\n--- STEP 6 & 7: Compare vectors ---");
		for (const c of candidates) {
			const toCenter = {
				x: c.center.x - corner.x,
				y: c.center.y - corner.y
			};
			const centerAngle = Math.atan2(toCenter.y, toCenter.x);

			// Dot product (normalized)
			const len1 = Math.sqrt(inputVector.x * inputVector.x + inputVector.y * inputVector.y);
			const len2 = Math.sqrt(toCenter.x * toCenter.x + toCenter.y * toCenter.y);
			const dot = (inputVector.x * toCenter.x + inputVector.y * toCenter.y) / (len1 * len2);

			c.angle = centerAngle;
			c.dot = dot;

			console.log(`  ${c.combo}: angle=${(centerAngle * 180/Math.PI).toFixed(1)}° dot=${dot.toFixed(3)}`);
		}

		// STEP 8: Select best match (highest dot product = best alignment)
		console.log("\n--- STEP 8: Select best match ---");
		candidates.sort((a, b) => b.dot - a.dot);
		const best = candidates[0];

		// VALIDATION 4: Best candidate must be in the same quadrant as user input
		// dot > 0.5 means within ~60° of input direction
		const MIN_DOT = 0.3; // ~72° tolerance
		if (best.dot < MIN_DOT) {
			console.log(`INVALID: Best candidate not aligned with user input (dot=${best.dot.toFixed(3)}, need >${MIN_DOT})`);
			console.log("Fillet radius may be too large for this corner.");
			stage.render();
			return;
		}

		console.log(`Winner: ${best.combo} dot=${best.dot.toFixed(3)}`);

		// Highlight winner
		this.addDebugCircle(best.center.x, best.center.y, 8, 'green');
		this.addDebugCircle(best.t1.x, best.t1.y, 3, 'black');
		this.addDebugCircle(best.t2.x, best.t2.y, 3, 'black');

		// STEP 9: Create fillet arc (shorter arc between tangent points)
		console.log("\n--- STEP 9: Create fillet arc ---");
		const angle1 = Math.atan2(best.t1.y - best.center.y, best.t1.x - best.center.x);
		const angle2 = Math.atan2(best.t2.y - best.center.y, best.t2.x - best.center.x);

		let sweep1to2 = angle2 - angle1;
		if (sweep1to2 < 0) sweep1to2 += Math.PI * 2;
		let sweep2to1 = angle1 - angle2;
		if (sweep2to1 < 0) sweep2to1 += Math.PI * 2;

		let startAngle, endAngle;
		if (sweep1to2 <= sweep2to1) {
			startAngle = angle1;
			endAngle = angle2;
		} else {
			startAngle = angle2;
			endAngle = angle1;
		}

		this.addDebugArc(best.center.x, best.center.y, this.radius, startAngle, endAngle, 'blue');
		console.log(`Fillet arc: start=${(startAngle * 180/Math.PI).toFixed(1)}° end=${(endAngle * 180/Math.PI).toFixed(1)}°`);

		// STEP 10: Trim arcs
		console.log("\n--- STEP 10: Trim arcs ---");
		this.trimArc(arc1, best.t1, click1, "Arc1");
		this.trimArc(arc2, best.t2, click2, "Arc2");

		console.log("\n========== DONE ==========");

		// Reset for next test
		this.firstArc.selected = false;
		this.secondArc.selected = false;
		this.firstArc = null;
		this.secondArc = null;
		stage.render();
	}

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

	trimArc(arc, trimPoint, clickPoint, label) {
		const trimAngle = Math.atan2(trimPoint.y - arc.y, trimPoint.x - arc.x);
		const clickAngle = Math.atan2(clickPoint.y - arc.y, clickPoint.x - arc.x);

		const clickOnStartSide = AngleUtils.isAngleInRange(clickAngle, arc.startAngle, trimAngle);

		console.log(`${label}: click ${clickOnStartSide ? 'before' : 'after'} trim point`);

		if (clickOnStartSide) {
			arc.endAngle = trimAngle;
		} else {
			arc.startAngle = trimAngle;
		}
		arc.update();
	}
}
