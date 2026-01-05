/**
 * SpatialGrid - Spatial indexing for fast neighbor queries
 *
 * Uses a grid-based spatial hash to find shapes that might intersect.
 * Reduces intersection checks from O(n²) to O(n × k) where k is average neighbors.
 */

export class SpatialGrid {

	constructor(gridCellSize = 100) {
		// Grid cell size in world units
		this.gridCellSize = gridCellSize;

		// Map: gridKey → Set<shape>
		this.grid = new Map();

		// Map: shape → Set<gridKey> (for fast removal)
		this.shapeToKeys = new Map();
	}

	/**
	 * Clear all shapes from the grid
	 */
	clear() {
		this.grid.clear();
		this.shapeToKeys.clear();
	}

	/**
	 * Add a shape to the spatial grid
	 * @param {Object} shape - Shape with bounds property
	 */
	addShape(shape) {
		if (!shape.bounds) return;

		const keys = this.getKeysForBounds(shape.bounds);
		this.shapeToKeys.set(shape, keys);

		for (const key of keys) {
			if (!this.grid.has(key)) {
				this.grid.set(key, new Set());
			}
			this.grid.get(key).add(shape);
		}
	}

	/**
	 * Remove a shape from the spatial grid
	 * @param {Object} shape - Shape to remove
	 */
	removeShape(shape) {
		const keys = this.shapeToKeys.get(shape);
		if (!keys) return;

		for (const key of keys) {
			const cell = this.grid.get(key);
			if (cell) {
				cell.delete(shape);
				// Clean up empty cells
				if (cell.size === 0) {
					this.grid.delete(key);
				}
			}
		}

		this.shapeToKeys.delete(shape);
	}

	/**
	 * Update a shape's position in the grid (after transform)
	 * @param {Object} shape - Shape that moved
	 */
	updateShape(shape) {
		this.removeShape(shape);
		this.addShape(shape);
	}

	/**
	 * Get all shapes that might intersect with the given shape
	 * @param {Object} shape - Shape to find neighbors for
	 * @returns {Set<Object>} Set of potential neighbor shapes (excluding self)
	 */
	getNeighbors(shape) {
		const neighbors = new Set();

		if (!shape.bounds) return neighbors;

		const keys = this.getKeysForBounds(shape.bounds);

		for (const key of keys) {
			const cell = this.grid.get(key);
			if (!cell) continue;

			for (const other of cell) {
				if (other !== shape) {
					neighbors.add(other);
				}
			}
		}

		return neighbors;
	}

	/**
	 * Get all shapes within a world-space rectangle
	 * @param {Object} rect - Rectangle with x, y, width, height
	 * @returns {Set<Object>} Set of shapes in the region
	 */
	queryRect(rect) {
		const results = new Set();
		const keys = this.getKeysForBounds(rect);

		for (const key of keys) {
			const cell = this.grid.get(key);
			if (!cell) continue;

			for (const shape of cell) {
				// Double-check bounds intersection for accuracy
				if (shape.bounds && this.boundsIntersect(shape.bounds, rect)) {
					results.add(shape);
				}
			}
		}

		return results;
	}

	/**
	 * Get all shapes within radius of a point
	 * @param {Object} point - Point with x, y
	 * @param {number} radius - Search radius in world units
	 * @returns {Set<Object>} Set of shapes in range
	 */
	queryRadius(point, radius) {
		const rect = {
			x: point.x - radius,
			y: point.y - radius,
			width: radius * 2,
			height: radius * 2
		};
		return this.queryRect(rect);
	}

	// ==================== Private Helpers ====================

	/**
	 * Get grid cell keys that a bounding box overlaps
	 * @private
	 */
	getKeysForBounds(bounds) {
		const keys = new Set();

		// Validate bounds - skip if invalid
		if (!isFinite(bounds.x) || !isFinite(bounds.y) ||
			!isFinite(bounds.width) || !isFinite(bounds.height)) {
			console.warn('SpatialGrid: Invalid bounds', bounds);
			return keys;
		}

		const x0 = Math.floor(bounds.x / this.gridCellSize);
		const y0 = Math.floor(bounds.y / this.gridCellSize);
		const x1 = Math.floor((bounds.x + bounds.width) / this.gridCellSize);
		const y1 = Math.floor((bounds.y + bounds.height) / this.gridCellSize);

		// Limit cells to prevent memory issues with huge shapes
		const maxCells = 10000;
		const cellCount = (x1 - x0 + 1) * (y1 - y0 + 1);
		if (cellCount > maxCells) {
			console.warn('SpatialGrid: Bounds too large, skipping', bounds);
			return keys;
		}

		for (let x = x0; x <= x1; x++) {
			for (let y = y0; y <= y1; y++) {
				keys.add(`${x},${y}`);
			}
		}

		return keys;
	}

	/**
	 * Check if two rectangles intersect
	 * @private
	 */
	boundsIntersect(a, b) {
		return !(
			a.x + a.width < b.x ||
			b.x + b.width < a.x ||
			a.y + a.height < b.y ||
			b.y + b.height < a.y
		);
	}

	// ==================== Debug Helpers ====================

	/**
	 * Get stats about the grid
	 */
	getStats() {
		let totalShapes = 0;
		let maxPerCell = 0;

		for (const cell of this.grid.values()) {
			totalShapes += cell.size;
			maxPerCell = Math.max(maxPerCell, cell.size);
		}

		return {
			cellCount: this.grid.size,
			shapeCount: this.shapeToKeys.size,
			avgShapesPerCell: this.grid.size > 0 ? totalShapes / this.grid.size : 0,
			maxShapesPerCell: maxPerCell,
			cellSize: this.gridCellSize
		};
	}
}
