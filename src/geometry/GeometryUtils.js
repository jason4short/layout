/**
 * Static geometry utility functions for line operations.
 * These are commonly needed by tools like Fillet, Chamfer, Trim, Extend.
 */

export class GeometryUtils {

	/**
	 * Find intersection point of two lines (extended infinitely).
	 * Returns {x, y} or null if lines are parallel.
	 */
	static lineIntersection(line1, line2) {
		const x1 = line1.start.x, y1 = line1.start.y;
		const x2 = line1.end.x, y2 = line1.end.y;
		const x3 = line2.start.x, y3 = line2.start.y;
		const x4 = line2.end.x, y4 = line2.end.y;

		const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

		if (Math.abs(denom) < 1e-10) {
			return null; // Parallel lines
		}

		const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

		return {
			x: x1 + t * (x2 - x1),
			y: y1 + t * (y2 - y1)
		};
	}

	/**
	 * Project a point onto an infinite line (not clamped to segment).
	 * Returns the closest point on the infinite line to the given point.
	 */
	static projectPointOntoLine(point, line) {
		const ax = line.start.x, ay = line.start.y;
		const bx = line.end.x, by = line.end.y;

		const dx = bx - ax;
		const dy = by - ay;
		const lenSq = dx * dx + dy * dy;

		if (lenSq < 1e-10) return { x: ax, y: ay };

		const t = ((point.x - ax) * dx + (point.y - ay) * dy) / lenSq;

		return {
			x: ax + t * dx,
			y: ay + t * dy
		};
	}

	/**
	 * Get unit direction vector along a line.
	 * If reverse is true, returns the opposite direction.
	 */
	static lineDirection(line, reverse = false) {
		const dx = line.end.x - line.start.x;
		const dy = line.end.y - line.start.y;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len < 1e-10) return { x: 1, y: 0 };

		const sign = reverse ? -1 : 1;
		return {
			x: sign * dx / len,
			y: sign * dy / len
		};
	}

	/**
	 * Get unit direction vector along a line, pointing toward a reference point.
	 * Useful for determining which "side" of an intersection to work with.
	 */
	static lineDirectionToward(line, fromPoint, towardPoint) {
		const dir = this.lineDirection(line);

		// Vector from fromPoint toward towardPoint
		const toTarget = {
			x: towardPoint.x - fromPoint.x,
			y: towardPoint.y - fromPoint.y
		};

		// Dot product tells us if dir points toward or away from target
		const dot = dir.x * toTarget.x + dir.y * toTarget.y;

		if (dot >= 0) {
			return dir;
		} else {
			return { x: -dir.x, y: -dir.y };
		}
	}

	/**
	 * Get unit direction vector along a line, pointing away from a reference point.
	 * Useful for chamfer where we go away from the intersection.
	 */
	static lineDirectionAwayFrom(line, fromPoint) {
		// Find which endpoint is farther from the reference point
		const distToStart 	= this.distance(line.start, fromPoint);
		const distToEnd 	= this.distance(line.end, fromPoint);

		let dir;
		if (distToStart > distToEnd) {
			dir = { x: line.start.x - fromPoint.x, y: line.start.y - fromPoint.y };
		} else {
			dir = { x: line.end.x - fromPoint.x, y: line.end.y - fromPoint.y };
		}

		const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
		if (len < 1e-10) return { x: 1, y: 0 };

		return { x: dir.x / len, y: dir.y / len };
	}

	/**
	 * Trim a line at trimPoint, keeping the side where clickPt is.
	 * The user clicked on the part they want to keep.
	 */
		  // trimLineKeepClickSide(line, intersection, clickPt, trimPoint);
	static trimLineKeepClickSide(line, intersection, clickPt, trimPoint) {
		let test;
		
		if(line.start.x == line.end.x){
			test = this.vectorAlign(line.start.y, line.end.y, intersection.y, clickPt.y);
		}else{
			test = this.vectorAlign(line.start.x, line.end.x, intersection.x, clickPt.x);
		}
		
		if(test){
			// Click is closer to end - keep end, replace start
			line.start.x = trimPoint.x;
			line.start.y = trimPoint.y;
		}else{
			line.end.x = trimPoint.x;
			line.end.y = trimPoint.y;
		}
	}	
	
	static vectorAlign(start, end, from, to){
		return Math.sign(end - start) === Math.sign(to - from);
	}
	
	
	
	/**
	 * Trim a line at a given point, keeping the segment on one side.
	 * keepDirection: unit vector pointing toward the side to keep.
	 */
