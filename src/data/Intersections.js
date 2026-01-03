import stage from '../core/Stage.js';
import data from '../data/Data.js';
import {Shape} from '../geometry/Geometry.js';


export class Intersections {

	constructor()
	{
	}

	// Helper to check if a shape is arc-like (ARC or TANGENT_ARC)
	isArcType(geometry) {
		return geometry === Shape.ARC || geometry === Shape.TANGENT_ARC;
	}

	intersect_shapes(shape0, shape1){

		const shapes = this.normalizeShapePair(shape0, shape1);
		const geo0 = shapes[0].geometry;
		const geo1 = shapes[1].geometry;

		if(geo0 == Shape.LINE && geo1 == Shape.LINE){
			// call line line
			return this.intersect_lines(shapes[0], shapes[1]);

		}else if(geo0 == Shape.LINE && this.isArcType(geo1)){
			// line-arc: use line-circle, filter by arc angle
			return this.intersect_line_arc(shapes[0], shapes[1]);

		}else if(geo0 == Shape.LINE && geo1 == Shape.CIRCLE){
			// call line circle
			return this.intersect_line_cirlce(shapes[0], shapes[1]);

		}else if(this.isArcType(geo0) && this.isArcType(geo1)){
			// arc-arc: use circle-circle, filter both arcs
			return this.intersect_arc_arc(shapes[0], shapes[1]);

		}else if(this.isArcType(geo0) && geo1 == Shape.CIRCLE){
			// arc-circle: use circle-circle, filter by arc angle
			return this.intersect_arc_circle(shapes[0], shapes[1]);

		}else if(geo0 == Shape.CIRCLE && geo1 == Shape.CIRCLE){
			// call circle circle
			return this.intersect_circle_circle(shapes[0], shapes[1]);

		}else if(geo0 == Shape.LINE && geo1 == Shape.ELLIPSE){
			// line-ellipse
			return this.intersect_line_ellipse(shapes[0], shapes[1]);

		}else if(geo0 == Shape.CIRCLE && geo1 == Shape.ELLIPSE){
			// circle-ellipse
			return this.intersect_circle_ellipse(shapes[0], shapes[1]);

		}else if(this.isArcType(geo0) && geo1 == Shape.ELLIPSE){
			// arc-ellipse
			return this.intersect_arc_ellipse(shapes[0], shapes[1]);

		}else if(geo0 == Shape.LINE && geo1 == Shape.ELLIPTICAL_ARC){
			// line-elliptical arc
			return this.intersect_line_elliptical_arc(shapes[0], shapes[1]);

		}else if(geo0 == Shape.CIRCLE && geo1 == Shape.ELLIPTICAL_ARC){
			// circle-elliptical arc
			return this.intersect_circle_elliptical_arc(shapes[0], shapes[1]);

		}else if(this.isArcType(geo0) && geo1 == Shape.ELLIPTICAL_ARC){
			// arc-elliptical arc
			return this.intersect_arc_elliptical_arc(shapes[0], shapes[1]);

		}else if(geo0 == Shape.ELLIPSE && geo1 == Shape.ELLIPSE){
			// ellipse-ellipse
			return this.intersect_ellipse_ellipse(shapes[0], shapes[1]);

		}else if(geo0 == Shape.ELLIPSE && geo1 == Shape.ELLIPTICAL_ARC){
			// ellipse-elliptical arc
			return this.intersect_ellipse_elliptical_arc(shapes[0], shapes[1]);

		}else if(geo0 == Shape.ELLIPTICAL_ARC && geo1 == Shape.ELLIPTICAL_ARC){
			// elliptical arc-elliptical arc
			return this.intersect_elliptical_arc_elliptical_arc(shapes[0], shapes[1]);

		}else if(geo0 == Shape.LINE && geo1 == Shape.SPLINE){
			// line-spline
			return this.intersect_line_spline(shapes[0], shapes[1]);

		}else if(this.isArcType(geo0) && geo1 == Shape.SPLINE){
			// arc-spline
			return this.intersect_arc_spline(shapes[0], shapes[1]);

		}else if(geo0 == Shape.CIRCLE && geo1 == Shape.SPLINE){
			// circle-spline
			return this.intersect_circle_spline(shapes[0], shapes[1]);

		}else if(geo0 == Shape.ELLIPSE && geo1 == Shape.SPLINE){
			// ellipse-spline
			return this.intersect_ellipse_spline(shapes[0], shapes[1]);

		}else if(geo0 == Shape.ELLIPTICAL_ARC && geo1 == Shape.SPLINE){
			// elliptical arc-spline
			return this.intersect_elliptical_arc_spline(shapes[0], shapes[1]);

		}else if(geo0 == Shape.SPLINE && geo1 == Shape.SPLINE){
			// spline-spline
			return this.intersect_spline_spline(shapes[0], shapes[1]);
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
			case Shape.POINT: 			return 10;
			case Shape.GUIDE:			return 20;
			case Shape.LINE: 			return 20;
			case Shape.ARC:				return 25;
			case Shape.TANGENT_ARC:		return 25;  // Same priority as ARC
			case Shape.CIRCLE: 			return 30;
			case Shape.ELLIPSE:			return 35;
			case Shape.ELLIPTICAL_ARC:	return 36;
			case Shape.SPLINE:			return 37;
			case Shape.RECTANGLE: 		return 40;
			default: 					return 1000;
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
			// Only include if on the actual line segment
			if (t >= 0 && t <= 1) {
				intersections.push({
					x: x1 + t * dx,
					y: y1 + t * dy
				});
			}

		} else {
			// Two solutions
			const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
			const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);

			// Only include intersections on the actual line segment
			if (t1 >= 0 && t1 <= 1) {
				intersections.push({
					x: x1 + t1 * dx,
					y: y1 + t1 * dy
				});
			}
			if (t2 >= 0 && t2 <= 1) {
				intersections.push({
					x: x1 + t2 * dx,
					y: y1 + t2 * dy
				});
			}
		}
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

