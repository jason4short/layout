import {Tool} 	from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import {Line} 	from '../geometry/Line.js'
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
			const boundaries = data.getSelected();

			// delete shape clicked
			//if(boundaries.length === 0){
			//	return;
			//}

			const clickedShape = data.getTargetShape(e)

			if(!clickedShape){
				return;
			}

//			const clickPoint = {x: e.x, y: e.y};

			if(stage.optionKey){
				this.extendLine(clickedShape, boundaries, e);
			}else{
				this.trimLine(clickedShape, boundaries, e);
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

		// No intersections - delete the entire shape
		if(intersections.length === 0){
			data.deleteShape(line);
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
}

