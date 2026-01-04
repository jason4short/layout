/**
 * Point transformation utilities for geometric operations.
 * Consolidates rotate, scale, and mirror operations used across all shape classes.
 */

/**
 * Rotate a point around an anchor point.
 * @param {number} px - Point x coordinate
 * @param {number} py - Point y coordinate
 * @param {number} anchorX - Anchor x coordinate
 * @param {number} anchorY - Anchor y coordinate
 * @param {number} angleRad - Rotation angle in radians
 * @returns {Object} Rotated point {x, y}
 */
export function rotatePoint(px, py, anchorX, anchorY, angleRad) {
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);
	const dx = px - anchorX;
	const dy = py - anchorY;
	return {
		x: anchorX + dx * cos - dy * sin,
		y: anchorY + dx * sin + dy * cos
	};
}

/**
 * Scale a point relative to an anchor point.
 * @param {number} px - Point x coordinate
 * @param {number} py - Point y coordinate
 * @param {number} anchorX - Anchor x coordinate
 * @param {number} anchorY - Anchor y coordinate
 * @param {number} factor - Scale factor
 * @returns {Object} Scaled point {x, y}
 */
export function scalePoint(px, py, anchorX, anchorY, factor) {
	return {
		x: anchorX + (px - anchorX) * factor,
		y: anchorY + (py - anchorY) * factor
	};
}

/**
 * Mirror a point across a line defined by two points.
 * @param {number} px - Point x coordinate
 * @param {number} py - Point y coordinate
 * @param {number} x1 - Line point 1 x
 * @param {number} y1 - Line point 1 y
 * @param {number} x2 - Line point 2 x
 * @param {number} y2 - Line point 2 y
 * @returns {Object} Mirrored point {x, y}
 */
export function mirrorPoint(px, py, x1, y1, x2, y2) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lenSq = dx * dx + dy * dy;

	if (lenSq < 1e-20) {
		return { x: px, y: py };
	}

	const t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
	const cx = x1 + t * dx;
	const cy = y1 + t * dy;

	return {
		x: 2 * cx - px,
		y: 2 * cy - py
	};
}

/**
 * Translate a point by an offset.
 * @param {number} px - Point x coordinate
 * @param {number} py - Point y coordinate
 * @param {number} dx - X offset
 * @param {number} dy - Y offset
 * @returns {Object} Translated point {x, y}
 */
export function translatePoint(px, py, dx, dy) {
	return {
		x: px + dx,
		y: py + dy
	};
}

/**
 * Get the angle of a mirror line (for reflecting angles).
 * @param {number} x1 - Line point 1 x
 * @param {number} y1 - Line point 1 y
 * @param {number} x2 - Line point 2 x
 * @param {number} y2 - Line point 2 y
 * @returns {number} Line angle in radians
 */
export function getMirrorLineAngle(x1, y1, x2, y2) {
	return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Mirror an angle across a mirror line.
 * @param {number} angle - Angle to mirror (radians)
 * @param {number} lineAngle - Mirror line angle (radians)
 * @returns {number} Mirrored angle (radians)
 */
export function mirrorAngle(angle, lineAngle) {
	return 2 * lineAngle - angle;
}

/**
 * Apply rotation to a Point object in place.
 * @param {Object} point - Point object with x, y properties
 * @param {number} anchorX - Anchor x coordinate
 * @param {number} anchorY - Anchor y coordinate
 * @param {number} angleRad - Rotation angle in radians
 */
export function rotatePointInPlace(point, anchorX, anchorY, angleRad) {
	const result = rotatePoint(point.x, point.y, anchorX, anchorY, angleRad);
	point.x = result.x;
	point.y = result.y;
}

/**
 * Apply scaling to a Point object in place.
 * @param {Object} point - Point object with x, y properties
 * @param {number} anchorX - Anchor x coordinate
 * @param {number} anchorY - Anchor y coordinate
 * @param {number} factor - Scale factor
 */
export function scalePointInPlace(point, anchorX, anchorY, factor) {
	const result = scalePoint(point.x, point.y, anchorX, anchorY, factor);
	point.x = result.x;
	point.y = result.y;
}

/**
 * Apply mirror to a Point object in place.
 * @param {Object} point - Point object with x, y properties
 * @param {number} x1 - Line point 1 x
 * @param {number} y1 - Line point 1 y
 * @param {number} x2 - Line point 2 x
 * @param {number} y2 - Line point 2 y
 */
export function mirrorPointInPlace(point, x1, y1, x2, y2) {
	const result = mirrorPoint(point.x, point.y, x1, y1, x2, y2);
	point.x = result.x;
	point.y = result.y;
}

/**
 * Apply translation to a Point object in place.
 * @param {Object} point - Point object with x, y properties
 * @param {number} dx - X offset
 * @param {number} dy - Y offset
 */
export function translatePointInPlace(point, dx, dy) {
	point.x += dx;
	point.y += dy;
}
