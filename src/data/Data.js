const MAX_SNAP = 3; // intersections only snap if within 12px on screen

import {Shape} 					from '../geometry/Geometry.js';
import {Point} 					from '../geometry/Point.js';
import {Line} 					from '../geometry/Line.js';
import {Guide} 					from '../geometry/Guide.js';
import {Circle} 				from '../geometry/Circle.js';
import {SnapPoint} 				from '../geometry/SnapPoint.js';
import draftingAssistant 		from '../geometry/DraftingAssistant.js';
import {Intersections} 			from './Intersections.js';
import {Intersection}			from './Intersection.js';
import {SpatialGrid}			from './SpatialGrid.js';

import undoManager				from '../core/UndoManager.js';

import {	AddConstructionCommand,
			DeleteShapesCommand,
			DeleteConstructionsCommand, 
			AddShapeCommand
		} from '../core/Commands.js';


class Data
{
	constructor()
	{
        if (!Data.instance) {
            Data.instance = this;
        }
        // geometry storage
		this.shapes 				= [];
		this.constructions			= [];
		this.guides					= []; // temp constructions, ephemeral, gen on snap points
		//this.shapePreview 			= null; // single preview shape
		this.shapePreviews 			= []; // multiple preview shapes (for scale tool, etc.)

		// store unique snap points in a ring buffer	
		this.snapPoints				= []; // DA snap storage - only geometry points of interest are stored
		this.snapIndex				= 0;
		
        // geometry intersections - new architecture
		this.shapePOIs			 	= []; 			// POIs from shapes (endpoints, centers, etc.)
		this.intersectionSet		= new Set();	// All Intersection objects
		this.intersectionsByShape	= new Map();	// Map<shape, Set<Intersection>> for quick lookup
		this.guideIntersections		= [];			// temp guide intersections (ephemeral)

		// the point under the cursor
		this.snapPoint				= new SnapPoint();

		// A hash of current snap points;
		this.snaps 					= new Map();

		// Selected control points: Map<shape, Set<number>> - shape → POI indices
		this.selectedPoints			= new Map();

		// Shapes to exclude from snapping (during move operations)
		this.excludeFromSnap		= new Set();

		// geometry solver class
		this.intersections			= new Intersections();

		// Spatial grid for fast neighbor queries
		this.spatialGrid			= new SpatialGrid(100); // 100 world units per cell

		// Clipboard for copy/paste
		this.clipboard				= [];

		// Stable shape ID counter
		this._nextShapeId = 1;

		// Groups: Map<groupId, { id, parentId }> - parentId is null for top-level groups
		this.groups					= new Map();
		this._nextGroupId			= 1;

		// Color palette: named color tokens that shapes can reference
		this.colorPalette = {
			tokens: [
				{ id: 'black', name: 'Black', color: '#111111' },
				{ id: 'red', name: 'Red', color: '#CC0000' },
				{ id: 'blue', name: 'Blue', color: '#0066CC' },
				{ id: 'green', name: 'Green', color: '#00AA00' }
			],
			_nextId: 1
		};

		// This is a singleton class
        return Data.instance;
	}

	// Generate a unique ID for each shape
	generateID(){
		return `shape_${this._nextShapeId++}`;
	}

	// --------------------------------------------------------------------------------
	// Intersection Management
	// --------------------------------------------------------------------------------

	// Register an intersection between two shapes
	registerIntersection(shapeA, shapeB, point){
		const intersection = new Intersection(shapeA, shapeB, point);
		this.intersectionSet.add(intersection);

		// Add to lookup map for both shapes
		if(!this.intersectionsByShape.has(shapeA)){
			this.intersectionsByShape.set(shapeA, new Set());
		}
		this.intersectionsByShape.get(shapeA).add(intersection);

		if(!this.intersectionsByShape.has(shapeB)){
			this.intersectionsByShape.set(shapeB, new Set());
		}
		this.intersectionsByShape.get(shapeB).add(intersection);

		return intersection;
	}

	// Find and register all intersections between two shapes
	findAndRegisterIntersections(shapeA, shapeB){
		if(!shapeA.bounds.intersects(shapeB.bounds)){
			return;
		}
		const points = this.intersections.intersect_shapes(shapeA, shapeB);
		if(points && points.length){
			for(const point of points){
				this.registerIntersection(shapeA, shapeB, point);
			}
		}
	}

