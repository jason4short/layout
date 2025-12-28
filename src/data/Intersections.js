import stage from '../core/Stage.js';
import data from '../data/Data.js';
import {Shape} from '../geometry/Geometry.js';


export class Intersections {

	constructor()
	{
	}


	intersect_shapes(shape0, shape1){

		const shapes = this.normalizeShapePair(shape0, shape1);

		if(shapes[0].geometry == Shape.LINE && shapes[1].geometry == Shape.LINE){
			// call line line
			return this.intersect_lines(shapes[0], shapes[1]);

		}else if(shapes[0].geometry == Shape.LINE && shapes[1].geometry == Shape.ARC){
			// line-arc: use line-circle, filter by arc angle
			return this.intersect_line_arc(shapes[0], shapes[1]);

		}else if(shapes[0].geometry == Shape.LINE && shapes[1].geometry == Shape.CIRCLE){
			// call line circle
			return this.intersect_line_cirlce(shapes[0], shapes[1]);

		}else if(shapes[0].geometry == Shape.ARC && shapes[1].geometry == Shape.ARC){
			// arc-arc: use circle-circle, filter both arcs
			return this.intersect_arc_arc(shapes[0], shapes[1]);

		}else if(shapes[0].geometry == Shape.ARC && shapes[1].geometry == Shape.CIRCLE){
			// arc-circle: use circle-circle, filter by arc angle
			return this.intersect_arc_circle(shapes[0], shapes[1]);

		}else if(shapes[0].geometry == Shape.CIRCLE && shapes[1].geometry == Shape.CIRCLE){
			// call circle circle
			return this.intersect_circle_circle(shapes[0], shapes[1]);
		}
	}


	normalizeShapePair(firstShape, secondShape)
	{
		if(this.getShapePriority(firstShape.geometry) <= this.getShapePriority(secondShape.geometry)){
			return [firstShape, secondShape];
		}else
			return [secondShape, firstShape];
	}

	getShapePriority(shapeType)
	{
		switch(shapeType){
			case Shape.POINT: 		return 10;
			case Shape.GUIDE:		return 20;
			case Shape.LINE: 		return 20;
			case Shape.ARC:			return 25;
			case Shape.CIRCLE: 		return 30;
			case Shape.RECTANGLE: 	return 40;
			default: return 1000;
		}
	}

	intersect_lines(line1, line2)
	{
//		const intersections = [];
		let x1 = line1.start.x;
		let y1 = line1.start.y;
		let x2 = line1.end.x;
		let y2 = line1.end.y;

		let x3 = line2.start.x;
		let y3 = line2.start.y;
		let x4 = line2.end.x;
		let y4 = line2.end.y;
		
	  // Check if none of the lines are of length 0
		if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
			return false
		}
				