	// Line-Ellipse intersection
	// Transform to unit circle space, intersect, transform back
	intersect_line_ellipse(line, ellipse) {
		const cx = ellipse.x;
		const cy = ellipse.y;
		const rx = ellipse.radiusX;
		const ry = ellipse.radiusY;

		if (rx <= 0 || ry <= 0) return [];

		// Transform line endpoints to unit circle space
		const x1 = (line.start.x - cx) / rx;
		const y1 = (line.start.y - cy) / ry;
		const x2 = (line.end.x - cx) / rx;
		const y2 = (line.end.y - cy) / ry;

		const dx = x2 - x1;
		const dy = y2 - y1;

		// Quadratic coefficients for line-unit-circle intersection
		// Line: P = P1 + t * D, where t in [0,1] for segment
		// Circle: x^2 + y^2 = 1
		// Substitute: (x1 + t*dx)^2 + (y1 + t*dy)^2 = 1
		const a = dx * dx + dy * dy;
		const b = 2 * (x1 * dx + y1 * dy);
		const c = x1 * x1 + y1 * y1 - 1;

		const discriminant = b * b - 4 * a * c;
		const intersections = [];

		if (discriminant < 0) {
			return intersections;
		}

		if (discriminant === 0) {
			const t = -b / (2 * a);
			// Only include if on the actual line segment
			if (t >= 0 && t <= 1) {
				intersections.push({
					x: line.start.x + t * (line.end.x - line.start.x),
					y: line.start.y + t * (line.end.y - line.start.y)
				});
			}
		} else {
			const sqrtDisc = Math.sqrt(discriminant);
			const t1 = (-b + sqrtDisc) / (2 * a);
			const t2 = (-b - sqrtDisc) / (2 * a);

			// Only include intersections on the actual line segment
			if (t1 >= 0 && t1 <= 1) {
				intersections.push({
					x: line.start.x + t1 * (line.end.x - line.start.x),
					y: line.start.y + t1 * (line.end.y - line.start.y)
				});
			}
			if (t2 >= 0 && t2 <= 1) {
				intersections.push({
					x: line.start.x + t2 * (line.end.x - line.start.x),
					y: line.start.y + t2 * (line.end.y - line.start.y)
				});
			}
		}

		return intersections;
	}

