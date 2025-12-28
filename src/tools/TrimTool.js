import {Tool} from './Tool.js';

import {Shape} from '../geometry/Geometry.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class TrimTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.onMouseDown = this.onMouseDown.bind(this);
	}

	/**
	 * Begin listening to stage events for trimming and extending.
	 */
	begin(){
		console.log("begin Trim Tool");
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	/**
	 * Stop listening to stage events.
	 */
	exit(){
		console.log("exit Trim Tool");
		stage.removeEventListener('mouseDown', this.onMouseDown);
	}

	/**
	 * Handle clicks for:
	 * - Shift-click: select a boundary shape
	 * - Click: trim the clicked shape to the selected boundary
	 * - Meta/Option + click: extend the clicked shape to the selected boundary
	 */
	onMouseDown(e)
	{
		const clickPoint = {x: e.x, y: e.y};

		if(stage.shiftKey){
			this.selectBoundaryAtClick(clickPoint);
			stage.render();
			return;
		}

		const boundaryShape = this.getActiveBoundaryShape();

		if(!boundaryShape){
			console.log('[TrimTool] No boundary selected. Shift-click a boundary shape first.');
			stage.render();
			return;
		}

		const targetShape = this.pickShapeAtClickWithoutChangingSelection(clickPoint);

		if(!targetShape){
			stage.render();
			return;
		}

		if(targetShape === boundaryShape){
			stage.render();
			return;
		}

		const shouldExtend = this.shouldExtendFromEvent(e);

		const didModify = this.trimOrExtendShapeToBoundary({
			targetShape,
			boundaryShape,
			shouldExtend,
			clickPoint
		});

		if(didModify){
			stage.render();
		}
	}

	/**
	 * Select a boundary shape using your existing selection logic.
	 * Shift-click behavior is delegated to Data.selectShape().
	 */
	selectBoundaryAtClick(clickPoint)
	{
		// Data.selectShape expects the event-like object in your current codebase.
		// We provide x/y so your selection code has what it needs.
		data.selectShape({x: clickPoint.x, y: clickPoint.y}, true);
	}

	/**
	 * Return the active boundary shape for trimming.
	 * Your Data.getSelected() returns an array of shapes, so we choose the first selected shape.
	 */
	getActiveBoundaryShape()
	{
		const selectedShapes = data.getSelected();

		if(!selectedShapes || selectedShapes.length === 0){
			return null;
		}

		return selectedShapes[0];
	}

	/**
	 * Decide whether the current click should EXTEND (meta/option) instead of TRIM.
	 * User asked for META. On Mac, "Option" is typically altKey, so we support both.
	 */
	shouldExtendFromEvent(e)
	{
		return Boolean(stage.metaKey || e.metaKey || e.altKey);
	}

	/**
	 * Pick a shape at the click location without disturbing selection state.
	 * This avoids losing your boundary selection.
	 *
	 * Note: this relies on a non-selection picker existing. If your Data layer does not yet
	 * have one, add data.getShapeAtMouse({x, y}) (recommended) and call it here.
	 */
	pickShapeAtClickWithoutChangingSelection(clickPoint)
	{
		if(typeof data.getShapeAtMouse === 'function'){
			return data.getShapeAtMouse(clickPoint);
		}

		// Fallback: if you do not have a non-mutating picker, we cannot safely pick without
		// changing selection. Return null to avoid breaking the boundary selection.
		console.log('[TrimTool] Missing data.getShapeAtMouse({x, y}). Add it to pick targets without changing selection.');
		return null;
	}

	/**
	 * Trim or extend a supported target shape to a boundary shape.
	 * Currently supports:
	 *  - Line trimmed/extended to Line boundary
	 *  - Line trimmed/extended to Circle boundary
	 */
	trimOrExtendShapeToBoundary({targetShape, boundaryShape, shouldExtend, clickPoint})
	{
		if(targetShape.geometry === Shape.LINE){
			return this.trimOrExtendLineToBoundary({
				line: targetShape,
				boundaryShape,
				shouldExtend,
				clickPoint
			});
		}

		console.log('[TrimTool] Unsupported target geometry:', targetShape.geometry);
		return false;
	}

	/**
	 * Trim/extend a line to a boundary (line or circle).
	 * We move the endpoint closest to the click to the chosen intersection.
	 *
	 * Trim mode:
	 * - Only trims if the intersection lies on the current segment.
	 *
	 * Extend mode:
	 * - Allows intersection outside the segment (uses infinite line).
	 */
	trimOrExtendLineToBoundary({line, boundaryShape, shouldExtend, clickPoint})
	{
		const intersections = this.getLineToBoundaryIntersections(line, boundaryShape);

		if(!intersections.length){
			return false;
		}

		const chosenIntersection = this.chooseIntersectionClosestToClick(intersections, clickPoint);

		if(!chosenIntersection){
			return false;
		}

		const lineEndpointToMove = this.getLineEndpointClosestToClick(line, clickPoint);

		if(!lineEndpointToMove){
			return false;
		}

		const intersectionOnSegment = this.isPointOnLineSegment(chosenIntersection, line.start, line.end);

		if(!shouldExtend && !intersectionOnSegment){
			return false;
		}

		lineEndpointToMove.x = chosenIntersection.x;
		lineEndpointToMove.y = chosenIntersection.y;

		line.commit();
		return true;
	}

	/**
	 * Get intersection points between a line and a boundary shape.
	 * Returns an array of points: [{x, y}, ...]
	 */
	getLineToBoundaryIntersections(line, boundaryShape)
	{
		if(boundaryShape.geometry === Shape.LINE){
			return this.intersectInfiniteLineWithLineSegment(line, boundaryShape);
		}

		if(boundaryShape.geometry === Shape.CIRCLE){
			return this.intersectInfiniteLineWithCircle(line, boundaryShape);
		}

		return [];
	}

	/**
	 * Return the line endpoint (start or end) that is closest to the click point.
	 */
	getLineEndpointClosestToClick(line, clickPoint)
	{
		const distanceToStart = this.squaredDistanceBetweenPoints(clickPoint, line.start);
		const distanceToEnd = this.squaredDistanceBetweenPoints(clickPoint, line.end);

		return (distanceToStart <= distanceToEnd) ? line.start : line.end;
	}

	/**
	 * Intersect the infinite extension of targetLine with the *segment* boundaryLine.
	 * This allows extending the target line to meet the boundary line.
	 *
	 * Returns [] or [ {x, y} ].
	 */
	intersectInfiniteLineWithLineSegment(targetLine, boundaryLine)
	{
		const intersection = this.intersectInfiniteLines(targetLine, boundaryLine);

		if(!intersection){
			return [];
		}

		if(!this.isPointOnLineSegment(intersection, boundaryLine.start, boundaryLine.end)){
			return [];
		}

		return [intersection];
	}

	/**
	 * Intersect the infinite extension of a line with a circle.
	 * Returns [] / [point] / [point, point].
	 */
	intersectInfiniteLineWithCircle(line, circle)
	{
		const x1 = line.start.x;
		const y1 = line.start.y;
		const x2 = line.end.x;
		const y2 = line.end.y;

		const circleX = circle.x;
		const circleY = circle.y;
		const radius = circle.radius;

		const directionX = x2 - x1;
		const directionY = y2 - y1;

		const fromCircleToLineX = x1 - circleX;
		const fromCircleToLineY = y1 - circleY;

		const a = (directionX * directionX) + (directionY * directionY);

		if(a === 0){
			return [];
		}

		const b = 2 * ((directionX * fromCircleToLineX) + (directionY * fromCircleToLineY));
		const c = (fromCircleToLineX * fromCircleToLineX) + (fromCircleToLineY * fromCircleToLineY) - (radius * radius);

		const discriminant = (b * b) - (4 * a * c);

		if(discriminant < 0){
			return [];
		}

		const intersections = [];

		if(discriminant === 0){
			const t = -b / (2 * a);
			intersections.push({x: x1 + (t * directionX), y: y1 + (t * directionY)});
			return intersections;
		}

		const sqrtDiscriminant = Math.sqrt(discriminant);

		const t0 = (-b + sqrtDiscriminant) / (2 * a);
		const t1 = (-b - sqrtDiscriminant) / (2 * a);

		intersections.push({x: x1 + (t0 * directionX), y: y1 + (t0 * directionY)});
		intersections.push({x: x1 + (t1 * directionX), y: y1 + (t1 * directionY)});

		return intersections;
	}

	/**
	 * Intersect two infinite lines defined by their segment endpoints.
	 * Returns {x, y} or null if parallel/collinear.
	 */
	intersectInfiniteLines(lineA, lineB)
	{
		const x1 = lineA.start.x;
		const y1 = lineA.start.y;
		const x2 = lineA.end.x;
		const y2 = lineA.end.y;

		const x3 = lineB.start.x;
		const y3 = lineB.start.y;
		const x4 = lineB.end.x;
		const y4 = lineB.end.y;

		const denominator = ((x1 - x2) * (y3 - y4)) - ((y1 - y2) * (x3 - x4));

		if(denominator === 0){
			return null;
		}

		const numeratorX =
			((x1 * y2) - (y1 * x2)) * (x3 - x4) - (x1 - x2) * ((x3 * y4) - (y3 * x4));

		const numeratorY =
			((x1 * y2) - (y1 * x2)) * (y3 - y4) - (y1 - y2) * ((x3 * y4) - (y3 * x4));

		return {
			x: numeratorX / denominator,
			y: numeratorY / denominator
		};
	}

	/**
	 * Choose the intersection point closest to the click point.
	 */
	chooseIntersectionClosestToClick(intersections, clickPoint)
	{
		let closestIntersection = null;
		let closestDistanceSquared = Number.POSITIVE_INFINITY;

		for(const intersection of intersections){
			const distanceSquared = this.squaredDistanceBetweenPoints(clickPoint, intersection);

			if(distanceSquared < closestDistanceSquared){
				closestDistanceSquared = distanceSquared;
				closestIntersection = intersection;
			}
		}

		return closestIntersection;
	}

	/**
	 * Check whether a point lies on the segment [segmentStart, segmentEnd] with tolerance.
	 */
	isPointOnLineSegment(point, segmentStart, segmentEnd)
	{
		const tolerance = 1e-6;

		const segmentDeltaX = segmentEnd.x - segmentStart.x;
		const segmentDeltaY = segmentEnd.y - segmentStart.y;

		const pointDeltaX = point.x - segmentStart.x;
		const pointDeltaY = point.y - segmentStart.y;

		const segmentLengthSquared = (segmentDeltaX * segmentDeltaX) + (segmentDeltaY * segmentDeltaY);

		if(segmentLengthSquared === 0){
			return false;
		}

		const t = ((pointDeltaX * segmentDeltaX) + (pointDeltaY * segmentDeltaY)) / segmentLengthSquared;

		if(t < -tolerance || t > 1 + tolerance){
			return false;
		}

		const closestX = segmentStart.x + (t * segmentDeltaX);
		const closestY = segmentStart.y + (t * segmentDeltaY);

		const distanceSquared =
			((point.x - closestX) * (point.x - closestX)) +
			((point.y - closestY) * (point.y - closestY));

		return distanceSquared <= (tolerance * tolerance);
	}

	/**
	 * Return the squared distance between two points.
	 */
	squaredDistanceBetweenPoints(a, b)
	{
		const dx = a.x - b.x;
		const dy = a.y - b.y;

		return (dx * dx) + (dy * dy);
	}
}