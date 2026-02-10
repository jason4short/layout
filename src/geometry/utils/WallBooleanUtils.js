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

// Small inward inset used for half-plane tests so boundary-coincident edges
// are treated as exterior (not clipped) unless there is real overlap.
const EPSILON = 0.05;
const BROADPHASE_CELL_SIZE = 1000;

function getBoundsFromCorners(corners) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const c of corners) {
		if (c.x < minX) minX = c.x;
		if (c.y < minY) minY = c.y;
		if (c.x > maxX) maxX = c.x;
		if (c.y > maxY) maxY = c.y;
	}
	return { minX, minY, maxX, maxY };
}

function boundsOverlap(a, b) {
	return !(
		a.maxX < b.minX ||
		a.minX > b.maxX ||
		a.maxY < b.minY ||
		a.minY > b.maxY
	);
}

function segmentMayTouchBounds(segStart, segEnd, bounds) {
	const segMinX = Math.min(segStart.x, segEnd.x);
	const segMaxX = Math.max(segStart.x, segEnd.x);
	const segMinY = Math.min(segStart.y, segEnd.y);
	const segMaxY = Math.max(segStart.y, segEnd.y);
	return !(
		segMaxX < bounds.minX ||
		segMinX > bounds.maxX ||
		segMaxY < bounds.minY ||
		segMinY > bounds.maxY
	);
}

function getCellSpan(bounds, cellSize) {
	return {
		minX: Math.floor(bounds.minX / cellSize),
		maxX: Math.floor(bounds.maxX / cellSize),
		minY: Math.floor(bounds.minY / cellSize),
		maxY: Math.floor(bounds.maxY / cellSize)
	};
}

function buildBoundsGrid(boundsArray, cellSize) {
	const grid = new Map();
	for (let i = 0; i < boundsArray.length; i++) {
		const span = getCellSpan(boundsArray[i], cellSize);
		for (let cx = span.minX; cx <= span.maxX; cx++) {
			for (let cy = span.minY; cy <= span.maxY; cy++) {
				const key = `${cx},${cy}`;
				let bucket = grid.get(key);
				if (!bucket) {
					bucket = [];
					grid.set(key, bucket);
				}
				bucket.push(i);
			}
		}
	}
	return grid;
}

function getCandidateIndices(bounds, grid, cellSize) {
	const span = getCellSpan(bounds, cellSize);
	const out = new Set();
	for (let cx = span.minX; cx <= span.maxX; cx++) {
		for (let cy = span.minY; cy <= span.maxY; cy++) {
			const key = `${cx},${cy}`;
			const bucket = grid.get(key);
			if (!bucket) continue;
			for (const idx of bucket) out.add(idx);
		}
	}
	return out;
}

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
		let nx = -ey;
		let ny = ex;

		// Check that the normal points inward by testing against another vertex
		const ref = polyCorners[(i + 2) % n];
		const toRef = { x: ref.x - c1.x, y: ref.y - c1.y };
		if (nx * toRef.x + ny * toRef.y < 0) {
			nx = -nx;
			ny = -ny;
		}

		// Apply epsilon inset to the clipping plane so pure boundary contact
		// (especially parallel/coincident edges) does not count as interior.
		const nLen = Math.sqrt(nx * nx + ny * ny);
		if (nLen === 0) continue;
		const insetX = (nx / nLen) * EPSILON;
		const insetY = (ny / nLen) * EPSILON;

		// Vector from inset edge point to segment start
		const wx = segStart.x - (c1.x + insetX);
		const wy = segStart.y - (c1.y + insetY);

		const denom = nx * dx + ny * dy;
		const numer = nx * wx + ny * wy;

		if (Math.abs(denom) < 1e-10) {
			// Segment is parallel to this edge
			if (numer < 0) {
				return null;
			}
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
	const allBounds = allCorners.map(getBoundsFromCorners);
	const boundsGrid = buildBoundsGrid(allBounds, BROADPHASE_CELL_SIZE);

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
		const wallBounds = allBounds[wi];

		// Broadphase: only walls with overlapping AABBs can clip this wall.
		const overlapCandidates = [];
		const candidateIndices = getCandidateIndices(wallBounds, boundsGrid, BROADPHASE_CELL_SIZE);
		for (const oi of candidateIndices) {
			if (oi === wi) continue;
			if (!boundsOverlap(wallBounds, allBounds[oi])) continue;
			overlapCandidates.push(oi);
		}

		if (overlapCandidates.length === 0) {
			// Fast path: no possible overlap, all 4 edges are fully exterior.
			for (let ei = 0; ei < 4; ei++) {
				const edgeStart = corners[ei];
				const edgeEnd = corners[(ei + 1) % 4];
				const s1 = renderer.toScreen(edgeStart.x, edgeStart.y);
				const s2 = renderer.toScreen(edgeEnd.x, edgeEnd.y);
				const sdx = s2.x - s1.x;
				const sdy = s2.y - s1.y;
				if (sdx * sdx + sdy * sdy < 4) continue;
				ctx.beginPath();
				ctx.moveTo(s1.x, s1.y);
				ctx.lineTo(s2.x, s2.y);
				ctx.stroke();
			}
			continue;
		}

		// Check each of the 4 edges
		for (let ei = 0; ei < 4; ei++) {
			const edgeStart = corners[ei];
			const edgeEnd = corners[(ei + 1) % 4];
			const edgeCandidates = [];
			for (const ci of overlapCandidates) {
				if (segmentMayTouchBounds(edgeStart, edgeEnd, allBounds[ci])) {
					edgeCandidates.push(allCorners[ci]);
				}
			}

			const exteriorSegments = getExteriorSegments(edgeStart, edgeEnd, edgeCandidates);

			for (const [tStart, tEnd] of exteriorSegments) {
				const x1 = edgeStart.x + tStart * (edgeEnd.x - edgeStart.x);
				const y1 = edgeStart.y + tStart * (edgeEnd.y - edgeStart.y);
				const x2 = edgeStart.x + tEnd * (edgeEnd.x - edgeStart.x);
				const y2 = edgeStart.y + tEnd * (edgeEnd.y - edgeStart.y);

				const s1 = renderer.toScreen(x1, y1);
				const s2 = renderer.toScreen(x2, y2);

				// Skip segments shorter than 2px on screen
				const sdx = s2.x - s1.x;
				const sdy = s2.y - s1.y;
				if (sdx * sdx + sdy * sdy < 4) continue;

				ctx.beginPath();
				ctx.moveTo(s1.x, s1.y);
				ctx.lineTo(s2.x, s2.y);
				ctx.stroke();
			}
		}
	}
}
