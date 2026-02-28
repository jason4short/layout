import {Tool} 				from './Tool.js';
import {Shape} 				from '../geometry/Geometry.js';
import {Line} 				from '../geometry/Line.js';
import {Arc} 				from '../geometry/Arc.js';
import {EllipticalArc} 		from '../geometry/EllipticalArc.js';
import {Spline} 			from '../geometry/Spline.js';

import stage 				from '../core/Stage.js';
import toolManager			from './ToolManager.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import { TrimCommand }		from '../core/Commands.js';

// Tolerance for floating-point comparisons
const EPSILON = 1e-9;

export class TrimTool extends Tool
{
	constructor()
	{
		super();

		this.name 	= "Trim";
		this.usage 	= "Select an intersecting shape, Click on a line or curve to trim. Hold option to extend.";

		this.generateGuides		= false;

		// Track changes for undo
		this.shapesRemoved		= [];
		this.shapesAdded		= [];
		this.originalStates		= [];

		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}

	begin(){
		//console.log("begin Trim Tool");
		this.updateCursor();
	}

	deactivate(){
		//console.log("exit Trim Tool");
	}

	updateCursor(){
		stage.setCursor('trim', 0, 0);
	}
	
	reset(){

	}

	onMouseDown(e)
	{
		// Get boundaries and attempt trim/extend
		const clickedShape = data.getTargetShape();

		if(!clickedShape) return;

		// Reset tracking for this operation
		this.shapesRemoved = [];
		this.shapesAdded = [];
		this.originalStates = [];

		// Filter out the clicked shape from boundaries (can't trim a shape against itself)
		const boundaries = data.getSelected().filter(s => s !== clickedShape);

		// No boundaries: delete the clicked shape (unless other selected shapes exist)
		if(boundaries.length === 0){
			this.shapesRemoved.push(clickedShape);
			data.deleteShape(clickedShape);
			undoManager.execute(new TrimCommand(
				this.shapesRemoved,
				this.shapesAdded,
				this.originalStates
			));
			stage.render();
			return;
		}

		// Use snapPoint for click position (world coordinates)
		const clickPoint = { x: data.snapPoint.x, y: data.snapPoint.y };

		if(stage.optionKey){
			// Option key: extend OR trim-to-boundaries (keep only clicked segment)
			if(clickedShape.geometry === Shape.LINE){
				this.extendOrTrimToLine(clickedShape, boundaries, clickPoint);
			}else if(clickedShape.geometry === Shape.BOARD || clickedShape.geometry === Shape.SLOT){
				this.extendPrimitive(clickedShape, boundaries, clickPoint);
			}else{
				this.extendLine(clickedShape, boundaries, clickPoint);
			}
		}else{
			// Handle different shape types
			if(clickedShape.geometry === Shape.LINE){
				this.trimLine(clickedShape, boundaries, clickPoint);

			}else if(clickedShape.geometry === Shape.CIRCLE){
				this.trimCircle(clickedShape, boundaries, clickPoint);

			}else if(clickedShape.geometry === Shape.ARC){
				this.trimArc(clickedShape, boundaries, clickPoint);

			}else if(clickedShape.geometry === Shape.ELLIPSE || clickedShape.geometry === Shape.ELLIPTICAL_ARC){
				this.trimEllipse(clickedShape, boundaries, clickPoint);

			}else if(clickedShape.geometry === Shape.SPLINE){
				this.trimSpline(clickedShape, boundaries, clickPoint);

			}else if(clickedShape.geometry === Shape.BOARD || clickedShape.geometry === Shape.SLOT){
				this.trimPrimitive(clickedShape, boundaries, clickPoint);
			}
		}

		// Execute command if changes were made
		if(this.shapesRemoved.length > 0 || this.shapesAdded.length > 0){
			undoManager.execute(new TrimCommand(
				this.shapesRemoved,
				this.shapesAdded,
				this.originalStates
			));
		}
		
		stage.render();
	}
	
	onMouseMove(e){
		
	}
	
	onMouseUp(e){
	//	data.resetSnaps();		
	}

// 	// Find clicked shape, excluding boundary shapes
// 	findClickedShape(mouse, boundaries){
// 		// Include shapes, constructions, and orphaned preview shapes
// 		const allShapes = [...data.shapes, ...data.constructions, ...data.shapePreview];
// 		const nonBoundaryShapes = allShapes.filter(s => !boundaries.includes(s));
// 		const snap = draftingAssistant.findNearestSnapPoint_OnShape(mouse, nonBoundaryShapes);
// 		if(snap){
// 			return snap.shape;
// 		}
// 		return null;
// 	}
//

