/**
 * Layout Engine - Pure functions for calculating auto-layout positions
 * Does NOT modify shapes - returns move deltas for caller to apply
 */

/**
 * Calculate new positions for layout items in a group
 * @param {Array} items - Array of { type, item, bounds } from data.getLayoutItems()
 * @param {Object} groupBounds - { x, y, width, height } - current bounds of the group
 * @param {Object} layoutOptions - { mode, gap, alignment, distribution }
 * @returns {Array} - Array of { type, item, dx, dy } - deltas to apply
 */
export function calculateLayout(items, groupBounds, layoutOptions) {
	const { mode, gap, alignment, distribution } = layoutOptions;

	if (mode === 'none' || items.length === 0) {
		return [];
	}

	// Sort items by current position (left-to-right or top-to-bottom)
	const sorted = [...items].sort((a, b) => {
		return mode === 'row'
			? a.bounds.x - b.bounds.x
			: a.bounds.y - b.bounds.y;
	});

	if (mode === 'row' || mode === 'column') {
		return calculateLinearLayout(sorted, groupBounds, gap, alignment, distribution, mode === 'row');
	}

	return [];
}

/**
 * Calculate linear layout positions (row or column)
 * @param {Array} items - Sorted array of layout items
 * @param {Object} bounds - Container bounds
 * @param {number} gap - Fixed gap between items
 * @param {string} alignment - Cross-axis alignment: 'start', 'center', 'end'
 * @param {string} distribution - Primary-axis distribution: 'packed', 'space-between', 'space-around'
 * @param {boolean} isRow - true for row layout, false for column
 */
function calculateLinearLayout(items, bounds, gap, alignment, distribution, isRow) {
	// Configure axes based on layout direction
	// Row: items flow along x, align along y
	// Column: items flow along y, align along x
	const axis = isRow
		? { pos: 'x', size: 'width', crossPos: 'y', crossSize: 'height' }
		: { pos: 'y', size: 'height', crossPos: 'x', crossSize: 'width' };

	// Calculate total size on primary axis
	const totalItemSize = items.reduce((sum, item) => sum + item.bounds[axis.size], 0);

	// Calculate positions along primary axis based on distribution
	const positions = calculatePrimaryPositions(items, bounds, gap, distribution, axis, totalItemSize);

	// Apply cross-axis alignment and calculate deltas
	return positions.map(({ item, primaryPos }) => {
		const crossPos = calculateCrossPosition(item, bounds, alignment, axis);

		// Map back to x/y deltas
		const newX = isRow ? primaryPos : crossPos;
		const newY = isRow ? crossPos : primaryPos;

		return {
			type: item.type,
			item: item.item,
			dx: newX - item.bounds.x,
			dy: newY - item.bounds.y
		};
	});
}

/**
 * Calculate positions along the primary axis based on distribution mode
 */
function calculatePrimaryPositions(items, bounds, gap, distribution, axis, totalItemSize) {
	const positions = [];
	let pos = bounds[axis.pos];

	if (distribution === 'space-between' && items.length > 1) {
		// Distribute evenly with items at edges
		const totalGap = bounds[axis.size] - totalItemSize;
		const gapSize = totalGap / (items.length - 1);

		for (const item of items) {
			positions.push({ item, primaryPos: pos });
			pos += item.bounds[axis.size] + gapSize;
		}
	} else if (distribution === 'space-around') {
		// Equal space around each item
		const totalGap = bounds[axis.size] - totalItemSize;
		const gapSize = totalGap / (items.length + 1);
		pos += gapSize;

		for (const item of items) {
			positions.push({ item, primaryPos: pos });
			pos += item.bounds[axis.size] + gapSize;
		}
	} else {
		// Fixed gap - pack from start
		for (const item of items) {
			positions.push({ item, primaryPos: pos });
			pos += item.bounds[axis.size] + gap;
		}
	}

	return positions;
}

/**
 * Calculate position on the cross axis based on alignment
 */
function calculateCrossPosition(item, bounds, alignment, axis) {
	if (alignment === 'start') {
		return bounds[axis.crossPos];
	}
	if (alignment === 'center') {
		return bounds[axis.crossPos] + (bounds[axis.crossSize] - item.bounds[axis.crossSize]) / 2;
	}
	// 'end'
	return bounds[axis.crossPos] + bounds[axis.crossSize] - item.bounds[axis.crossSize];
}
