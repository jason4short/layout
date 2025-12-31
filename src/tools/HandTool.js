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
		this.cursor = "cursor_grab";

		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}
	
	begin(){
		toolManager.addEventListener('mouseUp', this.onMouseUp);
		toolManager.addEventListener('mouseMove', this.onMouseMove);
		toolManager.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		toolManager.removeEventListener('mouseUp', this.onMouseUp);
		toolManager.removeEventListener('mouseMove', this.onMouseMove);
		toolManager.removeEventListener('mouseDown', this.onMouseDown);
	}
	

	onMouseDown(e)
	{
	}
	
	onMouseMove(e){
	}

	onMouseUp(e){
		
	}

}

