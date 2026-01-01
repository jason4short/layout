const MAX_SNAP = 4; // intersections only snap if within 12px on screen

import {Shape} 				from '../geometry/Geometry.js';
import {Point} 				from '../geometry/Point.js';
import {Line} 				from '../geometry/Line.js';
import {Guide} 				from '../geometry/Guide.js';
import {Circle} 			from '../geometry/Circle.js';
import {SnapPoint} 			from '../geometry/SnapPoint.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';
import {Intersections} 		from './Intersections.js';
import {Intersection}		from './Intersection.js';



//export const id = () => Math.random().toString(36).slice(2)


// stores all shapes, intersections

// getIntersections

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
		this.shapePreview 			= null; // single preview shape
		this.shapePreviews 			= []; // multiple preview shapes (for scale tool, etc.)

		// store unique snap points in a ring buffer	
		this.snapPoints				= []; // DA snap storage - only geometry points of interest are stored
		this.snapIndex				= 0;
		
        // geometry intersections - new architecture
		this.shapePOIs			 	= []; 	// POIs from shapes (endpoints, centers, etc.)
		this.intersectionSet		= new Set();	// All Intersection objects
		this.intersectionsByShape	= new Map();	// Map<shape, Set<Intersection>> for quick lookup
		this.guideIntersections		= [];	// temp guide intersections (ephemeral)

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

		// This is a singleton class
        return Data.instance;
	}
	
	// generate an ID for each shape
	generateID(){ Math.random().toString(36).slice(2);}

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

	// --------------------------------------------------------------------------------
	// POI Management
	// --------------------------------------------------------------------------------

	// Rebuild POIs for all shapes (called after shape deletion)
	rebuildPOIs(){
		this.shapePOIs = [];
		for(const shape of this.shapes){
			const points = shape.getSnapPOIs();
			for(const p of points){
				p.shape = shape;
			}
			this.shapePOIs.push(...points);
		}
	}

	//
	storeShapePOIs(shape){
		const points = shape.getSnapPOIs();
		// Add shape reference to each POI for exclusion checking
		for(const p of points){
			p.shape = shape;
		}
		this.shapePOIs.push(...points);
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
	
	getTargetShape(mouse){
		let snap = draftingAssistant.findNearestSnapPoint_OnShape(mouse, this.getShapes());
		if(snap){
			return snap.shape;
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
	
	selectShape(mouse, shiftKey){
		// clear selection unless shift is held
		if(shiftKey == false){this.selectNone();}

		let snap = draftingAssistant.findNearestSnapPoint_OnShape(mouse, this.shapes);
		if(snap){
			// Toggle selection if shift is held, otherwise select
			if(shiftKey){
				snap.shape.selected = !snap.shape.selected;
			}else{
				snap.shape.selected = true;
			}
			return snap.shape;
		}
	}
	
	selectNone(){
		for(let i = 0; i < this.shapes.length; i++){
			this.shapes[i].selected = false;
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

	selectAll(){
		for(let i = 0; i < this.shapes.length; i++){
			this.shapes[i].selected = true;
		}
		this.selectedPoints.clear(); // Clear partial selections when selecting all
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
				return [0]; // center only (not quadrants at 1-4)
			case Shape.ARC:
				return [0, 1, 2]; // center, start, end (not midpoint at index 3)
			case Shape.ELLIPSE:
				return [0]; // center only (not quadrants at 1-4)
			case Shape.ELLIPTICAL_ARC:
				return [0, 1, 2]; // center, start, end (not midpoint at index 3)
			case Shape.SPLINE:
				return [0, 1, 2, 3]; // all 4 control points are selectable
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
			const pois = shape.getSnapPOIs();
			const selectableIndices = this.getSelectableIndices(shape);

			// Test each selectable POI against the marquee rectangle
			const insideIndices = [];
			for(const i of selectableIndices){
				if(pois[i] && rect.containsPoint(pois[i])){
					insideIndices.push(i);
				}
			}

			// Check if ALL selectable points are inside
			if(insideIndices.length === selectableIndices.length){
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
		for(const shape of selected){
			this.deleteShape(shape);
		}
		return selected.length;
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

	deleteConstructions(){
		// Remove all intersections for each construction
		for(const construction of this.constructions){
			this.removeIntersectionsForShape(construction);
		}
		this.constructions = [];
	}

	deleteShape(shape){
		// Try to delete from shapes first
		let index = this.shapes.indexOf(shape);
		if(index > -1){
			this.shapes.splice(index, 1);
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


	// 	stores a shape from a shape geometry object
	//	useful for interactively generating shapes via tools
	// should this be a clone?
	addShape(newShape){
		newShape.id = this.generateID();

		// make sure all the geometry is updated internally
		newShape.update();

		// Store POIs for this shape
		this.storeShapePOIs(newShape);

		// Find intersections with existing shapes
		for(const shape of this.shapes){
			this.findAndRegisterIntersections(newShape, shape);
		}

		// Find intersections with existing constructions
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
	addTempShape(newShape){
		this.shapePreview = newShape;
	}

	removeTempShape(){
		this.shapePreview = null;
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
		
	getShapesToIntersect(){
		return [...this.shapes, ...this.constructions, ...this.guides];
	}

	// Array of all geometry to render
	getShapesToRender(){
		return [...this.shapes, ...this.constructions, ...this.guides, ...this.shapePreviews, this.shapePreview].filter(Boolean);
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
	
	getGuides(){
		return this.guides;
	}

	getNewShape(type){
		this.setCurrentSnapPoint(this.snapPoint, true);
		
		if(type == Shape.LINE){
			return new Line([this.snapPoint.x, this.snapPoint.y, this.snapPoint.x, this.snapPoint.y]);			
		}else if (type == Shape.CIRCLE){
			return new Circle([this.snapPoint.x, this.snapPoint.y, 0]);
		}
	}
	
	// --------------------------------------------------------------------------------
	// DA Guides
	// --------------------------------------------------------------------------------
	// xxx move logic to DA?

	// tracks the current snapped point
	setCurrentSnapPoint(p, store){ 
		//console.log(p, store)
		this.snapPoint = p;

		if(store){
			this.addSnapPoint(p)
		}
	}
	
	getCurrentSnapPoint(){ 
		return this.snapPoint;
	}
	
	
	// when creating geometry include the start point as a snap guide
	addSnapPoint(p){

		// no dupes
		for(const snapPoint of this.snapPoints){
			if(snapPoint.x == p.x && snapPoint.y == p.y)
				return;
		}
		
		this.snapPoints[this.snapIndex] = p;
		this.snapIndex++;
		if (this.snapIndex >= MAX_SNAP) this.snapIndex = 0;
			
		// generate temp DA guides for each point
		this.clearGuides();
		for(const snapPoint of this.snapPoints){
			draftingAssistant.createGuides(snapPoint);
		}
	}

	resetSnaps(){
		this.snapPoints			= []	
		this.snapIndex 			= 0;
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

	
}




const instance = new Data();
//Object.freeze(instance); // Optional: Prevent modifications to the instance
export default instance;