	// Circle-Ellipse intersection (numerical approach with sign-change detection)
	intersect_circle_ellipse(circle, ellipse) {
		const intersections = [];
		const samples = 1440;

		// Walk around circle, detect crossings with ellipse boundary
		const findCircleCrossings = () => {
			const getPoint = (angle) => ({
				x: circle.x + circle.radius * Math.cos(angle),
				y: circle.y + circle.radius * Math.sin(angle)
			});

			const signedDist = (p) => {
				const dx = p.x - ellipse.x;
				const dy = p.y - ellipse.y;
				return (dx * dx) / (ellipse.radiusX * ellipse.radiusX) +
				       (dy * dy) / (ellipse.radiusY * ellipse.radiusY) - 1;
			};

			let prevAngle = 0;
			let prevDist = signedDist(getPoint(0));

			for (let i = 1; i <= samples; i++) {
				const angle = (i / samples) * Math.PI * 2;
				const dist = signedDist(getPoint(angle));

				if (prevDist * dist < 0) {
					let lo = prevAngle, hi = angle;
					let loDist = prevDist;
					for (let j = 0; j < 15; j++) {
						const mid = (lo + hi) / 2;
						const midDist = signedDist(getPoint(mid));
						if (loDist * midDist < 0) {
							hi = mid;
						} else {
							lo = mid;
							loDist = midDist;
						}
					}
					const intersection = getPoint((lo + hi) / 2);

					let isDuplicate = false;
					for (const existing of intersections) {
						const d = Math.sqrt((intersection.x - existing.x) ** 2 +
						                    (intersection.y - existing.y) ** 2);
						if (d < 2) {
							isDuplicate = true;
							break;
						}
					}
					if (!isDuplicate) {
						intersections.push(intersection);
					}
				}

				prevAngle = angle;
				prevDist = dist;
			}
		};

		// Walk around ellipse, detect crossings with circle boundary
		const findEllipseCrossings = () => {
			const getPoint = (angle) => ({
				x: ellipse.x + ellipse.radiusX * Math.cos(angle),
				y: ellipse.y + ellipse.radiusY * Math.sin(angle)
			});

			const signedDist = (p) => {
				const dx = p.x - circle.x;
				const dy = p.y - circle.y;
				return Math.sqrt(dx * dx + dy * dy) - circle.radius;
			};

			let prevAngle = 0;
			let prevDist = signedDist(getPoint(0));

			for (let i = 1; i <= samples; i++) {
				const angle = (i / samples) * Math.PI * 2;
				const dist = signedDist(getPoint(angle));

				if (prevDist * dist < 0) {
					let lo = prevAngle, hi = angle;
					let loDist = prevDist;
					for (let j = 0; j < 15; j++) {
						const mid = (lo + hi) / 2;
						const midDist = signedDist(getPoint(mid));
						if (loDist * midDist < 0) {
							hi = mid;
						} else {
							lo = mid;
							loDist = midDist;
						}
					}
					const intersection = getPoint((lo + hi) / 2);

					let isDuplicate = false;
					for (const existing of intersections) {
						const d = Math.sqrt((intersection.x - existing.x) ** 2 +
						                    (intersection.y - existing.y) ** 2);
						if (d < 2) {
							isDuplicate = true;
							break;
						}
					}
					if (!isDuplicate) {
						intersections.push(intersection);
					}
				}

				prevAngle = angle;
				prevDist = dist;
			}
		};

		// Sample from both shapes
		findCircleCrossings();
		findEllipseCrossings();

		return intersections;
	}

	// Arc-Ellipse intersection: use circle-ellipse, filter by arc angle
	intersect_arc_ellipse(arc, ellipse) {
		const circleIntersections = this.intersect_circle_ellipse(arc, ellipse);
		if (!circleIntersections || circleIntersections.length === 0) {
			return [];
		}
		return circleIntersections.filter(p => this.isPointOnArc(p, arc));
	}

	// Check if a point lies on an elliptical arc's angle range
	isPointOnEllipticalArc(point, arc) {
		// Transform to unit circle space to get angle
		const nx = (point.x - arc.x) / arc.radiusX;
		const ny = (point.y - arc.y) / arc.radiusY;
		const angle = Math.atan2(ny, nx);
		return arc.containsAngle(angle);
	}

