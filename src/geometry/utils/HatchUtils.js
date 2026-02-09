/**
 * HatchUtils - Pure functions for generating crosshatch patterns.
 * Uses scanline approach: generate parallel lines, clip to shape boundary.
 */

import { Shape } from '../Geometry.js';

const EPSILON = 1e-10;

// Cubic bezier evaluation
function bezierPoint(t, p0, p1, p2, p3) {
	const mt = 1 - t;
	return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

/**
 * Convert a shape into line segments {x1,y1,x2,y2} for hatch clipping.
 * Tessellates curves into short chord segments.
 */
export function shapeToSegments(shape) {
	const segs = [];
	const geo = shape.geometry;

	if (geo === Shape.LINE) {
		segs.push({ x1: shape.start.x, y1: shape.start.y, x2: shape.end.x, y2: shape.end.y });
	} else if (geo === Shape.ARC || geo === Shape.TANGENT_ARC) {
		const steps = Math.max(8, Math.ceil(Math.abs(shape.endAngle - shape.startAngle) / (Math.PI / 16)));
		const dAngle = (shape.endAngle - shape.startAngle) / steps;
		for (let i = 0; i < steps; i++) {
			const a1 = shape.startAngle + i * dAngle;
			const a2 = shape.startAngle + (i + 1) * dAngle;
			segs.push({
				x1: shape.x + shape.radius * Math.cos(a1),
				y1: shape.y + shape.radius * Math.sin(a1),
				x2: shape.x + shape.radius * Math.cos(a2),
				y2: shape.y + shape.radius * Math.sin(a2)
			});
		}
	} else if (geo === Shape.CIRCLE) {
		const steps = 32;
		const dAngle = (Math.PI * 2) / steps;
		for (let i = 0; i < steps; i++) {
			const a1 = i * dAngle;
			const a2 = (i + 1) * dAngle;
			segs.push({
				x1: shape.x + shape.radius * Math.cos(a1),
				y1: shape.y + shape.radius * Math.sin(a1),
				x2: shape.x + shape.radius * Math.cos(a2),
				y2: shape.y + shape.radius * Math.sin(a2)
			});
		}
	} else if (geo === Shape.ELLIPSE) {
		const steps = 32;
		const dAngle = (Math.PI * 2) / steps;
		const cosR = Math.cos(shape.rotation || 0);
		const sinR = Math.sin(shape.rotation || 0);
		for (let i = 0; i < steps; i++) {
			const a1 = i * dAngle;
			const a2 = (i + 1) * dAngle;
			const lx1 = shape.radiusX * Math.cos(a1), ly1 = shape.radiusY * Math.sin(a1);
			const lx2 = shape.radiusX * Math.cos(a2), ly2 = shape.radiusY * Math.sin(a2);
			segs.push({
				x1: shape.x + lx1 * cosR - ly1 * sinR,
				y1: shape.y + lx1 * sinR + ly1 * cosR,
				x2: shape.x + lx2 * cosR - ly2 * sinR,
				y2: shape.y + lx2 * sinR + ly2 * cosR
			});
		}
	} else if (geo === Shape.SPLINE) {
		const steps = 20;
		for (let i = 0; i < steps; i++) {
			const t1 = i / steps;
			const t2 = (i + 1) / steps;
			segs.push({
				x1: bezierPoint(t1, shape.p0.x, shape.p1.x, shape.p2.x, shape.p3.x),
				y1: bezierPoint(t1, shape.p0.y, shape.p1.y, shape.p2.y, shape.p3.y),
				x2: bezierPoint(t2, shape.p0.x, shape.p1.x, shape.p2.x, shape.p3.x),
				y2: bezierPoint(t2, shape.p0.y, shape.p1.y, shape.p2.y, shape.p3.y)
			});
		}
	} else if (geo === Shape.POLYGON) {
		const verts = shape.getVertices();
		for (let i = 0; i < verts.length; i++) {
			const v1 = verts[i];
			const v2 = verts[(i + 1) % verts.length];
			segs.push({ x1: v1.x, y1: v1.y, x2: v2.x, y2: v2.y });
		}
	}
	return segs;
}

/**
 * Compute hatch segments for a group of shapes.
 * Collects boundary segments from all shapes, generates hatch lines, clips with even-odd rule.
 */
export function computeGroupHatch(shapes, bounds, hatchType, hatchAngle, hatchSpacing) {
	const allSegments = [];
	for (const shape of shapes) {
		allSegments.push(...shapeToSegments(shape));
	}
	if (allSegments.length < 2) return [];

	const hatchLines = generateHatchLines(bounds, hatchAngle, hatchSpacing);
	const result = [];
	for (const line of hatchLines) {
		const clipped = clipLineToSegments(
			{ x: line.x1, y: line.y1 },
			{ x: line.x2, y: line.y2 },
			allSegments
		);
		result.push(...clipped);
	}

	if (hatchType === 'cross') {
		const crossLines = generateHatchLines(bounds, hatchAngle + 90, hatchSpacing);
		for (const line of crossLines) {
			const clipped = clipLineToSegments(
				{ x: line.x1, y: line.y1 },
				{ x: line.x2, y: line.y2 },
				allSegments
			);
			result.push(...clipped);
		}
	}

	return result;
}

// Rotate a point around the origin
function rotatePoint(x, y, angle) {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return {
		x: x * cos - y * sin,
		y: x * sin + y * cos
	};
}

/**
 * Generate parallel hatch lines covering a bounding box at a given angle and spacing.
 * Returns array of {x1, y1, x2, y2} in world coordinates.
 */
export function generateHatchLines(bounds, angleDeg, spacing) {
	if (spacing <= 0) return [];

	const angleRad = (angleDeg * Math.PI) / 180;

	// Get bounding box corners
	const corners = [
		{ x: bounds.x, y: bounds.y },
		{ x: bounds.x + bounds.width, y: bounds.y },
		{ x: bounds.x + bounds.width, y: bounds.y + bounds.height },
		{ x: bounds.x, y: bounds.y + bounds.height }
	];

	// Rotate corners into hatch space (where lines are horizontal)
	const rotated = corners.map(c => rotatePoint(c.x, c.y, -angleRad));

	let minX = Infinity, maxX = -Infinity;
	let minY = Infinity, maxY = -Infinity;
	for (const c of rotated) {
		if (c.x < minX) minX = c.x;
		if (c.x > maxX) maxX = c.x;
		if (c.y < minY) minY = c.y;
		if (c.y > maxY) maxY = c.y;
	}

	// Generate horizontal lines in hatch space, then rotate back
	const lines = [];
	const startY = Math.ceil(minY / spacing) * spacing;

	for (let y = startY; y <= maxY; y += spacing) {
		// Line from left to right edge of rotated bbox
		const p1 = rotatePoint(minX, y, angleRad);
		const p2 = rotatePoint(maxX, y, angleRad);
		lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
	}

	return lines;
}

/**
 * Find intersection of two line segments.
 * Returns {x, y, t} where t is parameter along first segment, or null.
 */
function segmentIntersection(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
	const dx1 = ax2 - ax1;
	const dy1 = ay2 - ay1;
	const dx2 = bx2 - bx1;
	const dy2 = by2 - by1;

	const denom = dx1 * dy2 - dy1 * dx2;
	if (Math.abs(denom) < EPSILON) return null; // Parallel

	const t = ((bx1 - ax1) * dy2 - (by1 - ay1) * dx2) / denom;
	const u = ((bx1 - ax1) * dy1 - (by1 - ay1) * dx1) / denom;

	// t can be any value (hatch line extends beyond bbox), but u must be on the edge [0,1]
	if (u < -EPSILON || u > 1 + EPSILON) return null;

	return {
		x: ax1 + t * dx1,
		y: ay1 + t * dy1,
		t: t
	};
}

/**
 * Clip a line against a polygon boundary.
 * Returns array of {x1, y1, x2, y2} segments inside the polygon.
 */
export function clipLineToPolygon(start, end, vertices) {
	if (vertices.length < 3) return [];

	const dx = end.x - start.x;
	const dy = end.y - start.y;

	// Find all intersections with polygon edges
	const intersections = [];
	const n = vertices.length;

	for (let i = 0; i < n; i++) {
		const v1 = vertices[i];
		const v2 = vertices[(i + 1) % n];

		const hit = segmentIntersection(
			start.x, start.y, end.x, end.y,
			v1.x, v1.y, v2.x, v2.y
		);

		if (hit) {
			intersections.push(hit.t);
		}
	}

	if (intersections.length < 2) return [];

	// Sort by parameter along hatch line
	intersections.sort((a, b) => a - b);

	// Remove duplicates (line passing through a vertex hits two edges)
	const unique = [intersections[0]];
	for (let i = 1; i < intersections.length; i++) {
		if (Math.abs(intersections[i] - unique[unique.length - 1]) > EPSILON) {
			unique.push(intersections[i]);
		}
	}

	// Take pairs: enter/exit, enter/exit...
	const segments = [];
	for (let i = 0; i + 1 < unique.length; i += 2) {
		const t1 = unique[i];
		const t2 = unique[i + 1];
		segments.push({
			x1: start.x + t1 * dx,
			y1: start.y + t1 * dy,
			x2: start.x + t2 * dx,
			y2: start.y + t2 * dy
		});
	}

	return segments;
}

/**
 * Clip a line against a set of arbitrary line segments (not necessarily connected).
 * Uses even-odd rule: sort intersections, pair enter/exit.
 * Returns array of {x1, y1, x2, y2} segments inside the boundary.
 */
export function clipLineToSegments(start, end, segments) {
	if (segments.length < 2) return [];

	const dx = end.x - start.x;
	const dy = end.y - start.y;

	const intersections = [];

	for (const seg of segments) {
		const hit = segmentIntersection(
			start.x, start.y, end.x, end.y,
			seg.x1, seg.y1, seg.x2, seg.y2
		);
		if (hit) {
			intersections.push(hit.t);
		}
	}

	if (intersections.length < 2) return [];

	// Sort by parameter along hatch line
	intersections.sort((a, b) => a - b);

	// Remove duplicates (lines sharing an endpoint)
	const unique = [intersections[0]];
	for (let i = 1; i < intersections.length; i++) {
		if (Math.abs(intersections[i] - unique[unique.length - 1]) > EPSILON) {
			unique.push(intersections[i]);
		}
	}

	// Take pairs: enter/exit, enter/exit...
	const result = [];
	for (let i = 0; i + 1 < unique.length; i += 2) {
		const t1 = unique[i];
		const t2 = unique[i + 1];
		result.push({
			x1: start.x + t1 * dx,
			y1: start.y + t1 * dy,
			x2: start.x + t2 * dx,
			y2: start.y + t2 * dy
		});
	}

	return result;
}

/**
 * Clip a line against a circle.
 * Returns array of {x1, y1, x2, y2} segments inside the circle (0 or 1).
 */
export function clipLineToCircle(start, end, cx, cy, radius) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const fx = start.x - cx;
	const fy = start.y - cy;

	const a = dx * dx + dy * dy;
	if (a < EPSILON) return []; // Degenerate line

	const b = 2 * (fx * dx + fy * dy);
	const c = fx * fx + fy * fy - radius * radius;

	const discriminant = b * b - 4 * a * c;
	if (discriminant < 0) return []; // No intersection

	const sqrtDisc = Math.sqrt(discriminant);
	const t1 = (-b - sqrtDisc) / (2 * a);
	const t2 = (-b + sqrtDisc) / (2 * a);

	if (t1 > t2) return []; // Shouldn't happen, but safety check

	return [{
		x1: start.x + t1 * dx,
		y1: start.y + t1 * dy,
		x2: start.x + t2 * dx,
		y2: start.y + t2 * dy
	}];
}