	// Remove all intersections involving a shape
	removeIntersectionsForShape(shape){
		const shapeIntersections = this.intersectionsByShape.get(shape);
		if(!shapeIntersections) return;

		for(const intersection of shapeIntersections){
			// Remove from the main set
			this.intersectionSet.delete(intersection);

			// Remove from the other shape's lookup
			const otherShape = intersection.shapeA === shape ? intersection.shapeB : intersection.shapeA;
			const otherSet = this.intersectionsByShape.get(otherShape);
			if(otherSet){
				otherSet.delete(intersection);
			}
		}

		// Remove this shape's entry from the map
		this.intersectionsByShape.delete(shape);
	}

	// Recalculate intersections for a shape (after transform like rotate/scale/mirror)
	recalculateIntersectionsForShape(shape){
		// Remove old intersections
		this.removeIntersectionsForShape(shape);

		// Update position in spatial grid
		this.spatialGrid.updateShape(shape);

		// Find new intersections using spatial grid (O(n×k) instead of O(n²))
		const neighbors = this.spatialGrid.getNeighbors(shape);
		for(const neighbor of neighbors){
			this.findAndRegisterIntersections(shape, neighbor);
		}

		// Find new intersections with constructions (not in grid)
		for(const construction of this.constructions){
			this.findAndRegisterIntersections(shape, construction);
		}
	}

	// Recalculate intersections for multiple shapes
	recalculateIntersectionsForShapes(shapes){
		for(const shape of shapes){
			this.recalculateIntersectionsForShape(shape);
		}
	}

	/**
	 * Update any angle dimensions that reference the given shapes.
	 * Call this after shapes (lines) have been edited/moved.
	 */
	updateDependentDimensions(editedShapes){
		const editedSet = new Set(editedShapes);
		for(const shape of this.shapes){
			if(shape.geometry === Shape.ANGLE_DIMENSION){
				// Check if this dimension references any of the edited shapes
				if((shape.line1 && editedSet.has(shape.line1)) ||
				   (shape.line2 && editedSet.has(shape.line2))){
					shape.updateFromLines();
				}
			}
		}
	}

	// --------------------------------------------------------------------------------
	// POI Management
	// --------------------------------------------------------------------------------

	// Rebuild POIs for all shapes (called after shape deletion)
	// Shapes in frames store LOCAL coords - transform to world for snapping
	rebuildPOIs(){
		console.log("rebuildPOIs");
		this.shapePOIs = [];

		for(const shape of this.shapes){
			this.storeShapePOIs(shape);
		}
	}

	// Add POIs for a shape to our cache
	// Shapes in frames store LOCAL coords - transform to world for snapping
	storeShapePOIs(shape){
		console.log("storeShapePOIs");
		const points = shape.getSnapPOIs();

		// Get frame transform if shape belongs to a frame
		const frame = shape.frameId ? this.getFrame(shape.frameId) : null;

		// Add shape reference, index, and transform to world coords if needed
		for(let i = 0; i < points.length; i++){
			let poi = points[i];

			// Transform LOCAL coords to WORLD coords for snapping
			if(frame){
				const worldPt = frame.localToWorld(poi.x, poi.y);
				poi = {
					x: worldPt.x,
					y: worldPt.y,
					type: poi.type
				};
			}

			poi.shape = shape;
			poi.poiIndex = i;
			this.shapePOIs.push(poi);
		}
	}
	
	findIntersections(newShape, intersectionArray){
		// take the new shape and look across all shapes for intersections
		// skip shapes that dont overlap bounds
				
		for(const shape of this.getShapesToIntersect())
		{
			const intersects = newShape.bounds.intersects(shape.bounds);
			
			if(intersects){
				const intersectionPoints = this.intersections.intersect_shapes(newShape, shape);
				
				if(intersectionPoints && intersectionPoints.length){
					intersectionArray.push(...intersectionPoints);
				}					
			}
		}
		//console.log("intersectionArray: "+intersectionArray.length)
	}
	
	
	// see if shape bounds overlap at all
	checkOverlaps(){
		for(let i = 0; i < this.shapes.length; i++){
			for(let j = i + 1; j < this.shapes.length; j++){
				// zip through 
				//if(this.shapes[i] === this.shapes[j]) continue;
				const intersects = this.shapes[i].bounds.intersects(this.shapes[j].bounds);
				//console.log(`${n} intersects ${intersects}`);
				n++;
			}
		}
	}
	
	getSelected(){
		const shapes = this.getShapes();
		let selectedShapes = [];
		for(let i = 0; i < shapes.length; i++){
			if(shapes[i].selected){
				selectedShapes.push(shapes[i]);
			}
		}
		return selectedShapes;
	}