	// Line-EllipticalArc intersection: use line-ellipse, filter by arc angle
	intersect_line_elliptical_arc(line, arc) {
		// Reuse line-ellipse intersection
		const ellipseIntersections = this.intersect_line_ellipse(line, arc);
		if (!ellipseIntersections || ellipseIntersections.length === 0) {
			return [];
		}
		// Filter to only points within the arc's angle range
		return ellipseIntersections.filter(p => this.isPointOnEllipticalArc(p, arc));
	}

	// Circle-EllipticalArc intersection: use circle-ellipse, filter by elliptical arc angle
	intersect_circle_elliptical_arc(circle, arc) {
		const ellipseIntersections = this.intersect_circle_ellipse(circle, arc);
		if (!ellipseIntersections || ellipseIntersections.length === 0) {
			return [];
		}
		return ellipseIntersections.filter(p => this.isPointOnEllipticalArc(p, arc));
	}

	// Arc-EllipticalArc intersection: use circle-ellipse, filter by both arc angles
	intersect_arc_elliptical_arc(arc, ellipticalArc) {
		const ellipseIntersections = this.intersect_circle_ellipse(arc, ellipticalArc);
		if (!ellipseIntersections || ellipseIntersections.length === 0) {
			return [];
		}
		return ellipseIntersections.filter(p =>
			this.isPointOnArc(p, arc) && this.isPointOnEllipticalArc(p, ellipticalArc)
		);
	}

	// Ellipse-Ellipse intersection (numerical approach with sign-change detection)
	intersect_ellipse_ellipse(ellipse0, ellipse1) {
		const intersections = [];
		const samples = 1440;  // Higher resolution

		// Find intersections by walking around an ellipse and detecting boundary crossings
		const findCrossings = (sourceEllipse, targetEllipse) => {
			const getPoint = (angle) => ({
				x: sourceEllipse.x + sourceEllipse.radiusX * Math.cos(angle),
				y: sourceEllipse.y + sourceEllipse.radiusY * Math.sin(angle)
			});

			const signedDist = (p) => {
				const dx = p.x - targetEllipse.x;
				const dy = p.y - targetEllipse.y;
				return (dx * dx) / (targetEllipse.radiusX * targetEllipse.radiusX) +
				       (dy * dy) / (targetEllipse.radiusY * targetEllipse.radiusY) - 1;
			};

			let prevAngle = 0;
			let prevDist = signedDist(getPoint(0));

			for (let i = 1; i <= samples; i++) {
				const angle = (i / samples) * Math.PI * 2;
				const dist = signedDist(getPoint(angle));

				// Check for sign change (crossing the ellipse boundary)
				if (prevDist * dist < 0) {
					// Binary search to refine intersection point
					let lo = prevAngle, hi = angle;
					let loDist = prevDist;
					for (let j = 0; j < 15; j++) {
						const mid = (lo + hi) / 2;
						const midDist = signedDist(getPoint(mid));
						if (loDist * midDist < 0) {
							hi = mid;
						} else {
							lo = mid;
							loDist = midDist;
						}
					}
					const intersection = getPoint((lo + hi) / 2);

					// Check for duplicates
					let isDuplicate = false;
					for (const existing of intersections) {
						const d = Math.sqrt((intersection.x - existing.x) ** 2 +
						                    (intersection.y - existing.y) ** 2);
						if (d < 2) {
							isDuplicate = true;
							break;
						}
					}
					if (!isDuplicate) {
						intersections.push(intersection);
					}
				}

				prevAngle = angle;
				prevDist = dist;
			}
		};

		// Sample from both ellipses to ensure we find all intersections
		findCrossings(ellipse0, ellipse1);
		findCrossings(ellipse1, ellipse0);

		return intersections;
	}

	// Ellipse-EllipticalArc intersection: use ellipse-ellipse, filter by arc angle
	intersect_ellipse_elliptical_arc(ellipse, arc) {
		const ellipseIntersections = this.intersect_ellipse_ellipse(ellipse, arc);
		if (!ellipseIntersections || ellipseIntersections.length === 0) {
			return [];
		}
		return ellipseIntersections.filter(p => this.isPointOnEllipticalArc(p, arc));
	}

