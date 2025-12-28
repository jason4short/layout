import {Tool} from "./Tool.js";
import stage from '../core/Stage.js';
import data from '../data/Data.js';

export class PointerTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.willSnap 			= false;
		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}

	
	begin(){
// 		stage.addEventListener('keyUp', 		this.onKeyUp);
		stage.addEventListener('mouseUp', 		this.onMouseUp);
		stage.addEventListener('mouseMove',		this.onMouseMove);
		stage.addEventListener('mouseDown',		this.onMouseDown);
	}

	exit(){
// 		stage.removeEventListener('keyUp', 		this.onKeyUp);
		stage.removeEventListener('mouseUp', 	this.onMouseUp);
		stage.removeEventListener('mouseMove', 	this.onMouseMove);
		stage.removeEventListener('mouseDown', 	this.onMouseDown);
	}
	

	onMouseDown(e)
	{
		// select a line
		data.selectShape(e, stage.shiftKey);
		stage.render();
	}
	
	onMouseMove(e){
	}

	onMouseUp(e){
		
	}

}

