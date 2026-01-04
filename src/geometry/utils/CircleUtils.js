/**
 * Circle and arc-specific geometry utility functions.
 * Used by tools like Fillet, Trim, and arc creation tools.
 */

import * as VectorUtils from './VectorUtils.js';
import * as AngleUtils from './AngleUtils.js';

/**
 * Find intersection points of two circles.
 * @param {number} c1x - Circle 1 center x
 * @param {number} c1y - Circle 1 center y
 * @param {number} r1 - Circle 1 radius
 * @param {number} c2x - Circle 2 center x
 * @param {number} c2y - Circle 2 center y
 * @param {number} r2 - Circle 2 radius
 * @returns {Array} Array of 0, 1, or 2 intersection points
 */
export function circleCircleIntersection(c1x, c1y, r1, c2x, c2y, r2) {
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
 * Find intersection points of a circle with lines parallel to the given line.
 * Checks both sides of the line at offsetDistance.
 * @param {Object} circleCenter - Circle center {x, y}
 * @param {number} circleRadius - Circle radius
 * @param {Object} line - Line with start and end points
 * @param {number} offsetDistance - Perpendicular distance from line
 * @returns {Array} Array of 0-4 intersection points
 */
export function circleLineOffsetIntersection(circleCenter, circleRadius, line, offsetDistance) {
	const results = [];

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
		const offsetLineX = line.start.x + side * offsetDistance * nx;
		const offsetLineY = line.start.y + side * offsetDistance * ny;

		const toCenter = {
			x: circleCenter.x - offsetLineX,
			y: circleCenter.y - offsetLineY
		};

		const tClosest = toCenter.x * ux + toCenter.y * uy;
		const closestX = offsetLineX + tClosest * ux;
		const closestY = offsetLineY + tClosest * uy;

		const distSq = (circleCenter.x - closestX) ** 2 + (circleCenter.y - closestY) ** 2;
		const radiusSq = circleRadius * circleRadius;

		if (distSq > radiusSq + 1e-10) continue;

		if (distSq >= radiusSq - 1e-10) {
			results.push({ x: closestX, y: closestY });
		} else {
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
 * @param {Object} arcCenter - Arc center {x, y}
 * @param {number} arcRadius - Arc radius
 * @param {Object} filletCenter - Fillet center {x, y}
 * @param {boolean} isInternal - True if fillet is on concave side of arc
 * @returns {Object|null} Tangent point {x, y} or null
 */
export function tangentPointOnArc(arcCenter, arcRadius, filletCenter, isInternal) {
	const dx = filletCenter.x - arcCenter.x;
	const dy = filletCenter.y - arcCenter.y;
	const dist = Math.sqrt(dx * dx + dy * dy);

	if (dist < 1e-10) return null;

	const sign = isInternal ? -1 : 1;

	return {
		x: arcCenter.x + sign * (dx / dist) * arcRadius,
		y: arcCenter.y + sign * (dy / dist) * arcRadius
	};
}

/**
 * Get point on a circle at a given angle.
 * @param {number} centerX - Circle center x
 * @param {number} centerY - Circle center y
 * @param {number} radius - Circle radius
 * @param {number} angle - Angle in radians
 * @returns {Object} Point on circle {x, y}
 */
export function getPointAtAngle(centerX, centerY, radius, angle) {
	return {
		x: centerX + Math.cos(angle) * radius,
		y: centerY + Math.sin(angle) * radius
	};
}

/**
 * Get the angle from circle center to a point.
 * @param {number} centerX - Circle center x
 * @param {number} centerY - Circle center y
 * @param {number} px - Point x
 * @param {number} py - Point y
 * @returns {number} Angle in radians
 */
export function getAngleToPoint(centerX, centerY, px, py) {
	return Math.atan2(py - centerY, px - centerX);
}

/**
 * Get tangent angle (in degrees) at a point on a circle.
 * Tangent is perpendicular to the radius at that point.
 * @param {number} centerX - Circle center x
 * @param {number} centerY - Circle center y
 * @param {number} px - Point x on circle
 * @param {number} py - Point y on circle
 * @returns {number} Tangent angle in degrees
 */
export function getTangentAngle(centerX, centerY, px, py) {
	const radiusAngle = Math.atan2(py - centerY, px - centerX);
	const tangentAngle = radiusAngle + Math.PI / 2;
	return tangentAngle * (180 / Math.PI);
}

/**
 * Trim an arc at trimPoint, keeping the side where clickPt is.
 * @param {Object} arc - Arc to trim (modified in place)
 * @param {Object} trimPoint - Trim point {x, y}
 * @param {Object} clickPt - Click point {x, y}
 */
export function trimArcKeepClickSide(arc, trimPoint, clickPt) {
	const trimAngle = Math.atan2(trimPoint.y - arc.y, trimPoint.x - arc.x);
	const clickAngle = Math.atan2(clickPt.y - arc.y, clickPt.x - arc.x);

	const startPt = getPointAtAngle(arc.x, arc.y, arc.radius, arc.startAngle);
	const endPt = getPointAtAngle(arc.x, arc.y, arc.radius, arc.endAngle);

	// Project click onto arc perimeter for distance comparison
	const projectedClick = getPointAtAngle(arc.x, arc.y, arc.radius, clickAngle);

	const distStartToClick = VectorUtils.distance(startPt, projectedClick);
	const distEndToClick = VectorUtils.distance(endPt, projectedClick);

	if (distStartToClick < distEndToClick) {
		arc.endAngle = trimAngle;
	} else {
		arc.startAngle = trimAngle;
	}

	arc.update();
}

/**
 * Calculate arc parameters from 3 points.
 * @param {Object} p1 - First point {x, y}
 * @param {Object} p2 - Second point {x, y}
 * @param {Object} p3 - Third point {x, y}
 * @returns {Object|null} Arc parameters {cx, cy, radius, startAngle, endAngle} or null if collinear
 */
export function calculateArcFrom3Points(p1, p2, p3) {
	const ax = p1.x, ay = p1.y;
	const bx = p2.x, by = p2.y;
	const cx = p3.x, cy = p3.y;

	const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

	if (Math.abs(d) < 1e-10) {
		return null; // Points are collinear
	}

	const aSq = ax * ax + ay * ay;
	const bSq = bx * bx + by * by;
	const cSq = cx * cx + cy * cy;

	const centerX = (aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / d;
	const centerY = (aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / d;

	const radius = Math.sqrt((ax - centerX) ** 2 + (ay - centerY) ** 2);

	const angle1 = Math.atan2(ay - centerY, ax - centerX);
	const angle2 = Math.atan2(by - centerY, bx - centerX);
	const angle3 = Math.atan2(cy - centerY, cx - centerX);

	const norm1 = AngleUtils.normalizeAngle(angle1);
	const norm2 = AngleUtils.normalizeAngle(angle2);
	const norm3 = AngleUtils.normalizeAngle(angle3);

	// Check if angle3 is between angle1 and angle2 going counterclockwise
	const ccwContains = AngleUtils.isAngleInRange(norm3, norm1, norm2);

	let startAngle, endAngle;
	if (ccwContains) {
		startAngle = angle1;
		endAngle = angle2;
	} else {
		startAngle = angle2;
		endAngle = angle1;
	}

	return {
		cx: centerX,
		cy: centerY,
		radius: radius,
		startAngle: startAngle,
		endAngle: endAngle
	};
}

/**
 * Calculate arc length.
 * @param {number} radius - Arc radius
 * @param {number} startAngle - Start angle (radians)
 * @param {number} endAngle - End angle (radians)
 * @returns {number} Arc length
 */
export function arcLength(radius, startAngle, endAngle) {
	let span = endAngle - startAngle;
	if (span < 0) span += Math.PI * 2;
	return radius * span;
}

/**
 * Calculate circle circumference.
 * @param {number} radius - Circle radius
 * @returns {number} Circumference
 */
export function circumference(radius) {
	return 2 * Math.PI * radius;
}

/**
 * Project a point radially onto a circle perimeter.
 * @param {number} centerX - Circle center x
 * @param {number} centerY - Circle center y
 * @param {number} radius - Circle radius
 * @param {number} px - Point x
 * @param {number} py - Point y
 * @returns {Object|null} Point on perimeter {x, y} or null if point is at center
 */
export function projectPointOntoCircle(centerX, centerY, radius, px, py) {
	const dx = px - centerX;
	const dy = py - centerY;
	const dist = Math.sqrt(dx * dx + dy * dy);

	if (dist < 1e-10) return null;

	return {
		x: centerX + (dx / dist) * radius,
		y: centerY + (dy / dist) * radius
	};
}