// 	static trimLineAtPoint(line, trimPoint, keepDirection) {
// 		const dx = line.end.x - line.start.x;
// 		const dy = line.end.y - line.start.y;
// 		const len = Math.sqrt(dx * dx + dy * dy);
// 
// 		if (len < 1e-10) return;
// 
// 		const lineDirX = dx / len;
// 		const lineDirY = dy / len;
// 
// 		// Check if keepDirection aligns with start->end
// 		const dot = keepDirection.x * lineDirX + keepDirection.y * lineDirY;
// 
// 		if (dot > 0) {
// 			// Keep direction aligns with start->end, so trim start
// 			line.start.x = trimPoint.x;
// 			line.start.y = trimPoint.y;
// 		} else {
// 			// Keep direction is opposite, so trim end
// 			line.end.x = trimPoint.x;
// 			line.end.y = trimPoint.y;
// 		}
// 
// 		line.update();
// 	}

	/**
	 * Distance between two points.
	 */
	static distance(p1, p2) {
		const dx = p2.x - p1.x;
		const dy = p2.y - p1.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	/**
	 * Angle between two unit vectors (in radians).
	 */
	static angleBetweenVectors(v1, v2) {
		const dot = v1.x * v2.x + v1.y * v2.y;
		return Math.acos(Math.max(-1, Math.min(1, dot)));
	}

	/**
	 * Normalize a vector to unit length.
	 */
	static normalize(v) {
		const len = Math.sqrt(v.x * v.x + v.y * v.y);
		if (len < 1e-10) return { x: 0, y: 0 };
		return { x: v.x / len, y: v.y / len };
	}

	/**
	 * Add two vectors.
	 */
	static addVectors(v1, v2) {
		return { x: v1.x + v2.x, y: v1.y + v2.y };
	}

	/**
	 * Scale a vector by a scalar.
	 */
	static scaleVector(v, s) {
		return { x: v.x * s, y: v.y * s };
	}

	/**
	 * Find intersection points of two circles.
	 * Returns array of 0, 1, or 2 points.
	 */
	static circleCircleIntersection(c1x, c1y, r1, c2x, c2y, r2) {
		const dx = c2x - c1x;
		const dy = c2y - c1y;
		const d = Math.sqrt(dx * dx + dy * dy);

		// No solution: circles too far apart or one inside the other
		if (d > r1 + r2 + 1e-10) return [];
		if (d < Math.abs(r1 - r2) - 1e-10) return [];
		if (d < 1e-10 && Math.abs(r1 - r2) < 1e-10) return []; // Coincident circles

		const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
		const hSq = r1 * r1 - a * a;

		// Single intersection point (circles touch)
		if (hSq < 1e-10) {
			const px = c1x + a * dx / d;
			const py = c1y + a * dy / d;
			return [{ x: px, y: py }];
		}

		const h = Math.sqrt(hSq);

		// Midpoint between intersections
		const px = c1x + a * dx / d;
		const py = c1y + a * dy / d;

		// Two intersection points (perpendicular offset by h)
		return [
			{ x: px + h * dy / d, y: py - h * dx / d },
			{ x: px - h * dy / d, y: py + h * dx / d }
		];
	}

	/**
	 * Signed perpendicular distance from a point to an infinite line.
	 * Positive = left side of line (start→end), Negative = right side.
	 */
	static signedDistanceToLine(point, line) {
		const dx = line.end.x - line.start.x;
		const dy = line.end.y - line.start.y;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len < 1e-10) return this.distance(point, line.start);

		// Cross product gives signed area, divide by length for distance
		return ((point.x - line.start.x) * dy - (point.y - line.start.y) * dx) / len;
	}

	/**
	 * Find intersection points of a circle with lines parallel to the given line.
	 * Returns points on circle that are at perpendicular distance `offsetDistance` from the line.
	 * Checks both sides of the line (positive and negative offset).
	 * Returns array of 0-4 points.
	 */
	static circleLineOffsetIntersection(circleCenter, circleRadius, line, offsetDistance) {
		const results = [];

		// Line direction
		const dx = line.end.x - line.start.x;
		const dy = line.end.y - line.start.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len < 1e-10) return [];

		// Unit direction and normal
		const ux = dx / len;
		const uy = dy / len;
		const nx = -uy;  // Normal pointing left
		const ny = ux;

		// Check both sides of the line
		for (const side of [1, -1]) {
			// Offset line passes through this point
			const offsetLineX = line.start.x + side * offsetDistance * nx;
			const offsetLineY = line.start.y + side * offsetDistance * ny;

			// Find intersection of offset line with circle
			// Parametric line: P = offsetLinePoint + t * direction
			// Circle: |P - center|² = radius²

			// Vector from offset line point to circle center
			const toCenter = {
				x: circleCenter.x - offsetLineX,
				y: circleCenter.y - offsetLineY
			};

			// Project center onto line direction to find closest point
			const tClosest = toCenter.x * ux + toCenter.y * uy;

			// Closest point on offset line to circle center
			const closestX = offsetLineX + tClosest * ux;
			const closestY = offsetLineY + tClosest * uy;

			// Distance from closest point to center
			const distSq = (circleCenter.x - closestX) ** 2 + (circleCenter.y - closestY) ** 2;
			const radiusSq = circleRadius * circleRadius;

			if (distSq > radiusSq + 1e-10) continue;  // No intersection

			if (distSq >= radiusSq - 1e-10) {
				// Tangent - one point
				results.push({ x: closestX, y: closestY });
			} else {
				// Two intersection points
				const halfChord = Math.sqrt(radiusSq - distSq);
				results.push(
					{ x: closestX + halfChord * ux, y: closestY + halfChord * uy },
					{ x: closestX - halfChord * ux, y: closestY - halfChord * uy }
				);
			}
		}

		return results;
	}

	/**
	 * Find tangent point on a circular arc from an external fillet center.
	 * isInternal: true if fillet is on concave side of arc, false for convex.
	 * Returns the point on the arc's circle that is tangent to a fillet at filletCenter.
	 */
	static tangentPointOnArc(arcCenter, arcRadius, filletCenter, isInternal) {
		const dx = filletCenter.x - arcCenter.x;
		const dy = filletCenter.y - arcCenter.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < 1e-10) return null;

		// Tangent point is on the line between centers, at distance arcRadius from arc center
		// For external tangency: toward the fillet center
		// For internal tangency: away from the fillet center
		const sign = isInternal ? -1 : 1;

		return {
			x: arcCenter.x + sign * (dx / dist) * arcRadius,
			y: arcCenter.y + sign * (dy / dist) * arcRadius
		};
	}

	/**
	 * Trim an arc at trimPoint, keeping the side where clickPt is.
	 * The user clicked on the part they want to keep.
	 */
	static trimArcKeepClickSide(arc, trimPoint, clickPt) {
		const trimAngle = Math.atan2(trimPoint.y - arc.y, trimPoint.x - arc.x);

		// Project click point onto the arc perimeter (radial projection)
		const clickAngle = Math.atan2(clickPt.y - arc.y, clickPt.x - arc.x);
		const projectedClick = {
			x: arc.x + Math.cos(clickAngle) * arc.radius,
			y: arc.y + Math.sin(clickAngle) * arc.radius
		};

		// Get current arc endpoint positions
		const startPt = {
			x: arc.x + Math.cos(arc.startAngle) * arc.radius,
			y: arc.y + Math.sin(arc.startAngle) * arc.radius
		};
		const endPt = {
			x: arc.x + Math.cos(arc.endAngle) * arc.radius,
			y: arc.y + Math.sin(arc.endAngle) * arc.radius
		};

		// Which endpoint is closer to where the user clicked (projected onto arc)?
		const distStartToClick = this.distance(startPt, projectedClick);
		const distEndToClick = this.distance(endPt, projectedClick);

		if (distStartToClick < distEndToClick) {
			// Click is closer to start - keep start, replace end
			arc.endAngle = trimAngle;
		} else {
			// Click is closer to end - keep end, replace start
			arc.startAngle = trimAngle;
		}

		arc.update();
	}

	/**
	 * Get perpendicular (normal) vector to a line.
	 * Returns unit vector pointing left of line direction (start→end).
	 */
	static lineNormal(line) {
		const dir = this.lineDirection(line);
		return { x: -dir.y, y: dir.x };
	}
}