	// Find all intersections between a shape and an array of boundary shapes
	findIntersectionsWithBoundaries(shape, boundaries)
	{
		const intersections = [];
		for (const boundary of boundaries) {
			const points = this.intersections.intersect_shapes(shape, boundary);
			if (points && points.length) {
				intersections.push(...points);
			}
		}
		// returns a array of points
		return intersections;
	}
	
// 	selectShape2(mouse, shiftKey){
// 		// clear selection unless shift is held
// 		if(shiftKey == false){this.selectNone();}
// 
// 		// Filter out locked shapes from selection
// 		const selectableShapes = this.shapes.filter(s => !s.locked);
// 		
// 		let snap = draftingAssistant.findNearestSnapPoint_OnShape(mouse, selectableShapes);
// 
// 		if(snap){
// 			// Toggle selection if shift is held, otherwise select
// 			if(shiftKey){
// 				snap.shape.selected = !snap.shape.selected;
// 			}else{
// 				snap.shape.selected = true;
// 			}
// 			return snap.shape;
// 		}
// 	}
	
	getTargetShape(){
		if(this.snapPoint.shape){
			return this.snapPoint.shape
		}else {
			return null;
		}
	}
	
	
	selectSnapShape(shiftKey){
		if(!this.snapPoint.shape) {
			this.selectNone();
			return;
		}

		const shape = this.snapPoint.shape;
		if(shape.locked || shape.type == Shape.GUIDE) return;

		if(shiftKey){
			// Shift+click: toggle selection
			if(shape.groupId){
				// Toggle entire group
				const rootId = this.getRootGroupId(shape.groupId);
				const groupShapes = this.getGroupShapes(rootId);
				const shouldSelect = !shape.selected;
				for(const s of groupShapes){
					if(!s.locked) s.selected = shouldSelect;
				}
			} else {
				shape.selected = !shape.selected;
			}
		}else{
			this.selectNone();
			if(shape.groupId){
				// Select entire group hierarchy
				this.selectGroup(shape);
			} else {
				shape.selected = true;
			}
		}
	}
		
	selectNone(){
		const shapes = this.getShapes();
		for(let i = 0; i < shapes.length; i++){
			shapes[i].selected = false;
		}
		this.selectedPoints.clear();
	}

	// Toggle control point visibility on a shape (Cmd+click)
	toggleControlPoints(mouse){
		let snap = draftingAssistant.findNearestSnapPoint_OnShape(mouse, this.shapes);
		if(snap && snap.shape){
			snap.shape.showControlPoints = !snap.shape.showControlPoints;
			return snap.shape;
		}
		return null;
	}

	// Toggle control point visibility on a shape (Cmd+click)
	toggleControlPoints(){
		if(this.snapPoint.shape){
			this.snapPoint.shape.showControlPoints = !this.snapPoint.shape.showControlPoints;
		}
	}

	selectAll(){
		for(let i = 0; i < this.shapes.length; i++){
			// Skip locked shapes
			if(!this.shapes[i].locked){
				this.shapes[i].selected = true;
			}
		}
		this.selectedPoints.clear(); // Clear partial selections when selecting all
	}

	// --------------------------------------------------------------------------------
	// Group Management
	// --------------------------------------------------------------------------------

	// Create a new group from selected shapes, returns the group ID
	createGroup(shapes){
		if(!shapes || shapes.length === 0) return null;

		const groupId = `group_${this._nextGroupId++}`;

		// Check if any selected shapes are already in groups - if so, this becomes a parent group
		const childGroupIds = new Set();
		for(const shape of shapes){
			if(shape.groupId){
				childGroupIds.add(shape.groupId);
			}
		}

		// Create the group with layout properties
		this.groups.set(groupId, {
			id: groupId,
			parentId: null,
			layout: {
				mode: 'none',       // 'none' | 'row' | 'column'
				gap: 0,             // spacing between children (mm)
				alignment: 'start', // 'start' | 'center' | 'end'
				distribution: 'none' // 'none' | 'space-between' | 'space-around'
			}
		});

		// If there are child groups, update their parentId
		for(const childId of childGroupIds){
			const childGroup = this.groups.get(childId);
			if(childGroup){
				childGroup.parentId = groupId;
			}
		}

		// Assign ungrouped shapes to this new group
		for(const shape of shapes){
			if(!shape.groupId){
				shape.groupId = groupId;
			}
		}

		return groupId;
	}