	// Check if a point lies on a line segment within tolerance
	pointOnLine(point, line, tolerance = 0.5){
		const dx = line.end.x - line.start.x;
		const dy = line.end.y - line.start.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if(len < 1e-10) return false;
		// Perpendicular distance
		const dist = Math.abs((point.x - line.start.x) * dy - (point.y - line.start.y) * dx) / len;
		if(dist > tolerance) return false;
		// Check within segment
		const t = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / (len * len);
		return t >= -0.01 && t <= 1.01;
	}

	// Helper: get trim info for a line (intersections, click position, brackets)
	getTrimInfo(line, boundaries, clickPoint){
		const intersections = data.findIntersectionsWithBoundaries(line, boundaries);

		// Also check boundary endpoints touching the line (for trimmed shapes)
		for(const boundary of boundaries){
			const pois = boundary.getSnapPOIs();
			for(const poi of pois){
				if(poi.type !== 'endpoint') continue;
				if(this.pointOnLine(poi, line)){
					// Check not already found
					const isDupe = intersections.some(p =>
						Math.hypot(p.x - poi.x, p.y - poi.y) < 0.5
					);
					if(!isDupe){
						intersections.push({ x: poi.x, y: poi.y });
					}
				}
			}
		}

		if(intersections.length === 0) return null;

		const clickT = line.getParametricT(clickPoint);

		const tPoints = intersections
			.map(p => ({ t: line.getParametricT(p), point: p }))
			.filter(tp => tp.t >= -EPSILON && tp.t <= 1 + EPSILON);

		if(tPoints.length === 0) return { clickT, tPoints: [], noValidIntersections: true };

		tPoints.sort((a, b) => a.t - b.t);

		// Find brackets
		let bracketBefore = null, bracketAfter = null;
		for(const tp of tPoints){
			if(tp.t <= clickT) bracketBefore = tp;
			if(tp.t >= clickT && !bracketAfter) bracketAfter = tp;
		}

		return {
			clickT,
			tPoints,
			first: tPoints[0],
			last: tPoints[tPoints.length - 1],
			bracketBefore,
			bracketAfter
		};
	}

	// Trim line by removing the clicked segment
	trimLine(line, boundaries, clickPoint){
		const info = this.getTrimInfo(line, boundaries, clickPoint);
		if(!info) return;

		if(info.noValidIntersections){
			this.shapesRemoved.push(line);
			data.deleteShape(line);
			return;
		}

		if(info.clickT < info.first.t){
			// Trim start
			this.originalStates.push(line.clone());
			this.shapesRemoved.push(line);
			line.trimToPoints(info.first.point, null);
			this.shapesAdded.push(line);

		}else if(info.clickT > info.last.t){
			// Trim end
			this.originalStates.push(line.clone());
			this.shapesRemoved.push(line);
			line.trimToPoints(null, info.last.point);
			this.shapesAdded.push(line);

		}else if(info.bracketBefore && info.bracketAfter){
			// Middle segment - split into two lines
			const originalEnd = {x: line.end.x, y: line.end.y};

			this.originalStates.push(line.clone());
			this.shapesRemoved.push(line);

			line.trimToPoints(null, info.bracketBefore.point);
			this.shapesAdded.push(line);

			const newLine = new Line([
				info.bracketAfter.point.x, info.bracketAfter.point.y,
				originalEnd.x, originalEnd.y
			]);
			newLine.groupId = line.groupId; // Inherit group
			newLine.selected = line.selected; // Inherit selection
			this.shapesAdded.push(newLine);
			data.addShape(newLine);
		}
	}

