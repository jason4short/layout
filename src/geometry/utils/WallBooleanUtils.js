/**
 * WallBooleanUtils - Edge clipping for wall boolean rendering.
 *
 * When multiple walls overlap or meet, they should render as a single
 * unified filled shape with only exterior outlines drawn. This module
 * provides the math for computing which edge segments are exterior
 * (not hidden by another wall's interior).
 *
 * Uses Cyrus-Beck parametric clipping against convex polygons.
 */

const EPSILON = 0.05; // ~0.05mm inset so coincident boundary edges count as exterior

/**
 * Clip a segment against a convex polygon using Cyrus-Beck algorithm.
 * Returns the parametric interval [tEnter, tExit] where the segment
 * is inside the polygon, or null if no intersection.
 *
 * @param {{x:number, y:number}} segStart - Segment start point
 * @param {{x:number, y:number}} segEnd - Segment end point
 * @param {Array<{x:number, y:number}>} polyCorners - Polygon vertices (CCW or CW order)
 * @returns {[number, number]|null} [tEnter, tExit] or null
 */
export function clipSegmentAgainstConvexPoly(segStart, segEnd, polyCorners) {
	const dx = segEnd.x - segStart.x;
	const dy = segEnd.y - segStart.y;

	let tEnter = 0;
	let tExit = 1;
	const n = polyCorners.length;

	for (let i = 0; i < n; i++) {
		const c1 = polyCorners[i];
		const c2 = polyCorners[(i + 1) % n];

		// Edge vector
		const ex = c2.x - c1.x;
		const ey = c2.y - c1.y;

		// Inward-pointing normal (perpendicular to edge, pointing into polygon)
		// For a CW polygon this is (ey, -ex); for CCW it's (-ey, ex)
		// We determine direction by checking against polygon interior
		// Use the convention: normal = (-ey, ex) and test sign below
		let nx = -ey;
		let ny = ex;

		// Check that the normal points inward by testing against another vertex
		// Use the vertex two ahead as reference
		const ref = polyCorners[(i + 2) % n];
		const toRef = { x: ref.x - c1.x, y: ref.y - c1.y };
		if (nx * toRef.x + ny * toRef.y < 0) {
			// Normal was outward, flip it
			nx = -nx;
			ny = -ny;
		}

		// Apply epsilon inset: shift the edge plane inward slightly
		// so segments exactly on the boundary are treated as exterior
		const nLen = Math.sqrt(nx * nx + ny * ny);
		if (nLen === 0) continue;
		const insetX = (nx / nLen) * EPSILON;
		const insetY = (ny / nLen) * EPSILON;

		// Vector from edge start (inset) to segment start
		const wx = segStart.x - (c1.x + insetX);
		const wy = segStart.y - (c1.y + insetY);

		const denom = nx * dx + ny * dy;
		const numer = nx * wx + ny * wy;

		if (Math.abs(denom) < 1e-10) {
			// Segment is parallel to this edge
			if (numer < 0) {
				// Segment is outside this half-plane
				return null;
			}
			// Segment is inside this half-plane, continue
			continue;
		}

		const t = -numer / denom;

		if (denom > 0) {
			// Entering the half-plane (segment direction aligns with inward normal)
			if (t > tEnter) tEnter = t;
		} else {
			// Exiting the half-plane
			if (t < tExit) tExit = t;
		}

		if (tEnter > tExit) return null;
	}

	if (tEnter > tExit) return null;
	return [tEnter, tExit];
}

/**
 * Compute which portions of an edge segment are exterior (not inside any other wall).
 * Returns an array of parametric t-intervals that should be stroked.
 *
 * @param {{x:number, y:number}} edgeStart - Edge segment start
 * @param {{x:number, y:number}} edgeEnd - Edge segment end
 * @param {Array<Array<{x:number, y:number}>>} otherWallCornerArrays - Array of corner arrays for other walls
 * @returns {Array<[number, number]>} Array of [tStart, tEnd] intervals to stroke
 */
export function getExteriorSegments(edgeStart, edgeEnd, otherWallCornerArrays) {
	// Start with full segment visible
	let visible = [[0, 1]];

	for (const corners of otherWallCornerArrays) {
		const clip = clipSegmentAgainstConvexPoly(edgeStart, edgeEnd, corners);
		if (!clip) continue;

		const [clipEnter, clipExit] = clip;

		// Subtract this interior interval from visible set
		const newVisible = [];
		for (const [vStart, vEnd] of visible) {
			// No overlap
			if (clipExit <= vStart || clipEnter >= vEnd) {
				newVisible.push([vStart, vEnd]);
				continue;
			}

			// Left remainder
			if (clipEnter > vStart) {
				newVisible.push([vStart, clipEnter]);
			}
			// Right remainder
			if (clipExit < vEnd) {
				newVisible.push([clipExit, vEnd]);
			}
		}
		visible = newVisible;

		if (visible.length === 0) break;
	}

	return visible;
}

/**
 * Render walls with boolean merge — fill union, stroke only exterior edges.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} renderer - Renderer instance with toScreen/toScreenScale
 * @param {Array} walls - Array of Wall shapes
 * @param {string} fillColor - Fill color for wall interiors
 * @param {string} strokeColor - Stroke color for exterior edges
 * @param {number} lineWidth - Stroke width in pixels
 */
export function renderWallBoolean(ctx, renderer, walls, fillColor, strokeColor, lineWidth) {
	if (walls.length === 0) return;

	// Get corners for all walls (world coords)
	const allCorners = walls.map(w => w.getCorners());

	// ---- Fill pass: union of all wall rectangles ----
	ctx.beginPath();
	for (const corners of allCorners) {
		const screen = corners.map(c => renderer.toScreen(c.x, c.y));
		ctx.moveTo(screen[0].x, screen[0].y);
		for (let i = 1; i < screen.length; i++) {
			ctx.lineTo(screen[i].x, screen[i].y);
		}
		ctx.closePath();
	}
	ctx.fillStyle = fillColor;
	ctx.fill('nonzero');

	// ---- Stroke pass: only exterior edges ----
	ctx.strokeStyle = strokeColor;
	ctx.lineWidth = lineWidth;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	for (let wi = 0; wi < walls.length; wi++) {
		const corners = allCorners[wi];

		// Other walls' corners for clipping
		const otherCorners = [];
		for (let oi = 0; oi < walls.length; oi++) {
			if (oi === wi) continue;
			otherCorners.push(allCorners[oi]);
		}

		// Check each of the 4 edges
		for (let ei = 0; ei < 4; ei++) {
			const edgeStart = corners[ei];
			const edgeEnd = corners[(ei + 1) % 4];

			const exteriorSegments = getExteriorSegments(edgeStart, edgeEnd, otherCorners);

			for (const [tStart, tEnd] of exteriorSegments) {
				// Skip very tiny segments
				if (tEnd - tStart < 0.001) continue;

				const x1 = edgeStart.x + tStart * (edgeEnd.x - edgeStart.x);
				const y1 = edgeStart.y + tStart * (edgeEnd.y - edgeStart.y);
				const x2 = edgeStart.x + tEnd * (edgeEnd.x - edgeStart.x);
				const y2 = edgeStart.y + tEnd * (edgeEnd.y - edgeStart.y);

				const s1 = renderer.toScreen(x1, y1);
				const s2 = renderer.toScreen(x2, y2);

				ctx.beginPath();
				ctx.moveTo(s1.x, s1.y);
				ctx.lineTo(s2.x, s2.y);
				ctx.stroke();
			}
		}
	}
}
