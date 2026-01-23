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

	if (mode === 'row') {
		return calculateRowLayout(sorted, groupBounds, gap, alignment, distribution);
	} else if (mode === 'column') {
		return calculateColumnLayout(sorted, groupBounds, gap, alignment, distribution);
	}

	return [];
}

/**
 * Calculate horizontal (row) layout positions
 */
function calculateRowLayout(items, bounds, gap, alignment, distribution) {
	// Calculate total width of all items
	const totalItemWidth = items.reduce((sum, item) => sum + item.bounds.width, 0);

	// Calculate x positions based on distribution
	const positions = [];

	if (distribution === 'space-between' && items.length > 1) {
		// Distribute evenly with items at edges
		const totalGap = bounds.width - totalItemWidth;
		const gapSize = totalGap / (items.length - 1);
		let x = bounds.x;
		for (const item of items) {
			positions.push({ item, x });
			x += item.bounds.width + gapSize;
		}
	} else if (distribution === 'space-around') {
		// Equal space around each item
		const totalGap = bounds.width - totalItemWidth;
		const gapSize = totalGap / (items.length + 1);
		let x = bounds.x + gapSize;
		for (const item of items) {
			positions.push({ item, x });
			x += item.bounds.width + gapSize;
		}
	} else {
		// Fixed gap - pack from start
		let x = bounds.x;
		for (const item of items) {
			positions.push({ item, x });
			x += item.bounds.width + gap;
		}
	}

	// Apply vertical alignment and calculate deltas
	return positions.map(({ item, x }) => {
		let y;
		if (alignment === 'start') {
			y = bounds.y;
		} else if (alignment === 'center') {
			y = bounds.y + (bounds.height - item.bounds.height) / 2;
		} else { // end
			y = bounds.y + bounds.height - item.bounds.height;
		}

		// Calculate delta from current position
		const dx = x - item.bounds.x;
		const dy = y - item.bounds.y;

		return {
			type: item.type,
			item: item.item,
			dx,
			dy
		};
	});
}

/**
 * Calculate vertical (column) layout positions
 */
function calculateColumnLayout(items, bounds, gap, alignment, distribution) {
	// Calculate total height of all items
	const totalItemHeight = items.reduce((sum, item) => sum + item.bounds.height, 0);

	// Calculate y positions based on distribution
	const positions = [];

	if (distribution === 'space-between' && items.length > 1) {
		// Distribute evenly with items at edges
		const totalGap = bounds.height - totalItemHeight;
		const gapSize = totalGap / (items.length - 1);
		let y = bounds.y;
		for (const item of items) {
			positions.push({ item, y });
			y += item.bounds.height + gapSize;
		}
	} else if (distribution === 'space-around') {
		// Equal space around each item
		const totalGap = bounds.height - totalItemHeight;
		const gapSize = totalGap / (items.length + 1);
		let y = bounds.y + gapSize;
		for (const item of items) {
			positions.push({ item, y });
			y += item.bounds.height + gapSize;
		}
	} else {
		// Fixed gap - pack from start
		let y = bounds.y;
		for (const item of items) {
			positions.push({ item, y });
			y += item.bounds.height + gap;
		}
	}

	// Apply horizontal alignment and calculate deltas
	return positions.map(({ item, y }) => {
		let x;
		if (alignment === 'start') {
			x = bounds.x;
		} else if (alignment === 'center') {
			x = bounds.x + (bounds.width - item.bounds.width) / 2;
		} else { // end
			x = bounds.x + bounds.width - item.bounds.width;
		}

		// Calculate delta from current position
		const dx = x - item.bounds.x;
		const dy = y - item.bounds.y;

		return {
			type: item.type,
			item: item.item,
			dx,
			dy
		};
	});
}
