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


	// Extend line to nearest boundary intersection
	extendLine(line, boundaries, clickPoint){
		// Determine which endpoint is closer to click
		const distToStart = this.distanceBetweenPoints(clickPoint, line.start);
		const distToEnd = this.distanceBetweenPoints(clickPoint, line.end);
		const extendStart = distToStart < distToEnd;

		// Create an extended line for intersection testing
		const direction = {
			x: line.end.x - line.start.x,
			y: line.end.y - line.start.y
		};
		const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
		if(len === 0) return;

		// Normalize direction
		direction.x /= len;
		direction.y /= len;

		// Create a temporary extended line (10000 units in the extend direction)
		let extendedLine;
		if(extendStart){
			// Extend backward from start
			extendedLine = new Line([
				line.start.x - direction.x * 10000,
				line.start.y - direction.y * 10000,
				line.end.x,
				line.end.y
			]);
		}else{
			// Extend forward from end
			extendedLine = new Line([
				line.start.x,
				line.start.y,
				line.end.x + direction.x * 10000,
				line.end.y + direction.y * 10000
			]);
		}

		// Find intersections with boundaries using extended line
		const intersections = data.findIntersectionsWithBoundaries(extendedLine, boundaries);

		if(intersections.length === 0){
			return;
		}

		// Find nearest intersection beyond the current endpoint
		let nearestDist = Infinity;
		let nearestPoint = null;

		for(const p of intersections){
			const t = line.getParametricT(p);

			// For extending start, we want t < 0
			// For extending end, we want t > 1
			if(extendStart && t < 0){
				const dist = this.distanceBetweenPoints(line.start, p);
				if(dist < nearestDist){
					nearestDist = dist;
					nearestPoint = p;
				}
			}else if(!extendStart && t > 1){
				const dist = this.distanceBetweenPoints(line.end, p);
				if(dist < nearestDist){
					nearestDist = dist;
					nearestPoint = p;
				}
			}
		}

		if(nearestPoint){
			if(extendStart){
				line.trimToPoints(nearestPoint, null);
			}else{
				line.trimToPoints(null, nearestPoint);
			}
		}
	}
}