	// Trim spline by removing the clicked segment
	trimSpline(spline, boundaries, clickPoint){
		const intersections = data.findIntersectionsWithBoundaries(spline, boundaries);
		if(intersections.length === 0){
			// No intersections - delete the spline
			this.shapesRemoved.push(spline);
			data.deleteShape(spline);
			return;
		}

		// Get t values for all intersection points and click point
		const clickT = spline.getParametricT(clickPoint);
		const tPoints = intersections
			.map(p => ({ t: spline.getParametricT(p), point: p }))
			.filter(tp => tp.t > EPSILON && tp.t < 1 - EPSILON)
			.sort((a, b) => a.t - b.t);

		if(tPoints.length === 0){
			this.shapesRemoved.push(spline);
			data.deleteShape(spline);
			return;
		}

		// Find brackets around the click
		let bracketBefore = null, bracketAfter = null;
		for(const tp of tPoints){
			if(tp.t <= clickT) bracketBefore = tp;
			if(tp.t >= clickT && !bracketAfter) bracketAfter = tp;
		}

		this.originalStates.push(spline.clone());
		this.shapesRemoved.push(spline);
		data.deleteShape(spline);

		if(clickT < tPoints[0].t){
			// Click before first intersection - remove start, keep rest
			const [, kept] = spline.splitAt(tPoints[0].t);
			// Snap start to exact intersection point
			kept.p0.x = tPoints[0].point.x;
			kept.p0.y = tPoints[0].point.y;
			kept.update();
			kept.groupId = spline.groupId;
			kept.selected = spline.selected;
			this.shapesAdded.push(kept);
			data.addShape(kept);

		}else if(clickT > tPoints[tPoints.length - 1].t){
			// Click after last intersection - remove end, keep rest
			const last = tPoints[tPoints.length - 1];
			const [kept] = spline.splitAt(last.t);
			// Snap end to exact intersection point
			kept.p3.x = last.point.x;
			kept.p3.y = last.point.y;
			kept.update();
			kept.groupId = spline.groupId;
			kept.selected = spline.selected;
			this.shapesAdded.push(kept);
			data.addShape(kept);

		}else if(bracketBefore && bracketAfter){
			// Click in middle - keep both sides, remove middle
			const [leftPart] = spline.splitAt(bracketBefore.t);
			// Snap end to exact intersection point
			leftPart.p3.x = bracketBefore.point.x;
			leftPart.p3.y = bracketBefore.point.y;
			leftPart.update();
			leftPart.groupId = spline.groupId;
			leftPart.selected = spline.selected;
			this.shapesAdded.push(leftPart);
			data.addShape(leftPart);

			const [, rightPart] = spline.splitAt(bracketAfter.t);
			// Snap start to exact intersection point
			rightPart.p0.x = bracketAfter.point.x;
			rightPart.p0.y = bracketAfter.point.y;
			rightPart.update();
			rightPart.groupId = spline.groupId;
			rightPart.selected = spline.selected;
			this.shapesAdded.push(rightPart);
			data.addShape(rightPart);
		}
	}

	// Trim primitive (Board, Slot) control line
	trimPrimitive(primitive, boundaries, clickPoint){
		// Create virtual line from control line
		const controlLine = new Line([
			primitive.start.x, primitive.start.y,
			primitive.end.x, primitive.end.y
		]);

		// Snap to control line if not already on it
		const snapPoint = controlLine.getGeoSnap(clickPoint, primitive.bounds, 1000) || clickPoint;

		const info = this.getTrimInfo(controlLine, boundaries, snapPoint);
		if(!info || info.noValidIntersections) return;

		// Only trim ends - no split for primitives
		if(info.clickT < info.first.t){
			this.originalStates.push(primitive.clone());
			this.shapesRemoved.push(primitive);
			primitive.start.x = info.first.point.x;
			primitive.start.y = info.first.point.y;
			primitive.update();
			this.shapesAdded.push(primitive);

		}else if(info.clickT > info.last.t){
			this.originalStates.push(primitive.clone());
			this.shapesRemoved.push(primitive);
			primitive.end.x = info.last.point.x;
			primitive.end.y = info.last.point.y;
			primitive.update();
			this.shapesAdded.push(primitive);
		}
		// Middle click - do nothing for primitives
	}