		let denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))
	
	  // Lines are parallel
		if (denominator === 0) {
			return false
		}
	
		let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
		let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator
	
	  // is the intersection along the segments
		if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
			return false
		}
	
	  // Return a Point object with the x and y coordinates of the intersection
		return [{x:x1 + ua * (x2 - x1), y:y1 + ua * (y2 - y1)}];
	}

	intersect_line_cirlce(line, circle)
	{
		console.log("intersect_line_cirlce")
		let x1 = line.start.x;
		let y1 = line.start.y;
		let x2 = line.end.x;
		let y2 = line.end.y;
		let cx = circle.x
		let cy = circle.y
		let r  = circle.radius;
		
		const dx = x2 - x1;
		const dy = y2 - y1;
	
		// Shift the line so the circle's center is at the origin for simpler calculations
		const x1_shifted = x1 - cx;
		const y1_shifted = y1 - cy;
	
		const a = dx * dx + dy * dy;
		const b = 2 * (x1_shifted * dx + y1_shifted * dy);
		const c = x1_shifted * x1_shifted + y1_shifted * y1_shifted - r * r;
	
		const discriminant = b * b - 4 * a * c;
	
		const intersections = [];
	
		if (discriminant < 0) {
			// No real solutions, no intersection
			return intersections;
			
		} else if (discriminant === 0) {
			// One solution (tangent)
			const t = -b / (2 * a);
			intersections.push({
				x: x1 + t * dx,
				y: y1 + t * dy
			});
			
		} else {
			// Two solutions
			const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
			const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
	
			intersections.push({
				x: x1 + t1 * dx,
				y: y1 + t1 * dy
			});
			intersections.push({
				x: x1 + t2 * dx,
				y: y1 + t2 * dy
			});
		}
// 		console.log("intersections "+intersections[0].x, intersections[0].y)
// 		try{
// 			console.log("intersections "+intersections[1].x, intersections[1].y)
// 		}catch(e){
// 				console.log("intersections "+intersections[1].x, intersections[1].y)
// 		
// 		}
		return intersections;
	}
	
	/**
	 * Return intersection points between two circles.
	 * Each circle is expected to have:
	 *  - x, y (center)
	 *  - radius
	 *
	 * Returns:
	 *  - [] for no intersections (separate, contained, coincident, or degenerate)
	 *  - [ {x, y} ] for tangent
	 *  - [ {x, y}, {x, y} ] for two intersections
	 */
	intersect_circle_circle(circle0, circle1)
	{
		const x0 = circle0.x;
		const y0 = circle0.y;
		const r0 = circle0.radius;

		const x1 = circle1.x;
		const y1 = circle1.y;
		const r1 = circle1.radius;

		const deltaX = x1 - x0;
		const deltaY = y1 - y0;

		const centerDistanceSquared = (deltaX * deltaX) + (deltaY * deltaY);
		const centerDistance = Math.sqrt(centerDistanceSquared);

		const intersections = [];

		// Degenerate circles
		if(r0 <= 0 || r1 <= 0){
			return intersections;
		}

		// Same center
		if(centerDistance === 0){
			// Coincident circles (infinite intersections) or concentric (none).
			return intersections;
		}

		// Too far apart: no intersection
		if(centerDistance > (r0 + r1)){
			return intersections;
		}

		// One inside the other with no intersection
		if(centerDistance < Math.abs(r0 - r1)){
			return intersections;
		}

		// Distance from circle0 center to the chord midpoint along the center line
		const a = ((r0 * r0) - (r1 * r1) + (centerDistance * centerDistance)) / (2 * centerDistance);

		// Height from chord midpoint to each intersection point
		let hSquared = (r0 * r0) - (a * a);

		// Clamp tiny negative due to floating point error
		if(hSquared < 0 && hSquared > -1e-10){
			hSquared = 0;
		}

		if(hSquared < 0){
			return intersections;
		}

		const h = Math.sqrt(hSquared);

		// Point along the center line where the intersection chord crosses
		const midpointX = x0 + (a * deltaX) / centerDistance;
		const midpointY = y0 + (a * deltaY) / centerDistance;

		// Offset vector perpendicular to the center line
		const offsetX = (-deltaY * h) / centerDistance;
		const offsetY = (deltaX * h) / centerDistance;

		// Tangent: one intersection
		if(h === 0){
			intersections.push({x: midpointX, y: midpointY});
			return intersections;
		}

		// Two intersections
		intersections.push({x: midpointX + offsetX, y: midpointY + offsetY});
		intersections.push({x: midpointX - offsetX, y: midpointY - offsetY});

		return intersections;
	}

	// Check if a point lies on an arc's angle range
	isPointOnArc(point, arc) {
		const angle = Math.atan2(point.y - arc.y, point.x - arc.x);
		return arc.containsAngle(angle);
	}

	// Line-Arc intersection: use line-circle math, filter by arc angle
	intersect_line_arc(line, arc) {
		// Reuse line-circle intersection (arc extends Circle)
		const circleIntersections = this.intersect_line_cirlce(line, arc);
		if (!circleIntersections || circleIntersections.length === 0) {
			return [];
		}
		// Filter to only points within the arc's angle range
		return circleIntersections.filter(p => this.isPointOnArc(p, arc));
	}

	// Arc-Circle intersection: use circle-circle math, filter by arc angle
	intersect_arc_circle(arc, circle) {
		const circleIntersections = this.intersect_circle_circle(arc, circle);
		if (!circleIntersections || circleIntersections.length === 0) {
			return [];
		}
		// Filter to only points within the arc's angle range
		return circleIntersections.filter(p => this.isPointOnArc(p, arc));
	}

	// Arc-Arc intersection: use circle-circle math, filter by both arcs
	intersect_arc_arc(arc0, arc1) {
		const circleIntersections = this.intersect_circle_circle(arc0, arc1);
		if (!circleIntersections || circleIntersections.length === 0) {
			return [];
		}
		// Filter to only points within both arcs' angle ranges
		return circleIntersections.filter(p =>
			this.isPointOnArc(p, arc0) && this.isPointOnArc(p, arc1)
		);
	}
}