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

		this.willSnap 			= false;

		// Drag state
		this.dragStart			= null;
		this.isDragging			= false;
		this.dragThreshold		= 5; // pixels to differentiate click from drag
		this.marqueeRect		= null;

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
		this.marqueeRect = null;
		stage.renderer.marqueeRect = null;
	}

	onMouseDown(e)
	{
		// Store drag start position
		this.dragStart = {x: e.x, y: e.y};
		this.isDragging = false;
	}

	onMouseMove(e){
		if(!this.dragStart) return;

		const dx = e.x - this.dragStart.x;
		const dy = e.y - this.dragStart.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		// Check if we've moved past the drag threshold
		if(!this.isDragging && dist > this.dragThreshold){
			this.isDragging = true;
			// Clear selection when starting a new marquee (unless shift held)
			if(!stage.shiftKey){
				data.selectNone();
			}
		}

		if(this.isDragging){
			// Update marquee rectangle
			this.marqueeRect = new Rectangle(
				Math.min(this.dragStart.x, e.x),
				Math.min(this.dragStart.y, e.y),
				Math.abs(dx),
				Math.abs(dy)
			);
			// Set on renderer for drawing
			stage.renderer.marqueeRect = this.marqueeRect;
			stage.render();
		}
	}

	onMouseUp(e){
		if(this.isDragging && this.marqueeRect){
			// Finish marquee selection
			data.selectByMarquee(this.marqueeRect, stage.shiftKey);
			this.marqueeRect = null;
		} else if(this.dragStart){
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
