const MAX_SNAP = 4; // intersections only snap if within 12px on screen

import {Shape} 				from '../geometry/Geometry.js';
import {Point} 				from '../geometry/Point.js';
import {Line} 				from '../geometry/Line.js';
import {Guide} 				from '../geometry/Guide.js';
import {Circle} 			from '../geometry/Circle.js';
import {SnapPoint} 			from '../geometry/SnapPoint.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';
import {Intersections} 		from './Intersections.js';



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
		this.shapePreview 			= []; // 

		// store unique snap points in a ring buffer	
		this.snapPoints				= []; // DA snap storage - only geometry points of interest are stored
		this.snapIndex				= 0;
		
        // geometry intersections
		this.shapePOIs			 	= []; 	// when we add a shape, we intersect all existing geometry
		this.shapeIntersections 	= []; 	// when we add a shape, we intersect all existing geometry
		this.conIntersections		= [];	// when we add a constructions, we intersect all existing geometry
		this.guideIntersections		= [];	// when we add a temp guide, we intersect all existing geometry

		// the point under the cursor
		this.snapPoint				= new SnapPoint();

		// A hash of current snap points;
		this.snaps 					= new Map();

		// geometry solver class
		this.intersections			= new Intersections();

		// This is a singleton class
        return Data.instance;
	}
	
	// generate an ID for each shape
	generateID(){ Math.random().toString(36).slice(2);}
	
		
	// generate array of all points we could snap to	
	resetSnapCandidates(){
		this.shapePOIs = [];
		
		for(const shape of this.shapes){
			// ask shape for it's key snap points
			const points = shape.getSnapPOIs();

			//fill up snap candidates array
			// the ... operator splits out the array into individual elements
			this.shapePOIs.push(...points);
		}
	}

	// 	
	storeShapePOIs(shape){
		const points = shape.getSnapPOIs();
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
				console.log(`${n} intersects ${intersects}`);
				n++;
			}
		}
	}
	
	getTargetShape(mouse){
		// clear selection
		this.selectNone();
		this.selectedShape = null;

		// clear selection
		let snap = draftingAssistant.findNearestSnapPoint_OnShape(mouse, this.shapes);
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
	findIntersectionsWithBoundaries(shape, boundaries) {
		const intersections = [];
		for (const boundary of boundaries) {
			const points = this.intersections.intersect_shapes(shape, boundary);
			if (points && points.length) {
				intersections.push(...points);
			}
		}
		return intersections;
	}
	
	selectShape(mouse, shiftKey){
		// clear selection
		if(shiftKey == false){this.selectNone();}
		this.selectedShape = null;

		// clear selection
		let snap = draftingAssistant.findNearestSnapPoint_OnShape(mouse, this.shapes);
		if(snap){
			snap.shape.selected = true;
			console.log(snap.shape.selected);
			return snap.shape;
		}
	}
	
	selectNone(){
		for(let i = 0; i < this.shapes.length; i++){
			this.shapes[i].selected = false;
		}	
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


	// 	stores a shape from a shape geometry object
	//	useful for interactively generating shapes via tools
	addShape(newShape){
		newShape.id = this.generateID();	
		
		// pre-store the POIs from each shape
		// could be stored in the shapes themselves??? would make editing chapes easier
		this.storeShapePOIs(newShape);
		
		// will go through all the shapes and try to intersect and store the points
		this.findIntersections(newShape, this.shapeIntersections);
		
		// add shape to the DB
		this.shapes.push(newShape);
	}

	// from stroke commands
	addConstruction(construction){ 

		// does this line overlap? 
// 		for(const shape of this.constructions){	
// 			if(construction.angle == 90 && construction.angle == 90 && shape.start.x == construction.start.x){
// 				return;
// 			}else if(construction.angle == 0 && construction.angle == 0 && shape.start.y == construction.start.y){
// 				return;
// 			}
// 		}

		this.findIntersections(construction, this.conIntersections);
		this.constructions.push(construction);
	}
	

	/* 	for drawing Previews */
	addTempShape(newShape){
		//create a new guide object
		//let g = new Guide([newShape.start.x, newShape.start.y]);
		// manually create a new snap point 

//		const key = `${newShape.start.x},${newShape.start.y}`;
//		this.snaps.set(key, {x:newShape.start.x, y:newShape.start.y});

	//this.addGuides(data.snaps, `${point.x},${point.y}`, snap);		
// 		
// 		if(newShape.geometry === Shape.LINE){
// 			snap.addGuides(this.snaps, `${newShape.start.x},${newShape.start.y}`, newShape.start);
// 			
// 		}else if(newShape.geometry === Shape.CIRCLE){
// 			snap.addGuides(this.snaps, `${newShape.x},${newShape.y}`, newShape)
// 		}

		// set initial snapPoint
		

		this.shapePreview.push(newShape);
	}
		
	removeTempShape(){
		this.shapePreview = [];
	}

	getShapes(){
		return [...this.shapes, ...this.constructions];
	}
		
	getShapesToIntersect(){
		return [...this.shapes, ...this.constructions, ...this.guides];
	}

	// Array of all geometry to render
	getShapesToRender(){
		return [...this.shapes, ...this.shapePreview, ...this.constructions, ...this.guides];
	}

	// Array of all points we could snap to
	getIntersectionCandidates(){
		return [...this.shapeIntersections , ...this.conIntersections, ...this.guideIntersections];
	}

	// Array of all points we could snap to
	getPOICandidates(){
		return [...this.shapePOIs];
	}
	
	getGuides(){
		return [...this.guides];
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
		// only unique, only 4-8

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
	
	// reset DA guides
	clearGuides(){
		this.guideIntersections = [];
		this.guides	= []; // temp constructions, ephemeral, gen on snap points
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

