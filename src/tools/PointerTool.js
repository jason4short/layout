import {Tool} from "./Tool.js";
import {Rectangle} from '../geometry/Rectangle.js';
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class PointerTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.generateGuides 	= false; // Enable snapping for move operations

		// Drag state
		this.dragStart			= null;
		this.isDragging			= false;
		this.dragThreshold		= 5; // pixels to differentiate click from drag
		this.marqueeRect		= null;

		// Move state
		this.isMoving			= false;
		this.moveTarget			= null; // {type: 'shape'|'point', shape, pointIndex?}
		this.moveStart			= null; // Snapped position when move started
		this.originalPositions	= []; // Store original positions for delta calc

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}


	begin(){
		data.resetSnaps();
		stage.addEventListener('mouseUp', 		this.onMouseUp);
		stage.addEventListener('mouseMove',		this.onMouseMove);
		stage.addEventListener('mouseDown',		this.onMouseDown);
	}

	exit(){
		stage.removeEventListener('mouseUp', 	this.onMouseUp);
		stage.removeEventListener('mouseMove', 	this.onMouseMove);
		stage.removeEventListener('mouseDown', 	this.onMouseDown);
		this.resetDrag();
	}

	resetDrag(){
		this.dragStart = null;
		this.isDragging = false;
		this.isMoving = false;
		this.moveTarget = null;
		this.moveStart = null;
		this.marqueeRect = null;
		this.originalPositions = [];
		stage.renderer.marqueeRect = null;
		data.clearExcludeFromSnap();
	}

	// Check if mouse is over a selected point or shape
	hitTestSelection(mouse){
		const tolerance = 8;

		// Check selected control points first
		for(const [shape, indices] of data.getSelectedPoints().entries()){
			const pois = shape.getSnapPOIs();
			for(const index of indices){
				const poi = pois[index];
				if(poi && this.distanceTo(mouse, poi) < tolerance){
					return {type: 'point', shape, pointIndex: index};
				}
			}
		}

		// Check whole-shape selections (test their selectable points)
		for(const shape of data.getSelected()){
			const pois = shape.getSnapPOIs();
			const selectableIndices = data.getSelectableIndices(shape);
			for(const index of selectableIndices){
				const poi = pois[index];
				if(poi && this.distanceTo(mouse, poi) < tolerance){
					return {type: 'shape', shape, pointIndex: index};
				}
			}
		}

		// Check if mouse is on the geometry of any selected shape
		const mouseRect = new Rectangle(mouse.x - tolerance, mouse.y - tolerance, tolerance * 2, tolerance * 2);
		for(const shape of data.getSelected()){
			const geoSnap = shape.getGeoSnap(mouse, mouseRect, tolerance);
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
		this.dragStart = {x: e.x, y: e.y};
		this.isDragging = false;
		this.isMoving = false;

		// Check if clicking on something already selected
		this.moveTarget = this.hitTestSelection(e);
	}

	onMouseMove(e){
//		data.resetSnaps();
		if(!this.dragStart) return;

		const dx = e.x - this.dragStart.x;
		const dy = e.y - this.dragStart.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		// Check if we've moved past the drag threshold
		if(!this.isDragging && !this.isMoving && dist > this.dragThreshold){
			if(this.moveTarget){
				// Start move operation
				this.isMoving = true;
				// Store the snap point when move started
				const snap = data.getCurrentSnapPoint();
				this.moveStart = {x: snap.x, y: snap.y};
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
			// Move selected items
			this.updateMove(dx, dy);
			stage.render();
			
		} else if(this.isDragging){
			// Update marquee rectangle
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

	updateMove(dx, dy){
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
			// Move operation complete - positions already updated
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