	// Ungroup: move shapes up one level (to parent group or ungrouped)
	ungroupSelection(){
		const selected = this.getSelected();
		const groupsToUngroup = new Set();

		// Find all groups that are fully selected
		for(const shape of selected){
			if(shape.groupId){
				groupsToUngroup.add(shape.groupId);
			}
		}

		for(const groupId of groupsToUngroup){
			const group = this.groups.get(groupId);
			if(!group) continue;

			const parentId = group.parentId;

			// Move all shapes in this group to parent (or null)
			for(const shape of this.shapes){
				if(shape.groupId === groupId){
					shape.groupId = parentId;
				}
			}

			// Move child groups to parent
			for(const [id, g] of this.groups){
				if(g.parentId === groupId){
					g.parentId = parentId;
				}
			}

			// Delete the group
			this.groups.delete(groupId);
		}
	}

	// Get all shapes in a group (including nested groups)
	getGroupShapes(groupId){
		const result = [];
		if(!groupId) return result;

		// Get direct members
		for(const shape of this.shapes){
			if(shape.groupId === groupId){
				result.push(shape);
			}
		}

		// Get shapes from child groups (recursively)
		for(const [id, group] of this.groups){
			if(group.parentId === groupId){
				result.push(...this.getGroupShapes(id));
			}
		}

		return result;
	}

	// Get direct children only (shapes whose groupId === groupId, not nested)
	getDirectGroupShapes(groupId){
		if(!groupId) return [];
		return this.shapes.filter(s => s.groupId === groupId);
	}

	// Get child group IDs (direct children groups)
	getChildGroupIds(groupId){
		const childIds = [];
		for(const [id, group] of this.groups){
			if(group.parentId === groupId){
				childIds.push(id);
			}
		}
		return childIds;
	}

	// Compute bounding box of all shapes in group (recursive)
	getGroupBounds(groupId){
		const shapes = this.getGroupShapes(groupId);
		if(shapes.length === 0) return null;

		let minX = Infinity, minY = Infinity;
		let maxX = -Infinity, maxY = -Infinity;

		for(const shape of shapes){
			const b = shape.bounds;
			minX = Math.min(minX, b.x);
			minY = Math.min(minY, b.y);
			maxX = Math.max(maxX, b.x + b.width);
			maxY = Math.max(maxY, b.y + b.height);
		}

		return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
	}

	// Get layout items for a group: direct shapes + child groups as units
	// Returns array of { type: 'shape'|'group', item: shape|groupId, bounds: {...} }
	getLayoutItems(groupId){
		const items = [];

		// Add direct shapes (shapes whose groupId === this groupId)
		const directShapes = this.getDirectGroupShapes(groupId);
		console.log(`getLayoutItems(${groupId}): directShapes =`, directShapes.length);
		for(const shape of directShapes){
			items.push({
				type: 'shape',
				item: shape,
				bounds: { ...shape.bounds }
			});
		}

		// Add child groups as single units
		const childGroupIds = this.getChildGroupIds(groupId);
		console.log(`getLayoutItems(${groupId}): childGroupIds =`, childGroupIds);
		for(const childId of childGroupIds){
			const bounds = this.getGroupBounds(childId);
			if(bounds){
				items.push({
					type: 'group',
					item: childId,
					bounds: bounds
				});
			}
		}

		console.log(`getLayoutItems(${groupId}): total items =`, items.length, items.map(i => i.type));
		return items;
	}

	// Get the root group ID for a shape (walks up parent chain)
	getRootGroupId(groupId){
		if(!groupId) return null;

		const group = this.groups.get(groupId);
		if(!group) return groupId;

		if(group.parentId){
			return this.getRootGroupId(group.parentId);
		}
		return groupId;
	}

	// Select all shapes in the same group hierarchy as the given shape
	selectGroup(shape){
		if(!shape.groupId) return;

		// Find root group
		const rootId = this.getRootGroupId(shape.groupId);

		// Select all shapes in the root group and its descendants
		const groupShapes = this.getGroupShapes(rootId);
		for(const s of groupShapes){
			if(!s.locked){
				s.selected = true;
			}
		}
	}

	// Get the selectedPoints Map
	getSelectedPoints(){
		return this.selectedPoints;
	}

	// Check if a specific point on a shape is selected
	isPointSelected(shape, index){
		if(shape.selected) return true;
		const indices = this.selectedPoints.get(shape);
		return indices ? indices.has(index) : false;
	}

	// Check if there's any selection (shapes or points)
	hasSelection(){
		return this.getSelected().length > 0 || this.selectedPoints.size > 0;
	}

