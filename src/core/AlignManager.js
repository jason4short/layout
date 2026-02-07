/**
 * AlignManager - static utility methods for align/distribute operations.
 * Each method takes an array of shapes and returns an array of { shape, dx, dy } deltas.
 * Groups are treated as single units — all shapes in a group move together by the same delta.
 */

import data from '../data/Data.js';

export default class AlignManager {

	/**
	 * Collapse selected shapes into units. Each unit is either:
	 * - A group (all its shapes move together, bounding box from group bounds)
	 * - A single ungrouped shape
	 * Returns array of { bounds, shapes[] }
	 */
	static _getUnits(shapes) {
		const groupMap = new Map(); // groupId -> shapes[]
		const ungrouped = [];

		for (const s of shapes) {
			const rootId = s.groupId ? data.getRootGroupId(s.groupId) : null;
			if (rootId) {
				if (!groupMap.has(rootId)) groupMap.set(rootId, []);
				groupMap.get(rootId).push(s);
			} else {
				ungrouped.push(s);
			}
		}

		const units = [];

		for (const [groupId, groupShapes] of groupMap) {
			const b = data.getGroupBounds(groupId);
			units.push({ bounds: b, shapes: groupShapes });
		}

		for (const s of ungrouped) {
			units.push({ bounds: s.bounds, shapes: [s] });
		}

		return units;
	}

	/** Expand unit deltas into per-shape deltas */
	static _expandDeltas(units, getDelta) {
		const result = [];
		for (const unit of units) {
			const { dx, dy } = getDelta(unit);
			for (const shape of unit.shapes) {
				result.push({ shape, dx, dy });
			}
		}
		return result;
	}

	// --- Align ---

	static alignLeft(shapes) {
		const units = this._getUnits(shapes);
		const minX = Math.min(...units.map(u => u.bounds.x));
		return this._expandDeltas(units, u => ({ dx: minX - u.bounds.x, dy: 0 }));
	}

	static alignCenter(shapes) {
		const units = this._getUnits(shapes);
		const minX = Math.min(...units.map(u => u.bounds.x));
		const maxX = Math.max(...units.map(u => u.bounds.x + u.bounds.width));
		const centerX = (minX + maxX) / 2;
		return this._expandDeltas(units, u => ({
			dx: centerX - (u.bounds.x + u.bounds.width / 2),
			dy: 0
		}));
	}

	static alignRight(shapes) {
		const units = this._getUnits(shapes);
		const maxX = Math.max(...units.map(u => u.bounds.x + u.bounds.width));
		return this._expandDeltas(units, u => ({
			dx: maxX - (u.bounds.x + u.bounds.width),
			dy: 0
		}));
	}

	static alignTop(shapes) {
		const units = this._getUnits(shapes);
		const minY = Math.min(...units.map(u => u.bounds.y));
		return this._expandDeltas(units, u => ({ dx: 0, dy: minY - u.bounds.y }));
	}

	static alignMiddle(shapes) {
		const units = this._getUnits(shapes);
		const minY = Math.min(...units.map(u => u.bounds.y));
		const maxY = Math.max(...units.map(u => u.bounds.y + u.bounds.height));
		const centerY = (minY + maxY) / 2;
		return this._expandDeltas(units, u => ({
			dx: 0,
			dy: centerY - (u.bounds.y + u.bounds.height / 2)
		}));
	}

	static alignBottom(shapes) {
		const units = this._getUnits(shapes);
		const maxY = Math.max(...units.map(u => u.bounds.y + u.bounds.height));
		return this._expandDeltas(units, u => ({
			dx: 0,
			dy: maxY - (u.bounds.y + u.bounds.height)
		}));
	}

	// --- Distribute ---

	static distributeHorizontal(shapes, offset = 0) {
		const units = this._getUnits(shapes);
		if (units.length < 2) return shapes.map(s => ({ shape: s, dx: 0, dy: 0 }));

		// Sort units by left edge
		units.sort((a, b) => a.bounds.x - b.bounds.x);
		const first = units[0];

		if (offset > 0) {
			let currentX = first.bounds.x;
			return this._expandUnitsSequential(units, u => {
				const dx = currentX - u.bounds.x;
				currentX += offset;
				return { dx, dy: 0 };
			});
		}

		// Even distribution
		if (units.length < 3) return shapes.map(s => ({ shape: s, dx: 0, dy: 0 }));
		const last = units[units.length - 1];
		const totalWidth = units.reduce((sum, u) => sum + u.bounds.width, 0);
		const totalSpan = (last.bounds.x + last.bounds.width) - first.bounds.x;
		const gap = (totalSpan - totalWidth) / (units.length - 1);

		let currentX = first.bounds.x;
		return this._expandUnitsSequential(units, u => {
			const dx = currentX - u.bounds.x;
			currentX += u.bounds.width + gap;
			return { dx, dy: 0 };
		});
	}

	static distributeVertical(shapes, offset = 0) {
		const units = this._getUnits(shapes);
		if (units.length < 2) return shapes.map(s => ({ shape: s, dx: 0, dy: 0 }));

		// Sort units by top edge
		units.sort((a, b) => a.bounds.y - b.bounds.y);
		const first = units[0];

		if (offset > 0) {
			let currentY = first.bounds.y;
			return this._expandUnitsSequential(units, u => {
				const dy = currentY - u.bounds.y;
				currentY += offset;
				return { dx: 0, dy };
			});
		}

		// Even distribution
		if (units.length < 3) return shapes.map(s => ({ shape: s, dx: 0, dy: 0 }));
		const last = units[units.length - 1];
		const totalHeight = units.reduce((sum, u) => sum + u.bounds.height, 0);
		const totalSpan = (last.bounds.y + last.bounds.height) - first.bounds.y;
		const gap = (totalSpan - totalHeight) / (units.length - 1);

		let currentY = first.bounds.y;
		return this._expandUnitsSequential(units, u => {
			const dy = currentY - u.bounds.y;
			currentY += u.bounds.height + gap;
			return { dx: 0, dy };
		});
	}

	/** Like _expandDeltas but calls getDelta sequentially (for stateful closures) */
	static _expandUnitsSequential(units, getDelta) {
		const result = [];
		for (const unit of units) {
			const { dx, dy } = getDelta(unit);
			for (const shape of unit.shapes) {
				result.push({ shape, dx, dy });
			}
		}
		return result;
	}
}
