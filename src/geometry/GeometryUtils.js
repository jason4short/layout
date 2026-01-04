/**
 * GeometryUtils - Facade for geometry utility functions.
 *
 * This class re-exports functions from the utils/ modules for backward compatibility.
 * Tools can import from here or directly from the specific utility modules.
 *
 * New code should prefer importing from specific utils:
 *   import * as LineUtils from './utils/LineUtils.js';
 *   import * as CircleUtils from './utils/CircleUtils.js';
 *   import * as VectorUtils from './utils/VectorUtils.js';
 */

import * as LineUtils from './utils/LineUtils.js';
import * as CircleUtils from './utils/CircleUtils.js';
import * as VectorUtils from './utils/VectorUtils.js';

export class GeometryUtils {

	// ============================================
	// LINE OPERATIONS (from LineUtils)
	// ============================================

	/**
	 * Find intersection point of two lines (extended infinitely).
	 * Returns {x, y} or null if lines are parallel.
	 */
	static lineIntersection(line1, line2) {
		return LineUtils.lineIntersection(line1, line2);
	}

	/**
	 * Project a point onto an infinite line (not clamped to segment).
	 * Returns the closest point on the infinite line to the given point.
	 */
	static projectPointOntoLine(point, line) {
		return LineUtils.projectPointOntoLine(point, line);
	}

	/**
	 * Get unit direction vector along a line.
	 * If reverse is true, returns the opposite direction.
	 */
	static lineDirection(line, reverse = false) {
		return LineUtils.lineDirection(line, reverse);
	}

	/**
	 * Get unit direction vector along a line, pointing toward a reference point.
	 */
	static lineDirectionToward(line, fromPoint, towardPoint) {
		return LineUtils.lineDirectionToward(line, fromPoint, towardPoint);
	}

	/**
	 * Get unit direction vector along a line, pointing away from a reference point.
	 */
	static lineDirectionAwayFrom(line, fromPoint) {
		return LineUtils.lineDirectionAwayFrom(line, fromPoint);
	}

	/**
	 * Trim a line at trimPoint, keeping the side where clickPt is.
	 */
	static trimLineKeepClickSide(line, intersection, clickPt, trimPoint) {
		return LineUtils.trimLineKeepClickSide(line, intersection, clickPt, trimPoint);
	}

	/**
	 * Helper for determining direction alignment.
	 */
	static vectorAlign(start, end, from, to) {
		return LineUtils.vectorAlign(start, end, from, to);
	}

	/**
	 * Get perpendicular (normal) vector to a line.
	 */
	static lineNormal(line) {
		return LineUtils.lineNormal(line);
	}

	/**
	 * Signed perpendicular distance from a point to an infinite line.
	 */
	static signedDistanceToLine(point, line) {
		return LineUtils.signedDistanceToLine(point, line);
	}

	// ============================================
	// VECTOR OPERATIONS (from VectorUtils)
	// ============================================

	/**
	 * Distance between two points.
	 */
	static distance(p1, p2) {
		return VectorUtils.distance(p1, p2);
	}

	/**
	 * Angle between two unit vectors (in radians).
	 */
	static angleBetweenVectors(v1, v2) {
		return VectorUtils.angleBetween(v1, v2);
	}

	/**
	 * Normalize a vector to unit length.
	 */
	static normalize(v) {
		return VectorUtils.normalize(v);
	}

	/**
	 * Add two vectors.
	 */
	static addVectors(v1, v2) {
		return VectorUtils.add(v1, v2);
	}

	/**
	 * Scale a vector by a scalar.
	 */
	static scaleVector(v, s) {
		return VectorUtils.scale(v, s);
	}

	// ============================================
	// CIRCLE OPERATIONS (from CircleUtils)
	// ============================================

	/**
	 * Find intersection points of two circles.
	 * Returns array of 0, 1, or 2 points.
	 */
	static circleCircleIntersection(c1x, c1y, r1, c2x, c2y, r2) {
		return CircleUtils.circleCircleIntersection(c1x, c1y, r1, c2x, c2y, r2);
	}

	/**
	 * Find intersection points of a circle with lines parallel to the given line.
	 */
	static circleLineOffsetIntersection(circleCenter, circleRadius, line, offsetDistance) {
		return CircleUtils.circleLineOffsetIntersection(circleCenter, circleRadius, line, offsetDistance);
	}

	/**
	 * Find tangent point on a circular arc from an external fillet center.
	 */
	static tangentPointOnArc(arcCenter, arcRadius, filletCenter, isInternal) {
		return CircleUtils.tangentPointOnArc(arcCenter, arcRadius, filletCenter, isInternal);
	}

	/**
	 * Trim an arc at trimPoint, keeping the side where clickPt is.
	 */
	static trimArcKeepClickSide(arc, trimPoint, clickPt) {
		return CircleUtils.trimArcKeepClickSide(arc, trimPoint, clickPt);
	}
}