/**
 * Clip a line against an ellipse.
 * Transforms to unit circle space, clips, transforms back.
 */
export function clipLineToEllipse(start, end, cx, cy, rx, ry, rotation) {
	// Transform line endpoints to ellipse-local coordinates
	const cosR = Math.cos(-rotation);
	const sinR = Math.sin(-rotation);

	function toLocal(px, py) {
		const dx = px - cx;
		const dy = py - cy;
		return {
			x: (dx * cosR - dy * sinR) / rx,
			y: (dx * sinR + dy * cosR) / ry
		};
	}

	function toWorld(lx, ly) {
		const wx = lx * rx;
		const wy = ly * ry;
		const cosR2 = Math.cos(rotation);
		const sinR2 = Math.sin(rotation);
		return {
			x: cx + wx * cosR2 - wy * sinR2,
			y: cy + wx * sinR2 + wy * cosR2
		};
	}

	// Clip against unit circle at origin in local space
	const localStart = toLocal(start.x, start.y);
	const localEnd = toLocal(end.x, end.y);

	const segments = clipLineToCircle(localStart, localEnd, 0, 0, 1);

	// Transform segments back to world space
	return segments.map(seg => {
		const p1 = toWorld(seg.x1, seg.y1);
		const p2 = toWorld(seg.x2, seg.y2);
		return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
	});
}