	// Get selectable POI indices for a shape (endpoints only, no midpoints/quadrants)
	getSelectableIndices(shape){
		switch(shape.geometry){
			case Shape.LINE:
				return [0, 1]; // start, end (not midpoint at index 2)
			case Shape.CIRCLE:
				return [0, 1]; // center + right quadrant for resizing
			case Shape.ARC:
				return [0, 1, 2]; // center, start, end (not midpoint at index 3)
			case Shape.TANGENT_ARC:
				return [0, 1, 2]; // start, tangent handle, end
			case Shape.ELLIPSE:
				return [0, 1]; // center + corner control point
			case Shape.ELLIPTICAL_ARC:
				return [0, 1, 2]; // center, start, end (not midpoint at index 3)
			case Shape.SPLINE:
				return [0, 1, 2, 3]; // all 4 control points are selectable
			case Shape.IMAGE:
				return [4]; // center only - corners are for resizing
			case Shape.DIMENSION:
				return [0, 1, 2]; // start, end, and offset/text position
			case Shape.RADIAL_DIMENSION:
				return [0, 1, 2]; // center, perimeter point, text position
			case Shape.ANGLE_DIMENSION:
				return [1, 2, 3]; // arcStart, arcEnd, text position (no vertex - dims can't be dragged as whole)
			case Shape.TEXT:
				return [0]; // anchor point only - corners are for resizing
			case Shape.PAPER:
				return [4]; // center only - corners are for resizing
			case Shape.SYMBOL:
				return []; // No control points - instances drag as a whole unit
			case Shape.FRAME:
				return []; // No control points - frames drag as a whole unit
			default:
				return [];
		}
	}

	// Select shapes/points by marquee rectangle
	selectByMarquee(rect, shiftKey){
		if(!shiftKey){
			this.selectNone();
		}

		for(const shape of this.shapes){
			// Skip locked shapes
			if(shape.locked) continue;

			// Special handling for symbol instances - only select if entirely contained
			if(shape.geometry === Shape.SYMBOL){
				if(rect.containsRect(shape.bounds)){
					shape.selected = true;
				}
				continue;
			}

			// Frames are only selectable by clicking their label POI, not by marquee
			if(shape.geometry === Shape.FRAME){
				continue;
			}

			const pois = shape.getSnapPOIs();
			const selectableIndices = this.getSelectableIndices(shape);

			// Get frame transform if shape belongs to a frame
			const frame = shape.frameId ? this.getFrame(shape.frameId) : null;

			// Test each selectable POI against the marquee rectangle
			// For frame shapes, convert local POI to world coords first
			const insideIndices = [];
			for(const i of selectableIndices){
				if(!pois[i]) continue;

				let testPoint = pois[i];
				if(frame){
					// Convert local POI to world coords
					testPoint = frame.localToWorld(pois[i].x, pois[i].y);
				}

				if(rect.containsPoint(testPoint)){
					insideIndices.push(i);
				}
			}

			// Check if ALL selectable points are inside
			if(insideIndices.length === selectableIndices.length && selectableIndices.length > 0){
				// ALL selectable points inside → select whole shape
				shape.selected = true;
				this.selectedPoints.delete(shape);

			} else if(insideIndices.length > 0){
				// SOME points inside → partial point selection
				shape.selected = false;

				if(!this.selectedPoints.has(shape)){
					this.selectedPoints.set(shape, new Set());
				}

				for(const idx of insideIndices){
					this.selectedPoints.get(shape).add(idx);
				}
			}
		}

		// Check if any partial selections should be promoted to whole shape
		this.checkAutoPromotion();
	}

	// If all selectable POIs of a shape are selected, promote to whole shape selection
	checkAutoPromotion(){
		for(const [shape, indices] of this.selectedPoints.entries()){
			const selectableCount = this.getSelectableIndices(shape).length;

			if(indices.size >= selectableCount){
				// All selectable points selected → promote to whole shape
				shape.selected = true;
				this.selectedPoints.delete(shape);
			}
		}
	}

	deleteSelected(){
		const selected = this.getSelected();
		if(selected.length > 0){
			undoManager.execute(new DeleteShapesCommand([...selected]));
		}
	}

	// Cut selected shapes (copy + delete)
	cut(){
		const count = this.copy();
		if(count > 0){
			this.deleteSelected();
		}
		return count;
	}

	// Copy selected shapes to clipboard
	copy(){
		const selected = this.getSelected();
		if(selected.length === 0) return 0;

		// Clone shapes and store in clipboard
		this.clipboard = selected.map(shape => shape.clone());

		// Calculate centroid of copied shapes for offset calculation
		let sumX = 0, sumY = 0, count = 0;
		for(const shape of this.clipboard){
			const pois = shape.getSnapPOIs();
			for(const p of pois){
				sumX += p.x;
				sumY += p.y;
				count++;
			}
		}
		this.clipboardCentroid = count > 0
			? { x: sumX / count, y: sumY / count }
			: { x: 0, y: 0 };

		return selected.length;
	}