	// Extend primitive (Board, Slot) control line to nearest boundary
	extendPrimitive(primitive, boundaries, clickPoint){
		if(boundaries.length === 0) return;

		// Create control line and get snap point on it
		const controlLine = new Line([
			primitive.start.x, primitive.start.y,
			primitive.end.x, primitive.end.y
		]);
		const snapPoint = controlLine.getGeoSnap(clickPoint, primitive.bounds, 1000) || clickPoint;

		// Extend the control line for intersection testing
		const dir = { x: primitive.end.x - primitive.start.x, y: primitive.end.y - primitive.start.y };
		const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
		if(len === 0) return;
		dir.x /= len;
		dir.y /= len;

		const extendedLine = new Line([
			primitive.start.x - dir.x * 10000, primitive.start.y - dir.y * 10000,
			primitive.end.x + dir.x * 10000, primitive.end.y + dir.y * 10000
		]);

		const intersections = data.findIntersectionsWithBoundaries(extendedLine, boundaries);
		if(intersections.length === 0) return;

		const clickT = controlLine.getParametricT(snapPoint);
		const tPoints = intersections
			.map(p => ({ t: controlLine.getParametricT(p), point: p }))
			.sort((a, b) => a.t - b.t);

		const extendStart = clickT < 0.5;

		if(extendStart){
			const beforeStart = tPoints.filter(tp => tp.t < 0);
			if(beforeStart.length > 0){
				this.originalStates.push(primitive.clone());
				this.shapesRemoved.push(primitive);
				const nearest = beforeStart[beforeStart.length - 1];
				primitive.start.x = nearest.point.x;
				primitive.start.y = nearest.point.y;
				primitive.update();
				this.shapesAdded.push(primitive);
			}
		}else{
			const afterEnd = tPoints.filter(tp => tp.t > 1);
			if(afterEnd.length > 0){
				this.originalStates.push(primitive.clone());
				this.shapesRemoved.push(primitive);
				const nearest = afterEnd[0];
				primitive.end.x = nearest.point.x;
				primitive.end.y = nearest.point.y;
				primitive.update();
				this.shapesAdded.push(primitive);
			}
		}
	}

	// Option+click: Extend/trim line to boundaries on both ends
	extendOrTrimToLine(line, boundaries, clickPoint){
		if(boundaries.length === 0) return;

		// Create an extended line for finding all possible intersections
		const direction = {
			x: line.end.x - line.start.x,
			y: line.end.y - line.start.y
		};
		const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
		if(len === 0) return;

		direction.x /= len;
		direction.y /= len;

		const extendedLine = new Line([
			line.start.x - direction.x * 10000,
			line.start.y - direction.y * 10000,
			line.end.x + direction.x * 10000,
			line.end.y + direction.y * 10000
		]);

		// Find all intersections with the extended line
		const intersections = data.findIntersectionsWithBoundaries(extendedLine, boundaries);
		if(intersections.length === 0) return;

		// Convert intersections to t values relative to ORIGINAL line
		const tPoints = intersections
			.map(p => ({
				t: line.getParametricT(p),
				point: p
			}))
			.sort((a, b) => a.t - b.t);

		// Separate intersections: before start (t<0), on line (0<=t<=1), after end (t>1)
		// Use epsilon tolerance to handle floating-point precision
		const beforeStart = tPoints.filter(tp => tp.t < -EPSILON);
		const onLine = tPoints.filter(tp => tp.t >= -EPSILON && tp.t <= 1 + EPSILON);
		const afterEnd = tPoints.filter(tp => tp.t > 1 + EPSILON);

		// Determine new start and end points
		let newStart = null;
		let newEnd = null;

		if (onLine.length >= 2) {
			// Line crosses 2+ boundaries - trim to outermost intersections on line
			newStart = onLine[0].point;
			newEnd = onLine[onLine.length - 1].point;
		} else if (onLine.length === 1) {
			// Line crosses 1 boundary - extend the other end
			if (beforeStart.length > 0) {
				newStart = beforeStart[beforeStart.length - 1].point; // closest to t=0
			}
			if (afterEnd.length > 0) {
				newEnd = afterEnd[0].point; // closest to t=1
			}
		} else {
			// Line is entirely inside/outside boundaries - extend both ends if possible
			if (beforeStart.length > 0) {
				newStart = beforeStart[beforeStart.length - 1].point;
			}
			if (afterEnd.length > 0) {
				newEnd = afterEnd[0].point;
			}
		}

		// Apply changes if any
		if (newStart || newEnd) {
			this.originalStates.push(line.clone());
			this.shapesRemoved.push(line);

			if (newStart) {
				line.start.x = newStart.x;
				line.start.y = newStart.y;
			}
			if (newEnd) {
				line.end.x = newEnd.x;
				line.end.y = newEnd.y;
			}
			line.update();
			this.shapesAdded.push(line);
		}
	}

