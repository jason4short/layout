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
		const distToStart = this.distance(line.start, fromPoint);
		const distToEnd = this.distance(line.end, fromPoint);

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
	 * Trim a line at a given point, keeping the segment on one side.
	 * keepDirection: unit vector pointing toward the side to keep.
	 */
	static trimLineAtPoint(line, trimPoint, keepDirection) {
		const dx = line.end.x - line.start.x;
		const dy = line.end.y - line.start.y;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len < 1e-10) return;

		const lineDirX = dx / len;
		const lineDirY = dy / len;

		// Check if keepDirection aligns with start->end
		const dot = keepDirection.x * lineDirX + keepDirection.y * lineDirY;

		if (dot > 0) {
			// Keep direction aligns with start->end, so trim start
			line.start.x = trimPoint.x;
			line.start.y = trimPoint.y;
		} else {
			// Keep direction is opposite, so trim end
			line.end.x = trimPoint.x;
			line.end.y = trimPoint.y;
		}

		line.update();
	}

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
}