	// Prepare pasted shapes (returns clones without adding them)
	preparePaste(viewCenterX, viewCenterY){
		if(this.clipboard.length === 0) return [];

		// Calculate offset from clipboard centroid to view center
		const offsetX = viewCenterX - this.clipboardCentroid.x;
		const offsetY = viewCenterY - this.clipboardCentroid.y;

		// Build mapping from old groupIds to new groupIds
		const groupIdMap = new Map();
		for(const shape of this.clipboard){
			if(shape.groupId && !groupIdMap.has(shape.groupId)){
				// Walk up the group hierarchy to capture all ancestor groups
				let currentId = shape.groupId;
				while(currentId && !groupIdMap.has(currentId)){
					const newId = `group_${this._nextGroupId++}`;
					groupIdMap.set(currentId, newId);
					const group = this.groups.get(currentId);
					console.log(`preparePaste: mapping ${currentId} -> ${newId}, parent = ${group?.parentId}`);
					currentId = group ? group.parentId : null;
				}
			}
		}
		console.log('preparePaste: groupIdMap =', [...groupIdMap.entries()]);

		// Create new groups with remapped parentIds and layout properties
		for(const [oldId, newId] of groupIdMap){
			const oldGroup = this.groups.get(oldId);
			const newParentId = oldGroup && oldGroup.parentId ? groupIdMap.get(oldGroup.parentId) : null;
			const layout = oldGroup && oldGroup.layout
				? { ...oldGroup.layout }
				: { mode: 'none', gap: 0, alignment: 'start', distribution: 'none' };
			console.log(`preparePaste: creating group ${newId} with parentId ${newParentId}`);
			this.groups.set(newId, { id: newId, parentId: newParentId, layout });
		}

		// Clone and offset each shape, remapping groupId
		const pastedShapes = [];
		for(const shape of this.clipboard){
			const clone = shape.clone();
			clone.translate(offsetX, offsetY);
			if(clone.groupId){
				clone.groupId = groupIdMap.get(clone.groupId) || null;
			}
			pastedShapes.push(clone);
		}

		return pastedShapes;
	}

	/* 	generates a shape from params 
		useful for programmatically generating shapes or reading from a file */
	createShape(type, params){
		let newShape;

		switch(type){
			case Shape.LINE:
				newShape = new Line(params);
				break;
			
			case Shape.CIRCLE:
				newShape = new Circle(params);
				break;		
		}
		this.addShape(newShape)
		return newShape;
	}

	_deleteConstructions(){
		// Remove all intersections for each construction
		for(const construction of this.constructions){
			this.removeIntersectionsForShape(construction);
		}
		this.constructions = [];
	}

	deleteConstructions(){
		if(this.constructions.length > 0){
			undoManager.execute(new DeleteConstructionsCommand());
		}
	}

	deleteShape(shape){
		// Try to delete from shapes first
		let index = this.shapes.indexOf(shape);
		if(index > -1){
			this.shapes.splice(index, 1);
			this.spatialGrid.removeShape(shape);
			this.removeIntersectionsForShape(shape);
			this.rebuildPOIs();
			return;
		}

		// Try constructions
		index = this.constructions.indexOf(shape);
		if(index > -1){
			this.constructions.splice(index, 1);
			this.removeIntersectionsForShape(shape);
			return;
		}
	}


	// stores a shape from a shape geometry object
	// useful for interactively generating shapes via tools
	addShape(newShape){
		newShape.id = this.generateID();

		// make sure all the geometry is updated internally
		newShape.update();

		// Store POIs for this shape
		this.storeShapePOIs(newShape);

		// Add to spatial grid for efficient neighbor queries
		this.spatialGrid.addShape(newShape);

		// Find intersections using spatial grid (O(n×k) instead of O(n²))
		const neighbors = this.spatialGrid.getNeighbors(newShape);
		for(const neighbor of neighbors){
			this.findAndRegisterIntersections(newShape, neighbor);
		}

		// Also check constructions (not in spatial grid)
		for(const construction of this.constructions){
			this.findAndRegisterIntersections(newShape, construction);
		}

		// Add shape to the array
		this.shapes.push(newShape);
	}