	// Extend line to nearest boundary in the direction of click
	extendLine(line, boundaries, clickPoint){
		if(boundaries.length === 0) return;

		// Create an extended line for intersection testing (both directions)
		const direction = {
			x: line.end.x - line.start.x,
			y: line.end.y - line.start.y
		};
		const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
		if(len === 0) return;

		// Normalize direction
		direction.x /= len;
		direction.y /= len;

		// Create a temporary line extended in both directions
		const extendedLine = new Line([
			line.start.x - direction.x * 10000,
			line.start.y - direction.y * 10000,
			line.end.x + direction.x * 10000,
			line.end.y + direction.y * 10000
		]);

		// Find intersections with boundaries using extended line
		const intersections = data.findIntersectionsWithBoundaries(extendedLine, boundaries);

		if(intersections.length === 0) return;

		// Get click point's t value on the original line
		// t=0 is start, t=1 is end, t<0 is before start, t>1 is after end
		const clickT = line.getParametricT(clickPoint);

		// Convert intersections to t values
		const tPoints = intersections
			.map(p => ({
				t: line.getParametricT(p),
				point: p
			}))
			.sort((a, b) => a.t - b.t);

		// Determine which end to extend based on where click is
		// Click closer to start (t < 0.5) → extend start
		// Click closer to end (t >= 0.5) → extend end
		const extendStart = clickT < 0.5;

		// Save original state before any modification
		let modified = false;

		if(extendStart){
			// Find nearest intersection before t=0 (before line start)
			const beforeStart = tPoints.filter(tp => tp.t < 0);
			if(beforeStart.length > 0){
				if(!modified){
					this.originalStates.push(line.clone());
					this.shapesRemoved.push(line);
					modified = true;
				}
				// Get the one closest to t=0 (last in sorted list of negatives)
				const nearest = beforeStart[beforeStart.length - 1];
				line.start.x = nearest.point.x;
				line.start.y = nearest.point.y;
				line.update();
			}
		} else {
			// Find nearest intersection after t=1 (after line end)
			const afterEnd = tPoints.filter(tp => tp.t > 1);
			if(afterEnd.length > 0){
				if(!modified){
					this.originalStates.push(line.clone());
					this.shapesRemoved.push(line);
					modified = true;
				}
				// Get the one closest to t=1 (first in sorted list)
				const nearest = afterEnd[0];
				line.end.x = nearest.point.x;
				line.end.y = nearest.point.y;
				line.update();
			}
		}

		if(modified){
			this.shapesAdded.push(line);
		}
	}

	// Trim ellipse or elliptical arc by removing the clicked segment
	trimEllipse(ellipse, boundaries, clickPoint){
		// Find all intersections with boundaries
		const intersections = data.findIntersectionsWithBoundaries(ellipse, boundaries);

		const isArc = ellipse.geometry === Shape.ELLIPTICAL_ARC;

		// Full ellipse needs 2+ intersections, arc needs 1+ (can trim to endpoint)
		if(intersections.length < 1){
			return;
		}
		if(!isArc && intersections.length < 2){
			return;
		}

		// Normalize angles to [0, 2PI)
		const normalize = (a) => {
			while(a < 0) a += Math.PI * 2;
			while(a >= Math.PI * 2) a -= Math.PI * 2;
			return a;
		};

		// Convert click point to angle
		const clickAngle = normalize(Math.atan2(
			(clickPoint.y - ellipse.y) / ellipse.radiusY,
			(clickPoint.x - ellipse.x) / ellipse.radiusX
		));

		// Convert intersections to angles
		const anglePoints = intersections.map(p => ({
			normAngle: normalize(Math.atan2(
				(p.y - ellipse.y) / ellipse.radiusY,
				(p.x - ellipse.x) / ellipse.radiusX
			)),
			point: p
		}));

		if(isArc){
			// For elliptical arcs, we need different logic
			this.trimEllipticalArc(ellipse, anglePoints, clickAngle, normalize);
		}else{
			// For full ellipse
			this.trimFullEllipse(ellipse, anglePoints, clickAngle, normalize);
		}
	}

