import {Tool} 	from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Line} 	from '../geometry/Line.js';
import {Arc} from '../geometry/Arc.js';
import {EllipticalArc} from '../geometry/EllipticalArc.js';
import stage 	from '../core/Stage.js';
import data 	from '../data/Data.js';
import draftingAssistant from '../geometry/DraftingAssistant.js';

export class TrimTool extends Tool
{
	constructor()
	{
		super();
		this.willSnap = false; // Disable snapping for trim tool

		this.onMouseDown 		= this.onMouseDown.bind(this);
//		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onKeyUp 			= this.onKeyUp.bind(this);
	}

	begin(){
		console.log("begin Trim Tool");
		stage.addEventListener('keyUp', 		this.onKeyUp);
		stage.addEventListener('mouseDown',		this.onMouseDown);
// 		stage.addEventListener('mouseMove',		this.onMouseMove);
	}

	exit(){
		console.log("exit Trim Tool");
		stage.removeEventListener('keyUp', 		this.onKeyUp);
		stage.removeEventListener('mouseDown', 	this.onMouseDown);
// 		stage.removeEventListener('mouseMove', 	this.onMouseMove);
	}

	onKeyUp(e){
		if (e.key === 'Escape'){
			data.selectNone();
			stage.render();
		}
	}

// 	onMouseMove(e){
// 		// Could add hover highlighting here in the future
// 	}

	onMouseDown(e)
	{
		if(stage.shiftKey){
			// Toggle boundary selection
			data.selectShape(e, stage.shiftKey);
		}else{
			// Get boundaries and attempt trim/extend
			const clickedShape = data.getTargetShape(e);

			if(!clickedShape){
				return;
			}

			// Filter out the clicked shape from boundaries (can't trim a shape against itself)
			const boundaries = data.getSelected().filter(s => s !== clickedShape);

//			const clickPoint = {x: e.x, y: e.y};

			if(stage.optionKey){
				this.extendLine(clickedShape, boundaries, e);
			}else{
				// Handle different shape types
				if(clickedShape.geometry === Shape.LINE){
					this.trimLine(clickedShape, boundaries, e);
					
				}else if(clickedShape.geometry === Shape.CIRCLE){
					this.trimCircle(clickedShape, boundaries, e);

				}else if(clickedShape.geometry === Shape.ARC){
					this.trimArc(clickedShape, boundaries, e);

				}else if(clickedShape.geometry === Shape.ELLIPSE || clickedShape.geometry === Shape.ELLIPTICAL_ARC){
					this.trimEllipse(clickedShape, boundaries, e);
				}
			}
		}
		stage.render();
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


	// Trim line by removing the clicked segment
	trimLine(line, boundaries, clickPoint){

		// Find all intersections with boundaries
		const intersections = data.findIntersectionsWithBoundaries(line, boundaries);

		// XXX make is so we need to shift click or something - not sure yet
		if(intersections.length === 0){
			//data.deleteShape(line);
			return;
		}

		// Convert click point to parametric t (t=0-1, start to end)
		const clickT = line.getParametricT(clickPoint);

		// Convert all intersections to t values and pair with points
		// Filter to only intersections actually on the line segment (t between 0 and 1)
		const tPoints = intersections.map(p => ({ 
			t: line.getParametricT(p),
			point: p }))
				.filter(tp => tp.t >= 0 && tp.t <= 1);

		// do I need?
		if(tPoints.length === 0){
			data.deleteShape(line);
			return;
		}

		// Sort by t value
		tPoints.sort((a, b) => a.t - b.t);

		// Find the two intersections that bracket the click point
		let bracketBefore = null;  // nearest intersection before click
		let bracketAfter = null;   // nearest intersection after click

		for (const tp of tPoints) {
			if (tp.t <= clickT) {
				bracketBefore = tp;
			}
			if (tp.t >= clickT && bracketAfter === null) {
				bracketAfter = tp;
			}
		}

		// Determine trim behavior based on where click falls
		const firstIntersection = tPoints[0];
		const lastIntersection = tPoints[tPoints.length - 1];

		if (clickT < firstIntersection.t) {
			// Clicked before first intersection - trim start to first intersection
			line.trimToPoints(firstIntersection.point, null);

		} else if (clickT > lastIntersection.t) {
			// Clicked after last intersection - trim end to last intersection
			line.trimToPoints(null, lastIntersection.point);

		} else if (bracketBefore && bracketAfter) {
			// Clicked a middle segment - delete this segment, keep both sides
			const originalEnd = {x: line.end.x, y: line.end.y};

			// Trim existing line to: start → bracketBefore
			line.trimToPoints(null, bracketBefore.point);

			// Create new line from: bracketAfter → originalEnd
			const newLine = new Line([
				bracketAfter.point.x,
				bracketAfter.point.y,
				originalEnd.x,
				originalEnd.y
			]);
			data.addShape(newLine);
		}
	}


	// Extend/trim line to the two boundaries that bracket the click point
	extendLine(line, boundaries, clickPoint){
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

		if(intersections.length < 2){
			return;
		}

		// Get click point's t value on the line
		const clickT = line.getParametricT(clickPoint);

		// Convert intersections to t values and sort
		const tPoints = intersections
			.map(p => ({
				t: line.getParametricT(p),
				point: p
			}))
			.sort((a, b) => a.t - b.t);

		// Find the two intersections that bracket the click point
		let bracketBefore = null;
		let bracketAfter = null;

		for (const tp of tPoints) {
			if (tp.t <= clickT) {
				bracketBefore = tp;
			}
			if (tp.t >= clickT && bracketAfter === null) {
				bracketAfter = tp;
			}
		}

		// Need both brackets to proceed
		if (!bracketBefore || !bracketAfter) {
			return;
		}

		// Trim/extend line to fit exactly between the two bracketing boundaries
		line.trimToPoints(bracketBefore.point, bracketAfter.point);
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

		// Delete the original ellipse
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

		// Delete original arc
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

		// Delete original arc
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

		// Delete the original circle
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
			data.addShape(arc);
		}
	}
}

