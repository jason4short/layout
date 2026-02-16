import {Tool} 	from './Tool.js';

import stage 			from '../core/Stage.js';
import toolManager		from './ToolManager.js';
import data 			from '../data/Data.js';

export class HandTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.name 	= "Hand";
		this.usage 	= "Drag to pan the canvas view.";

		this.generateGuides 	= false;

		this.isPanning 			= false;
		this.lastScreenX 		= 0;
		this.lastScreenY 		= 0;

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}

	begin(){
		// Ignore mouse events briefly to avoid palette click bleeding into pan
		this._activating = true;
		requestAnimationFrame(() => { this._activating = false; });

		stage.addEventListener('mouseUp', this.onMouseUp);
		stage.addEventListener('mouseMove', this.onMouseMove);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	deactivate(){
		stage.removeEventListener('mouseUp', this.onMouseUp);
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseDown', this.onMouseDown);
		this.isPanning = false;
	}

	updateCursor(){
		stage.setCursor('hand');
	}

	reset(){
	}

	onMouseDown(e)
	{
		if (this._activating) return;
		this.isPanning = true;
		this.lastScreenX = e.screenX;
		this.lastScreenY = e.screenY;
	}

	onMouseMove(e){
		if(!this.isPanning) return;

		// Calculate delta in screen space
		const dx = e.screenX - this.lastScreenX;
		const dy = e.screenY - this.lastScreenY;

		// Update pan
		stage.panX += dx;
		stage.panY += dy;

		// Store for next move
		this.lastScreenX = e.screenX;
		this.lastScreenY = e.screenY;

		stage.render();
	}

	onMouseUp(e){
		this.isPanning = false;
	}

}