	// Trim a full ellipse (creates one arc)
	trimFullEllipse(ellipse, anglePoints, clickAngle, normalize){
		// Sort by normalized angle
		anglePoints.sort((a, b) => a.normAngle - b.normAngle);

		// Find the two intersection angles that bracket the click
		let bracketBefore = null;
		let bracketAfter = null;

		for(let i = 0; i < anglePoints.length; i++){
			const current = anglePoints[i];
			const next = anglePoints[(i + 1) % anglePoints.length];

			// Check if click angle is between current and next
			let inRange;
			if(current.normAngle <= next.normAngle){
				inRange = clickAngle >= current.normAngle && clickAngle <= next.normAngle;
			}else{
				// Wraps around
				inRange = clickAngle >= current.normAngle || clickAngle <= next.normAngle;
			}

			if(inRange){
				bracketBefore = current;
				bracketAfter = next;
				break;
			}
		}

		if(!bracketBefore || !bracketAfter){
			return;
		}

		// Track removal and delete the original ellipse
		this.shapesRemoved.push(ellipse);
		data.deleteShape(ellipse);

		// Create elliptical arc for the portion NOT clicked
		const arc = new EllipticalArc([
			ellipse.x,
			ellipse.y,
			ellipse.radiusX,
			ellipse.radiusY,
			ellipse.rotation || 0,
			bracketAfter.normAngle,
			bracketBefore.normAngle
		]);
		arc.groupId = ellipse.groupId; // Inherit group
		this.shapesAdded.push(arc);
		data.addShape(arc);
	}

	// Trim an elliptical arc (may create one or two arcs)
	trimEllipticalArc(arc, anglePoints, clickAngle, normalize){
		const arcStart = normalize(arc.startAngle);
		const arcEnd = normalize(arc.endAngle);

		// Helper to check if angle is within arc range
		const isInArc = (angle) => {
			if(arcStart <= arcEnd){
				return angle >= arcStart && angle <= arcEnd;
			}else{
				return angle >= arcStart || angle <= arcEnd;
			}
		};

		// Filter intersection points to only those on the arc
		const validPoints = anglePoints.filter(ap => isInArc(ap.normAngle));

		if(validPoints.length === 0){
			return;
		}

		// Sort points by position along the arc
		// For arcs, we need to sort relative to the arc's start
		const angleFromStart = (angle) => {
			if(arcStart <= arcEnd){
				return angle - arcStart;
			}else{
				if(angle >= arcStart) return angle - arcStart;
				return (Math.PI * 2 - arcStart) + angle;
			}
		};

		validPoints.sort((a, b) => angleFromStart(a.normAngle) - angleFromStart(b.normAngle));

		// Build list of segment boundaries: arcStart, intersection1, intersection2, ..., arcEnd
		const boundaries = [arcStart, ...validPoints.map(p => p.normAngle), arcEnd];

		// Find which segment contains the click
		const clickFromStart = angleFromStart(clickAngle);
		let clickSegmentIndex = -1;

		for(let i = 0; i < boundaries.length - 1; i++){
			const segStart = angleFromStart(boundaries[i]);
			const segEnd = angleFromStart(boundaries[i + 1]);
			if(clickFromStart >= segStart && clickFromStart <= segEnd){
				clickSegmentIndex = i;
				break;
			}
		}

		if(clickSegmentIndex === -1){
			return;
		}

		// Track removal and delete original arc
		this.shapesRemoved.push(arc);
		data.deleteShape(arc);

		// Create arcs for segments we're NOT removing
		for(let i = 0; i < boundaries.length - 1; i++){
			if(i === clickSegmentIndex) continue;

			const newArc = new EllipticalArc([
				arc.x,
				arc.y,
				arc.radiusX,
				arc.radiusY,
				arc.rotation || 0,
				boundaries[i],
				boundaries[i + 1]
			]);
			newArc.groupId = arc.groupId; // Inherit group
			this.shapesAdded.push(newArc);
			data.addShape(newArc);
		}
	}