	// EllipticalArc-EllipticalArc intersection: use ellipse-ellipse, filter by both arcs
	intersect_elliptical_arc_elliptical_arc(arc0, arc1) {
		const ellipseIntersections = this.intersect_ellipse_ellipse(arc0, arc1);
		if (!ellipseIntersections || ellipseIntersections.length === 0) {
			return [];
		}
		return ellipseIntersections.filter(p =>
			this.isPointOnEllipticalArc(p, arc0) && this.isPointOnEllipticalArc(p, arc1)
		);
	}

	// ==================== SPLINE INTERSECTIONS ====================

	// Line-Spline intersection using numerical sampling
	intersect_line_spline(line, spline) {
		const intersections = [];
		const samples = 100;

		// Signed distance from point to line (positive on one side, negative on other)
		const signedDistToLine = (p) => {
			const dx = line.end.x - line.start.x;
			const dy = line.end.y - line.start.y;
			const len = Math.sqrt(dx * dx + dy * dy);
			if (len < 1e-10) return Infinity;
			// Cross product gives signed distance
			return ((p.x - line.start.x) * dy - (p.y - line.start.y) * dx) / len;
		};

		// Check if point is within line segment bounds
		const isOnSegment = (p) => {
			const t = this.getLineParameter(line, p);
			return t >= -0.001 && t <= 1.001;
		};

		let prevT = 0;
		let prevPt = spline.evaluate(0);
		let prevDist = signedDistToLine(prevPt);

		for (let i = 1; i <= samples; i++) {
			const t = i / samples;
			const pt = spline.evaluate(t);
			const dist = signedDistToLine(pt);

			// Sign change means crossing
			if (prevDist * dist < 0) {
				// Binary search to refine
				let lo = prevT, hi = t;
				let loDist = prevDist;

				for (let j = 0; j < 20; j++) {
					const mid = (lo + hi) / 2;
					const midPt = spline.evaluate(mid);
					const midDist = signedDistToLine(midPt);

					if (Math.abs(midDist) < 0.01) {
						lo = hi = mid;
						break;
					}

					if (loDist * midDist < 0) {
						hi = mid;
					} else {
						lo = mid;
						loDist = midDist;
					}
				}

				const intersection = spline.evaluate((lo + hi) / 2);

				// Check if intersection is within line segment
				if (isOnSegment(intersection)) {
					// Check for duplicates
					let isDupe = false;
					for (const existing of intersections) {
						if (Math.hypot(intersection.x - existing.x, intersection.y - existing.y) < 1) {
							isDupe = true;
							break;
						}
					}
					if (!isDupe) {
						intersections.push(intersection);
					}
				}
			}

			prevT = t;
			prevPt = pt;
			prevDist = dist;
		}

		return intersections;
	}

	// Helper: get parameter t for point projected onto line
	getLineParameter(line, p) {
		const dx = line.end.x - line.start.x;
		const dy = line.end.y - line.start.y;
		const len2 = dx * dx + dy * dy;
		if (len2 < 1e-10) return 0;
		return ((p.x - line.start.x) * dx + (p.y - line.start.y) * dy) / len2;
	}

	// Circle-Spline intersection
	intersect_circle_spline(circle, spline) {
		const intersections = [];
		const samples = 100;

		// Signed distance: negative inside circle, positive outside
		const signedDist = (p) => {
			const d = Math.hypot(p.x - circle.x, p.y - circle.y);
			return d - circle.radius;
		};

		let prevT = 0;
		let prevDist = signedDist(spline.evaluate(0));

		for (let i = 1; i <= samples; i++) {
			const t = i / samples;
			const pt = spline.evaluate(t);
			const dist = signedDist(pt);

			if (prevDist * dist < 0) {
				// Binary search
				let lo = prevT, hi = t;
				let loDist = prevDist;

				for (let j = 0; j < 20; j++) {
					const mid = (lo + hi) / 2;
					const midDist = signedDist(spline.evaluate(mid));

					if (Math.abs(midDist) < 0.01) {
						lo = hi = mid;
						break;
					}

					if (loDist * midDist < 0) {
						hi = mid;
					} else {
						lo = mid;
						loDist = midDist;
					}
				}

				const intersection = spline.evaluate((lo + hi) / 2);

				let isDupe = false;
				for (const existing of intersections) {
					if (Math.hypot(intersection.x - existing.x, intersection.y - existing.y) < 1) {
						isDupe = true;
						break;
					}
				}
				if (!isDupe) {
					intersections.push(intersection);
				}
			}

			prevT = t;
			prevDist = dist;
		}

		return intersections;
	}

