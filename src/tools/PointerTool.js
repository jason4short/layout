import {Tool} 			from "./Tool.js";
import {Rectangle} 		from '../geometry/Rectangle.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';

export class PointerTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.name 	= "Pointer";
		this.usage 	= "Click to select. Drag to marquee or move. Option+drag to clone.";
		this.cursor = "cursor_pointer";

		this.generateGuides 	= false; // Enable snapping for move operations

		// Drag state
		this.dragStart			= null;
		this.isDragging			= false;
		this.dragThreshold		= 5; // pixels to differentiate click from drag
		this.marqueeRect		= null;

		// Move state
		this.isMoving			= false;
		this.isCloning			= false; // Option+drag clones instead of moves
		this.moveTarget			= null; // {type: 'shape'|'point', shape, pointIndex?}
		this.moveStart			= null; // Snapped position when move started
		this.originalPositions	= []; // Store original positions for delta calc
		this.clonedShapes		= []; // Shapes created during clone operation

		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}


	begin(){
		data.resetSnaps();
		toolManager.addEventListener('mouseUp', 		this.onMouseUp);
		toolManager.addEventListener('mouseMove',		this.onMouseMove);
		toolManager.addEventListener('mouseDown',		this.onMouseDown);
	}

	exit(){
		toolManager.removeEventListener('mouseUp', 		this.onMouseUp);
		toolManager.removeEventListener('mouseMove', 	this.onMouseMove);
		toolManager.removeEventListener('mouseDown', 	this.onMouseDown);
		this.resetDrag();
	}
	reset(){
	}

	resetDrag(){
		// state
		this.isDragging 			= false;
		this.isMoving 				= false;
		this.isCloning 				= false;

		// items
		this.dragStart 				= null;
		this.moveTarget 			= null;
		this.moveStart 				= null;
		this.marqueeRect 			= null;
		stage.renderer.marqueeRect 	= null;
		this.originalPositions 		= [];
		this.clonedShapes 			= [];

		data.clearExcludeFromSnap();
	}

	// Check if mouse is over a selected point or shape
	hitTestSelection(mouse){
		const tolerance = 8; // screen pixels
		const screenMouse = { x: mouse.screenX, y: mouse.screenY };

		// Check selected control points first (compare in screen space)
		for(const [shape, indices] of data.getSelectedPoints().entries()){
			const pois = shape.getSnapPOIs();

			for(const index of indices){
				const poi = pois[index];
				if(poi){
					const screenPOI = stage.worldToScreen(poi.x, poi.y);
					if(this.distanceTo(screenMouse, screenPOI) < tolerance){
						return {type: 'point', shape, pointIndex: index};
					}
				}
			}
		}

		// Check whole-shape selections (test their selectable points)
		for(const shape of data.getSelected()){
			const pois = shape.getSnapPOIs();
			const selectableIndices = data.getSelectableIndices(shape);

			for(const index of selectableIndices){
				const poi = pois[index];
				if(poi){
					const screenPOI = stage.worldToScreen(poi.x, poi.y);
					if(this.distanceTo(screenMouse, screenPOI) < tolerance){
						return {type: 'shape', shape, pointIndex: index};
					}
				}
			}
		}

		// Check if mouse is on the geometry of any selected shape
		// (getGeoSnap works in world space, so convert tolerance)
		const worldTolerance = tolerance / stage.zoom;
		const mouseRect = new Rectangle(mouse.x - worldTolerance, mouse.y - worldTolerance, worldTolerance * 2, worldTolerance * 2);

		for(const shape of data.getSelected()){
			const geoSnap = shape.getGeoSnap(mouse, mouseRect, worldTolerance);
			if(geoSnap){
				return {type: 'shape', shape, pointIndex: null};
			}
		}

		return null;
	}

	distanceTo(a, b){
		return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
	}

	// Exclude selected shapes from snapping during move
	setSnapExclusions(){
		const shapesToExclude = [];

		// Add whole-shape selections
		for(const shape of data.getSelected()){
			shapesToExclude.push(shape);
		}

		// Add shapes with partial point selections
		for(const [shape] of data.getSelectedPoints().entries()){
			if(!shapesToExclude.includes(shape)){
				shapesToExclude.push(shape);
			}
		}

		data.setExcludeFromSnap(shapesToExclude);
	}

	// Clone selected shapes and switch selection to clones
	cloneSelectedShapes(){
		this.isCloning = true;
		this.clonedShapes = [];

		const selected = data.getSelected();

		// Clone each selected shape
		for(const shape of selected){
			const clone = shape.clone();
			data.addShape(clone);
			clone.selected = true;
			this.clonedShapes.push(clone);
		}

		// Deselect originals
		for(const shape of selected){
			shape.selected = false;
		}

		// Update moveTarget to reference a cloned shape
		if(this.moveTarget && this.clonedShapes.length > 0){
			// Find the clone corresponding to the original target
			const originalIndex = selected.indexOf(this.moveTarget.shape);
			if(originalIndex >= 0 && originalIndex < this.clonedShapes.length){
				this.moveTarget.shape = this.clonedShapes[originalIndex];
			}
		}
	}

	// Store original positions of all selected items
	storeOriginalPositions(){
		this.originalPositions = [];

		// Store positions for whole-shape selections
		for(const shape of data.getSelected()){
			const pois = shape.getSnapPOIs();
			const selectableIndices = data.getSelectableIndices(shape);
			for(const index of selectableIndices){
				const poi = pois[index];
				if(poi){
					this.originalPositions.push({x: poi.x, y: poi.y, shape, index});
				}
			}
		}

		// Store positions for partial point selections
		for(const [shape, indices] of data.getSelectedPoints().entries()){
			const pois = shape.getSnapPOIs();
			for(const index of indices){
				const poi = pois[index];
				if(poi){
					this.originalPositions.push({x: poi.x, y: poi.y, shape, index});
				}
			}
		}
	}

	onMouseDown(e)
	{
		data.resetSnaps();

		// Cmd+click toggles control point visibility
		if(stage.commandKey){
			data.toggleControlPoints(e);
			stage.render();
			return;
		}

		// Store both world and screen coords
		this.dragStart = {x: e.x, y: e.y, screenX: e.screenX, screenY: e.screenY};
		this.isDragging = false;
		this.isMoving = false;

		// Check if clicking on something already selected
		this.moveTarget = this.hitTestSelection(e);
	}

	onMouseMove(e){
		if(!this.dragStart) return;

		// Calculate distance in screen space for threshold check
		const screenDx = e.screenX - this.dragStart.screenX;
		const screenDy = e.screenY - this.dragStart.screenY;
		const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

		// World-space delta for marquee
		const dx = e.x - this.dragStart.x;
		const dy = e.y - this.dragStart.y;

		// Check if we've moved past the drag threshold (screen pixels)
		if(!this.isDragging && !this.isMoving && screenDist > this.dragThreshold){
			if(this.moveTarget){
				// Start move operation
				this.isMoving = true;
				// Store the snap point when move started
				const snap = data.getCurrentSnapPoint();
				this.moveStart = {x: snap.x, y: snap.y};

				// Option+drag = clone shapes
				if(stage.optionKey){
					this.cloneSelectedShapes();
				}

				this.storeOriginalPositions();
				// Exclude selected shapes from snapping
				this.setSnapExclusions();
			} else {
				// Start marquee selection
				this.isDragging = true;
				if(!stage.shiftKey){
					data.selectNone();
				}
			}
		}

		if(this.isMoving){
			// Move selected items (uses snap points, not dx/dy)
			this.updateMove();
			stage.render();

		} else if(this.isDragging){
			// Update marquee rectangle (world coords)
			this.marqueeRect = new Rectangle(
				Math.min(this.dragStart.x, e.x),
				Math.min(this.dragStart.y, e.y),
				Math.abs(dx),
				Math.abs(dy)
			);
			stage.renderer.marqueeRect = this.marqueeRect;
			stage.render();
		}
	}

	updateMove(){
		if(this.originalPositions.length === 0) return;

		// Get current snap point (already set by Stage.onMouseMove)
		const snapPt = data.getCurrentSnapPoint();

		// Calculate delta from where we started dragging
		const snapDx = snapPt.x - this.moveStart.x;
		const snapDy = snapPt.y - this.moveStart.y;

		// Apply delta to all stored original positions
		for(const original of this.originalPositions){
			original.shape.updateControlPoint(original.index, original.x + snapDx, original.y + snapDy);
		}
	}

	onMouseUp(e){
		data.resetSnaps();
		if(this.isMoving){
			// Move operation complete - rebuild POI cache
			data.rebuildPOIs();
		} else if(this.isDragging && this.marqueeRect){
			// Finish marquee selection
			data.selectByMarquee(this.marqueeRect, stage.shiftKey);
			this.marqueeRect = null;
		} else if(this.dragStart && !this.isDragging && !this.isMoving){
			// It was a click, not a drag - use existing click selection
			data.selectShape(e, stage.shiftKey);
		}

		this.resetDrag();
		stage.render();
	}

	// Get the current marquee rect for rendering
	getMarqueeRect(){
		return this.marqueeRect;
	}
}