	// from stroke commands
	addConstruction(construction){
		// Find intersections with existing shapes
		for(const shape of this.shapes){
			this.findAndRegisterIntersections(construction, shape);
		}

		// Find intersections with existing constructions
		for(const existingCon of this.constructions){
			this.findAndRegisterIntersections(construction, existingCon);
		}

		this.constructions.push(construction);
	}
	


	/* 	for drawing Previews */
	// XXX combine into array so we can handle complex previews
	addTempShape(newShape){
		//this.shapePreview = newShape;
		this.shapePreviews.push(newShape)
	}

	// Multiple preview shapes (for scale tool, etc.)
	setTempShapes(shapes){
		this.shapePreviews = shapes;
	}

	clearTempShapes(){
		this.shapePreviews = [];
	}

	getShapes(){
		return [...this.shapes, ...this.constructions];
	}

	// Set shapes to exclude from snapping
	setExcludeFromSnap(shapes){
		this.excludeFromSnap = new Set(shapes);
	}

	// Clear snap exclusions
	clearExcludeFromSnap(){
		this.excludeFromSnap.clear();
	}

	// Check if a shape should be excluded from snapping
	isExcludedFromSnap(shape){
		return this.excludeFromSnap.has(shape);
	}

	// Get shapes that belong to a symbol source group
	getSourceShapes(sourceGroupId){
		return this.shapes.filter(s => s.groupId === sourceGroupId);
	}

	// Create a symbol source from shapes (marks group as symbol source)
	createSymbolSource(shapes, name){
		if(shapes.length === 0) return null;

		// Create group from shapes
		const groupId = this.createGroup(shapes);
		const group = this.groups.get(groupId);

		// Mark as symbol source
		group.isSymbolSource = true;
		group.symbolName = name || 'Symbol';

		return groupId;
	}

	// Check if a group is a symbol source
	isSymbolSource(groupId){
		const group = this.groups.get(groupId);
		return group && group.isSymbolSource === true;
	}

	// --------------------------------------------------------------------------------
	// Group Editing Mode
	// --------------------------------------------------------------------------------

	// Currently editing group (double-click to enter, click outside to exit)
	editingGroupId = null;

	// Enter a group for editing (select children individually)
	enterGroup(groupId){
		this.editingGroupId = groupId;
		this.selectNone();
	}

	// Exit group editing mode
	exitGroup(){
		this.editingGroupId = null;
	}

	// Check if we're editing a group
	isEditingGroup(){
		return this.editingGroupId !== null;
	}

	// Get the group we're currently editing
	getEditingGroup(){
		return this.editingGroupId ? this.groups.get(this.editingGroupId) : null;
	}

	// Check if a shape/group is a direct child of the editing group
	isDirectChildOfEditingGroup(shape){
		if(!this.editingGroupId) return false;
		// Direct shape child
		if(shape.groupId === this.editingGroupId) return true;
		return false;
	}

	// Check if a groupId is a direct child group of the editing group
	isChildGroupOfEditingGroup(groupId){
		if(!this.editingGroupId) return false;
		const group = this.groups.get(groupId);
		return group && group.parentId === this.editingGroupId;
	}

	// --------------------------------------------------------------------------------
	// Frame Management
	// --------------------------------------------------------------------------------

	// Currently active frame for drawing (new shapes get this frameId)
	activeFrameId = null;

	// Get a frame by its shape ID
	getFrame(frameId){
		return this.shapes.find(s => s.geometry === Shape.FRAME && s.id === frameId);
	}

	// Get all shapes belonging to a frame
	getFrameShapes(frameId){
		if(!frameId) return [];
		return this.shapes.filter(s => s.frameId === frameId);
	}

	// Get all frames (symbol sources)
	getSymbolFrames(){
		return this.shapes.filter(s => s.geometry === Shape.FRAME && s.isSymbolSource);
	}

	// Set the active frame (for drawing into)
	setActiveFrame(frameId){
		this.activeFrameId = frameId;
	}

	// Clear active frame
	clearActiveFrame(){
		this.activeFrameId = null;
	}

	// Convert world coordinates to frame-local coordinates
	worldToFrame(frameId, worldX, worldY){
		const frame = this.getFrame(frameId);
		if(!frame) return { x: worldX, y: worldY };
		return frame.worldToLocal(worldX, worldY);
	}

	// Convert frame-local coordinates to world coordinates
	frameToWorld(frameId, localX, localY){
		const frame = this.getFrame(frameId);
		if(!frame) return { x: localX, y: localY };
		return frame.localToWorld(localX, localY);
	}

	getShapesToIntersect(){
		return [...this.shapes, ...this.constructions, ...this.guides];
	}