	// Arc-Spline intersection: use circle-spline, filter by arc angle
	intersect_arc_spline(arc, spline) {
		const circleIntersections = this.intersect_circle_spline(arc, spline);
		if (!circleIntersections || circleIntersections.length === 0) {
			return [];
		}
		return circleIntersections.filter(p => this.isPointOnArc(p, arc));
	}

	// Ellipse-Spline intersection
	intersect_ellipse_spline(ellipse, spline) {
		const intersections = [];
		const samples = 100;

		// Signed distance to ellipse boundary
		const signedDist = (p) => {
			const dx = p.x - ellipse.x;
			const dy = p.y - ellipse.y;
			return (dx * dx) / (ellipse.radiusX * ellipse.radiusX) +
			       (dy * dy) / (ellipse.radiusY * ellipse.radiusY) - 1;
		};

		let prevT = 0;
		let prevDist = signedDist(spline.evaluate(0));

		for (let i = 1; i <= samples; i++) {
			const t = i / samples;
			const pt = spline.evaluate(t);
			const dist = signedDist(pt);

			if (prevDist * dist < 0) {
				let lo = prevT, hi = t;
				let loDist = prevDist;

				for (let j = 0; j < 20; j++) {
					const mid = (lo + hi) / 2;
					const midDist = signedDist(spline.evaluate(mid));

					if (Math.abs(midDist) < 0.001) {
						lo = hi = mid;
						break;
					}

					if (loDist * midDist < 0) {
						hi = mid;
					} else {
						lo = mid;
						loDist = midDist;
					}
				}

				const intersection = spline.evaluate((lo + hi) / 2);

				let isDupe = false;
				for (const existing of intersections) {
					if (Math.hypot(intersection.x - existing.x, intersection.y - existing.y) < 1) {
						isDupe = true;
						break;
					}
				}
				if (!isDupe) {
					intersections.push(intersection);
				}
			}

			prevT = t;
			prevDist = dist;
		}

		return intersections;
	}

	// EllipticalArc-Spline intersection
	intersect_elliptical_arc_spline(arc, spline) {
		const ellipseIntersections = this.intersect_ellipse_spline(arc, spline);
		if (!ellipseIntersections || ellipseIntersections.length === 0) {
			return [];
		}
		return ellipseIntersections.filter(p => this.isPointOnEllipticalArc(p, arc));
	}

	// Spline-Spline intersection
	intersect_spline_spline(spline0, spline1) {
		const intersections = [];
		const samples = 50;

		// For each sample point on spline0, find closest point on spline1
		// and detect when they cross
		for (let i = 0; i < samples; i++) {
			const t0a = i / samples;
			const t0b = (i + 1) / samples;
			const p0a = spline0.evaluate(t0a);
			const p0b = spline0.evaluate(t0b);

			for (let j = 0; j < samples; j++) {
				const t1a = j / samples;
				const t1b = (j + 1) / samples;
				const p1a = spline1.evaluate(t1a);
				const p1b = spline1.evaluate(t1b);

				// Check if line segments p0a-p0b and p1a-p1b intersect
				const intersection = this.lineSegmentIntersection(p0a, p0b, p1a, p1b);
				if (intersection) {
					let isDupe = false;
					for (const existing of intersections) {
						if (Math.hypot(intersection.x - existing.x, intersection.y - existing.y) < 2) {
							isDupe = true;
							break;
						}
					}
					if (!isDupe) {
						intersections.push(intersection);
					}
				}
			}
		}

		return intersections;
	}

	// Helper: line segment intersection
	lineSegmentIntersection(p1, p2, p3, p4) {
		const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
		if (Math.abs(d) < 1e-10) return null;

		const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
		const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;

		if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
			return {
				x: p1.x + ua * (p2.x - p1.x),
				y: p1.y + ua * (p2.y - p1.y)
			};
		}

		return null;
	}
}