	// Trim arc by removing the clicked segment
	trimArc(arc, boundaries, clickPoint){
		// Find all intersections with boundaries
		const intersections = data.findIntersectionsWithBoundaries(arc, boundaries);

		// Normalize angles to [0, 2PI)
		const normalize = (a) => {
			while(a < 0) a += Math.PI * 2;
			while(a >= Math.PI * 2) a -= Math.PI * 2;
			return a;
		};

		const arcStart = normalize(arc.startAngle);
		const arcEnd = normalize(arc.endAngle);

		// Helper to check if angle is within arc range
		const isInArc = (angle) => {
			if(arcStart <= arcEnd){
				return angle >= arcStart && angle <= arcEnd;
			}else{
				return angle >= arcStart || angle <= arcEnd;
			}
		};

		// Helper to get position along arc (0 = start, 1 = end)
		const angleFromStart = (angle) => {
			if(arcStart <= arcEnd){
				return angle - arcStart;
			}else{
				if(angle >= arcStart) return angle - arcStart;
				return (Math.PI * 2 - arcStart) + angle;
			}
		};

		// Convert click point to angle
		const clickAngle = normalize(Math.atan2(
			clickPoint.y - arc.y,
			clickPoint.x - arc.x
		));

		// Filter intersections to only those on the arc
		const anglePoints = intersections
			.map(p => ({
				normAngle: normalize(Math.atan2(p.y - arc.y, p.x - arc.x)),
				point: p
			}))
			.filter(ap => isInArc(ap.normAngle));

		// Need at least 1 intersection to trim an arc (can trim to endpoint)
		if(anglePoints.length === 0){
			return;
		}

		// Sort by position along arc
		anglePoints.sort((a, b) => angleFromStart(a.normAngle) - angleFromStart(b.normAngle));

		// Build segment boundaries: [arcStart, intersection1, ..., arcEnd]
		const segmentBoundaries = [arcStart, ...anglePoints.map(p => p.normAngle), arcEnd];

		// Find which segment contains the click
		const clickFromStart = angleFromStart(clickAngle);
		let clickSegmentIndex = -1;

		for(let i = 0; i < segmentBoundaries.length - 1; i++){
			const segStart = angleFromStart(segmentBoundaries[i]);
			const segEnd = angleFromStart(segmentBoundaries[i + 1]);
			if(clickFromStart >= segStart && clickFromStart <= segEnd){
				clickSegmentIndex = i;
				break;
			}
		}

		if(clickSegmentIndex === -1){
			return;
		}

		// Track removal and delete original arc
		this.shapesRemoved.push(arc);
		data.deleteShape(arc);

		// Create arcs for segments we're NOT removing
		for(let i = 0; i < segmentBoundaries.length - 1; i++){
			if(i === clickSegmentIndex) continue;

			const newArc = new Arc([
				arc.x,
				arc.y,
				arc.radius,
				segmentBoundaries[i],
				segmentBoundaries[i + 1]
			]);
			newArc.groupId = arc.groupId; // Inherit group
			this.shapesAdded.push(newArc);
			data.addShape(newArc);
		}
	}

	// Trim circle by removing the clicked segment
	trimCircle(circle, boundaries, clickPoint){
		// Find all intersections with boundaries
		const intersections = data.findIntersectionsWithBoundaries(circle, boundaries);

		// Need at least 2 intersections to trim a closed curve
		if(intersections.length < 2){
			return;
		}

		// Normalize angles to [0, 2PI)
		const normalize = (a) => {
			while(a < 0) a += Math.PI * 2;
			while(a >= Math.PI * 2) a -= Math.PI * 2;
			return a;
		};

		// Convert click point to angle
		const clickAngle = normalize(Math.atan2(
			clickPoint.y - circle.y,
			clickPoint.x - circle.x
		));

		// Convert intersections to angles and sort
		const anglePoints = intersections.map(p => ({
			normAngle: normalize(Math.atan2(p.y - circle.y, p.x - circle.x)),
			point: p
		}));

		// Sort by normalized angle
		anglePoints.sort((a, b) => a.normAngle - b.normAngle);

		// Find which segment contains the click
		let clickSegmentIndex = -1;

		for(let i = 0; i < anglePoints.length; i++){
			const current = anglePoints[i];
			const next = anglePoints[(i + 1) % anglePoints.length];

			// Check if click angle is between current and next
			let inRange;
			if(current.normAngle <= next.normAngle){
				inRange = clickAngle >= current.normAngle && clickAngle <= next.normAngle;
			}else{
				// Wraps around
				inRange = clickAngle >= current.normAngle || clickAngle <= next.normAngle;
			}

			if(inRange){
				clickSegmentIndex = i;
				break;
			}
		}

		if(clickSegmentIndex === -1){
			return;
		}

		// Track removal and delete the original circle
		this.shapesRemoved.push(circle);
		data.deleteShape(circle);

		// Create arcs for all segments EXCEPT the clicked one
		for(let i = 0; i < anglePoints.length; i++){
			if(i === clickSegmentIndex) continue;

			const startAngle = anglePoints[i].normAngle;
			const endAngle = anglePoints[(i + 1) % anglePoints.length].normAngle;

			const arc = new Arc([
				circle.x,
				circle.y,
				circle.radius,
				startAngle,
				endAngle
			]);
			arc.groupId = circle.groupId; // Inherit group
			this.shapesAdded.push(arc);
			data.addShape(arc);
		}
	}
}

