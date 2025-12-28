import stage from '../core/Stage.js';
import data from '../data/Data.js';

// IntersectionManager.js

/**
 * IntersectionManager
 * ------------------
 * Maintains an incremental index of pairwise intersections between shapes.
 * - Reuses your Rectangle class for bounds and overlap checks.
 * - Accepts a getShapeBounds callback to adapt your shape objects to an AABB.
 * - Optionally subscribes to your Data store for add/update/remove.
 *
 * Required per-shape properties for intersection math:
 *  - type: "lineSegment" | "circle" | ... (extend as needed)
 *  - For line segments: { ax, ay, bx, by }
 *  - For circles: { cx, cy, r }
 *
 * Public API:
 *  - getAllIntersectionSnapPoints(): Array<{ x, y, source: { a, b } }>
 *  - addShape(shape), updateShape(shape), removeShape(shapeId)  (used if not auto-wired)
 */

export class SpatialGrid {

	constructor(gridCellSize = 128, mergeTolerance = 1e-6)
	{
		this.spatialGrid 			= new Map();		// pairKey `${x},${y}`;
		this.intersectionsByPair 	= new Map();		// pairKey -> Array<{x:number, y:number}>

		this.gridW		 		= Math.floor(Math.sqrt(gridCellSize));

		this.gridCellSize 		= this.gridW * this.gridW;
		this.mergeTolerance 	= mergeTolerance;
	}

	// Add a shape and compute its intersections with nearby shapes
	addShape(shape) {
		this.insertIntoSpatialGrid(shape);
		//this.recomputePairsForShape(shape.id);
	}

	// Update a shape and recompute only affected pairs
	updateShape(shape) {
		this.removeFromSpatialGrid(shape);
		this.insertIntoSpatialGrid(shape);

		this.deletePairsInvolving(shape);
		this.recomputePairsForShape(shape.id);
	}

	// Remove a shape and clear any intersections that mention it
	removeShape(shape) {
// 		if(!this.shapesById.has(shapeId)) return;
		
		this.removeFromSpatialGrid(shape);
// 		this.shapesById.delete(shapeId);
		this.deletePairsInvolving(shape);
	}


	// Get a de-duplicated array of intersection snap points.
	getAllIntersectionSnapPoints() {
		const uniqueByKey = new Map();
		for(const [pairKey, points] of this.intersectionsByPair.entries()) {
			const [a, b] = pairKey.split('|');
			for(const point of points) {
				const key = this.makePointKey(point.x, point.y);
				if(!uniqueByKey.has(key)) {
					uniqueByKey.set(key, { x: point.x, y: point.y, source: { a, b } });
				}
			}
		}
		return Array.from(uniqueByKey.values());
	}






	// ----------------- Private helpers: spatial hashing -----------------

	// Insert a shape into the spatial grid.
	insertIntoSpatialGrid(shape) {
	
		// Convert the bounding box corners into grid indices
		const x0 = this.gridIndex(shape.bounds.x);
		const y0 = this.gridIndex(shape.bounds.y);
		const x1 = this.gridIndex(shape.bounds.x + shape.bounds.width);
		const y1 = this.gridIndex(shape.bounds.y + shape.bounds.height);
	
		// Loop through all grid cells covered by the bounding box
		for (let x = x0; x <= x1; x++) {
			for (let y = y0; y <= y1; y++) {

				// Create a unique key for this cell, e.g. "2,5"
				const key = this.gridKey(x, y);
	
				// Look up the set of shapes already in this cell
				let shapes = this.spatialGrid.get(key);
	
				// If no set exists yet for this cell, create one and store it
				if (!shapes) {
					shapes = new Set();
					this.spatialGrid.set(key, shapes);
				}
				shapes.add(shape);
			}
		}
	}
	
	
	/**
	 * Returns the IDs of shapes that share at least one spatial grid cell
	 * @returns {Set<string>} Unique neighbor shape IDs
	 */
	 // why send shapeId just to get the shape - 
	getNeighbors(shape)
	{
		// Allocate a Set to hold unique neighbor IDs.
		const neighbors = new Set();
	
		// Read the shape's axis-aligned bounds and convert the corners to grid indices.
		const x0 = this.gridIndex(shape.bounds.x);
		const y0 = this.gridIndex(shape.bounds.y);
		const x1 = this.gridIndex(shape.bounds.x + shape.bounds.width);
		const y1 = this.gridIndex(shape.bounds.y + shape.bounds.height);
	
		// For every grid cell overlapped by the bounds, merge the resident IDs into neighbors.
		for (let x = x0; x <= x1; x++) {
			for (let y = y0; y <= y1; y++) {

				// Compute the cell key and get the Set of IDs stored for that cell.
				const key = this.gridKey(x, y);
				const shapes = this.spatialGrid.get(key);

				// Empty cells are skipped quickly.
				if(!shapes) continue;
	
				// Add every other shape ID in the cell; skip the original shape.
				for(const id of shapes){
					if(id !== shape.id) neighbors.add(otherId);
				}
			}
		}
	
		// Return the unique neighbor IDs discovered across all overlapped cells.
		return neighbors;
	}
	
	removeFromSpatialGrid(shape)
	{
		for(const shapes of this.spatialGrid.values()){
			if(shapes.has(shape.id))
				shapes.delete(shape.id);
		}
	}

	gridIndex(value)
	{
		// flip to int and bitwise to get 64 or 128 cells
		return Math.floor(value / this.gridCellSize);
	}

	gridKey(x, y) {
		return `${x},${y}`;
	}



	// ----------------- Private helpers: pair bookkeeping -----------------

	pairKey(aId, bId) {
		return (aId < bId) ? `${aId}|${bId}` : `${bId}|${aId}`;
	}

	deletePairsInvolving(shape) {
		for(const key of Array.from(this.intersectionsByPair.keys())){
			if(key.startsWith(shape.id + '|') || key.endsWith('|' + shape.id)) {
				this.intersectionsByPair.delete(key);
			}
		}
	}

	// xxx
	recomputePairsForShape(shape) {

		const neighbors = this.getNeighbors(shape);
		
		for(const otherId of neighbors){
			// checks if ID is in use by a shape 
			// XXX need workaround for this
			const other = this.shapesById.get(otherId);
			if(!other) continue;

			// Use your Rectangle-based overlap (via adapter) to cheap-reject non-overlapping pairs
			//const a = this.getShapeBounds(shape);
			//const b = this.getShapeBounds(other);
			//if(!aabbIntersects(a, b)) continue;
			// XXX arrrrrg
			
			if(!shape.intersects(other)) continue;
			
			const pairKey 	= this.pairKey(shape.id, other.id);
			const points 	= computeIntersections(shape, other, this.mergeTolerance);

			if(points.length > 0) {
				this.intersectionsByPair.set(pairKey, points);
			} else {
				this.intersectionsByPair.delete(pairKey);
			}
		}
	}

	// ----------------- Private helpers: stable rounding key -----------------

	makePointKey(x, y) {
		const qx = Math.round(x / this.mergeTolerance);
		const qy = Math.round(y / this.mergeTolerance);
		return `${qx}:${qy}`;
	}
}