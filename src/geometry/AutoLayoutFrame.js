import { Shape, Geometry } from './Geometry.js';
import { Point } from './Point.js';
import * as VectorUtils from './utils/VectorUtils.js';
import data from '../data/Data.js';

/**
 * AutoLayoutFrame - A rectangle representing the bounds of an auto-layout group.
 *
 * This is actual geometry that can be snapped to, but is owned by a group.
 * It cannot be deleted independently - it's created/removed when autoLayout is toggled.
 *
 * POIs: 0-3 = corners (tl, tr, br, bl), 4-7 = edge midpoints (top, right, bottom, left)
 */
export class AutoLayoutFrame extends Geometry {
	constructor(params) {
		super();
		this.type = Shape.PLAIN;
		this.geometry = Shape.AUTO_LAYOUT_FRAME;

		// params: [ownerGroupId]
		// Note: we use ownerGroupId instead of groupId to avoid being counted
		// as a member of the group when getGroupShapes() is called
		this.ownerGroupId = params[0];

		// Frame doesn't have its own control points - resize via group handles
		this.showHandlesWhenSelected = false;

		// Can't be deleted independently
		this.locked = true;

		this.update();
	}

	update() {
		// Get bounds from the group
		const bounds = data.getAutoLayoutBounds(this.ownerGroupId);
		if (!bounds) {
			this.bounds.x = 0;
			this.bounds.y = 0;
			this.bounds.width = 0;
			this.bounds.height = 0;
			return;
		}

		this.bounds.x = bounds.x;
		this.bounds.y = bounds.y;
		this.bounds.width = bounds.width;
		this.bounds.height = bounds.height;
	}

	// Get the 4 corners
	getCorners() {
		const b = this.bounds;
		return [
			{ x: b.x, y: b.y },                         // top-left
			{ x: b.x + b.width, y: b.y },               // top-right
			{ x: b.x + b.width, y: b.y + b.height },    // bottom-right
			{ x: b.x, y: b.y + b.height }               // bottom-left
		];
	}

	// Get the 4 edge midpoints
	getEdgeMidpoints() {
		const b = this.bounds;
		return [
			{ x: b.x + b.width / 2, y: b.y },                   // top
			{ x: b.x + b.width, y: b.y + b.height / 2 },        // right
			{ x: b.x + b.width / 2, y: b.y + b.height },        // bottom
			{ x: b.x, y: b.y + b.height / 2 }                   // left
		];
	}

	// Snap POIs: 4 corners + 4 edge midpoints
	// Always refresh bounds first to stay in sync with group
	getSnapPOIs() {
		this.update();
		const corners = this.getCorners();
		const midpoints = this.getEdgeMidpoints();
		return [...corners, ...midpoints];
	}

	// No selectable control points - resize via group handles
	getSelectableIndices() {
		return [];
	}

	// Geometry snapping - snap to the 4 edges
	// Always refresh bounds first to stay in sync with group
	getGeoSnap(mouse, mouseRect, pixelTolerance) {
		this.update();
		if (!this.bounds.intersects(mouseRect)) {
			return null;
		}

		const corners = this.getCorners();
		let closestPoint = null;
		let closestDistance = Infinity;

		// Check each of the 4 edges
		const edges = [
			[corners[0], corners[1]], // top
			[corners[1], corners[2]], // right
			[corners[2], corners[3]], // bottom
			[corners[3], corners[0]]  // left
		];

		for (const [p1, p2] of edges) {
			const closest = VectorUtils.closestPointOnSegment(mouse, p1, p2);
			const dist = VectorUtils.distance(mouse, closest);

			if (dist < closestDistance && dist <= pixelTolerance) {
				closestDistance = dist;
				closestPoint = new Point(closest.x, closest.y);
				closestPoint.distance = dist;
			}
		}

		return closestPoint;
	}

	// Perimeter length
	length() {
		return 2 * (this.bounds.width + this.bounds.height);
	}

	// Cannot translate the frame directly - it follows the group
	translate(dx, dy) {
		// No-op - frame position is determined by group bounds
	}

	// Cannot scale the frame directly
	scale(anchorX, anchorY, factor) {
		// No-op
	}

	// Cannot rotate the frame directly
	rotate(anchorX, anchorY, angleRad) {
		// No-op
	}

	// Cannot update control points directly
	updateControlPoint(index, newX, newY) {
		// No-op
	}

	clone() {
		// Cloning creates a new frame for the same group
		const f = new AutoLayoutFrame([this.ownerGroupId]);
		f.type = this.type;
		f.penStyle = this.penStyle;
		f.colorToken = this.colorToken;
		return f;
	}

	toJSON() {
		return {
			geometry: Shape.AUTO_LAYOUT_FRAME,
			ownerGroupId: this.ownerGroupId,
			penStyle: this.penStyle,
			colorToken: this.colorToken
		};
	}

	static fromJSON(json) {
		// Support both old 'groupId' and new 'ownerGroupId' for backwards compatibility
		const frame = new AutoLayoutFrame([json.ownerGroupId || json.groupId]);
		if (json.penStyle !== undefined) frame.penStyle = json.penStyle;
		if (json.colorToken !== undefined) frame.colorToken = json.colorToken;
		return frame;
	}

	draw(ctx, renderer) {
		// Always refresh bounds to stay in sync with group
		this.update();

		const b = this.bounds;
		if (b.width <= 0 || b.height <= 0) return;

		// Check if the group is selected (Renderer draws blue frame when selected)
		const group = data.groups.get(this.ownerGroupId);
		if (!group) return;

		// Get shapes in this group to check selection
		const groupShapes = data.getGroupShapes(this.ownerGroupId);
		const isSelected = groupShapes.some(s => s.selected);

		// Only draw faint grey when NOT selected (Renderer handles selected state)
		if (!isSelected) {
			const topLeft = renderer.toScreen(b.x, b.y);
			const width = renderer.toScreenScale(b.width);
			const height = renderer.toScreenScale(b.height);

			ctx.strokeStyle = '#cccccc';  // Faint grey
			ctx.lineWidth = 1;
			ctx.setLineDash([]);
			ctx.strokeRect(topLeft.x, topLeft.y, width, height);
		}
	}
}
