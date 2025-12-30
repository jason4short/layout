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

		this.willSnap 			= true; // Enable snapping for move operations

		// Drag state
		this.dragStart			= null;
		this.isDragging			= false;
		this.dragThreshold		= 5; // pixels to differentiate click from drag
		this.marqueeRect		= null;

		// Move state
		this.isMoving			= false;
		this.moveTarget			= null; // {type: 'shape'|'point', shape, pointIndex?}
		this.originalPositions	= new Map(); // Store original positions for delta calc

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}


	begin(){
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
		this.marqueeRect = null;
		this.originalPositions.clear();
		stage.renderer.marqueeRect = null;
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

		return null;
	}

	distanceTo(a, b){
		return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
	}

	// Store original positions of all selected items
	storeOriginalPositions(){
		this.originalPositions.clear();

		// Store positions for whole-shape selections
		for(const shape of data.getSelected()){
			const pois = shape.getSnapPOIs();
			const selectableIndices = data.getSelectableIndices(shape);
			for(const index of selectableIndices){
				const poi = pois[index];
				if(poi){
					this.originalPositions.set(`${shape.geometry}-${shape.x || shape.start?.x}-${index}`,
						{x: poi.x, y: poi.y, shape, index});
				}
			}
		}

		// Store positions for partial point selections
		for(const [shape, indices] of data.getSelectedPoints().entries()){
			const pois = shape.getSnapPOIs();
			for(const index of indices){
				const poi = pois[index];
				if(poi){
					this.originalPositions.set(`${shape.geometry}-${shape.x || shape.start?.x}-${index}`,
						{x: poi.x, y: poi.y, shape, index});
				}
			}
		}
	}

	onMouseDown(e)
	{
		this.dragStart = {x: e.x, y: e.y};
		this.isDragging = false;
		this.isMoving = false;

		// Check if clicking on something already selected
		this.moveTarget = this.hitTestSelection(e);
	}

	onMouseMove(e){
		if(!this.dragStart) return;

		const dx = e.x - this.dragStart.x;
		const dy = e.y - this.dragStart.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		// Check if we've moved past the drag threshold
		if(!this.isDragging && !this.isMoving && dist > this.dragThreshold){
			if(this.moveTarget){
				// Start move operation
				this.isMoving = true;
				this.storeOriginalPositions();
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
		// Use snap point for the drag target, apply same delta to all
		const snapPt = data.getCurrentSnapPoint();
		const snappedDx = snapPt.x - this.dragStart.x;
		const snappedDy = snapPt.y - this.dragStart.y;

		// Track which shapes we've fully moved (to avoid double-moving)
		const movedShapes = new Set();

		// Move whole-shape selections
		for(const shape of data.getSelected()){
			if(movedShapes.has(shape)) continue;
			movedShapes.add(shape);

			const selectableIndices = data.getSelectableIndices(shape);
			for(const index of selectableIndices){
				const key = `${shape.geometry}-${shape.x || shape.start?.x}-${index}`;
				const original = this.originalPositions.get(key);
				if(original){
					shape.updateControlPoint(index, original.x + snappedDx, original.y + snappedDy);
				}
			}
		}

		// Move partial point selections
		for(const [shape, indices] of data.getSelectedPoints().entries()){
			for(const index of indices){
				const key = `${shape.geometry}-${shape.x || shape.start?.x}-${index}`;
				const original = this.originalPositions.get(key);
				if(original){
					shape.updateControlPoint(index, original.x + snappedDx, original.y + snappedDy);
				}
			}
		}
	}

	onMouseUp(e){
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