	// Array of all geometry to render
	// Paper/Frames render first (background), then images, then other shapes
	// Shapes with frameId are cloned and translated to world coords for rendering
	getShapesToRender(){
		const papers = [];
		const frames = [];
		const images = [];
		const symbols = [];  // Keep track of symbol instances for selection boxes
		const other = [];

		for (const s of this.shapes) {
			if (s.geometry === Shape.PAPER) {
				papers.push(s);
			} else if (s.geometry === Shape.FRAME) {
				frames.push(s);
			} else if (s.geometry === Shape.IMAGE) {
				images.push(s);
			} else if (s.geometry === Shape.SYMBOL) {
				// Expand symbol into its transformed shapes
				symbols.push(s);
				const symbolShapes = s.getShapesForRender();
				other.push(...symbolShapes);
			} else {
				// All shapes (including frame shapes) store world coords
				// No translation needed
				other.push(s);
			}
		}

		// Store symbols for selection box rendering (accessed by renderer)
		this._symbolInstances = symbols;

		return [...papers, ...frames, ...images, ...other, ...this.constructions, ...this.guides, ...this.shapePreviews].filter(Boolean);
	}

	// Array of all intersection points we could snap to
	getIntersectionCandidates(){
		// Convert Intersection objects to point-like objects for snapping
		// Intersection has x, y properties so it works directly
		return [...this.intersectionSet];
	}

	// Array of all points we could snap to
	getGuideIntersectionCandidates(){
		return [...this.guideIntersections];
	}

	// Array of all points we could snap to
	getPOICandidates(){
		return [...this.shapePOIs];
	}
	
/*
	getPOICandidates(){
		const shapePOIs = [];
		for(const shape of this.shapes){
			const points = shape.getSnapPOIs(); // generic objects right now
			for(const p of points){
				p.shape = shape;
			}
			shapePOIs.push(...points);
		}
		
		return shapePOIs;
	}
*/	
	
	getGuides(){
		return this.guides;
	}

	getNewShape(type){
		// XXX what is this???
		//da.setCurrentSnapPoint(this.snapPoint, true);
		
		if(type == Shape.LINE){
			return new Line([this.snapPoint.x, this.snapPoint.y, this.snapPoint.x, this.snapPoint.y]);
			
		}else if (type == Shape.CIRCLE){
			return new Circle([this.snapPoint.x, this.snapPoint.y, 0]);
		}
	}
		
	// --------------------------------------------------------------------------------
	// DA Guides
	// --------------------------------------------------------------------------------
	
	// when creating geometry include the start point as a snap guide
	addSnapPoint(p){
		// no dupes
		for(const snapPoint of this.snapPoints){
			// shitty if we're using floats?
			if(snapPoint.x == p.x && snapPoint.y == p.y)
				return;
		}

		this.snapPoints[this.snapIndex] = p;
		this.snapIndex++;
		if (this.snapIndex >= MAX_SNAP)
			this.snapIndex = 0;
	}

	resetSnaps(){
		this.snapPoints			= []	
		this.snapIndex 			= 0;

		// XXX
		//this.clearGuides();
	}

	// reset DA guides
	clearGuides(){
		this.guideIntersections = [];
		this.guides 			= [];
	}
	
	// DA guides
	addGuide(guide){
		this.findIntersections(guide, this.guideIntersections);
		this.guides.push(guide);
	}

	// --------------------------------------------------------------------------------
	// Color Palette Management
	// --------------------------------------------------------------------------------

	addColorToken(name, color) {
		const id = `color_${this.colorPalette._nextId++}`;
		this.colorPalette.tokens.push({ id, name, color });
		return id;
	}

	updateColorToken(id, name, color) {
		const token = this.colorPalette.tokens.find(t => t.id === id);
		if (token) {
			if (name !== null) token.name = name;
			if (color !== null) token.color = color;
		}
	}

	deleteColorToken(id) {
		const index = this.colorPalette.tokens.findIndex(t => t.id === id);
		if (index !== -1) {
			this.colorPalette.tokens.splice(index, 1);
			// Clear colorToken from shapes using this token
			for (const shape of this.shapes) {
				if (shape.colorToken === id) {
					shape.colorToken = null;
				}
			}
		}
	}

	getColorToken(id) {
		return this.colorPalette.tokens.find(t => t.id === id);
	}

	getColorTokenOptions() {
		return this.colorPalette.tokens.map(t => ({
			value: t.id,
			label: t.name
		}));
	}


}




const instance = new Data();
//Object.freeze(instance); // Optional: Prevent modifications to the instance
export default instance;

