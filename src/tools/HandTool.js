import {Tool} 	from './Tool.js';

import stage	from '../core/Stage.js';
import data 	from '../data/Data.js';

export class HandTool extends Tool
{
	// private members

	constructor()
	{
		super();
		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
		this.onKeyDown 			= this.onKeyDown.bind(this);
		this.onKeyUp 			= this.onKeyUp.bind(this);
	}
	
	begin(){
		stage.addEventListener('keyUp', this.onKeyUp);
		stage.addEventListener('mouseUp', this.onMouseUp);
		stage.addEventListener('mouseMove', this.onMouseMove);
		stage.addEventListener('mouseDown', this.onMouseDown);
	}

	exit(){
		stage.removeEventListener('keyUp', this.onKeyUp);
		stage.removeEventListener('mouseUp', this.onMouseUp);
		stage.removeEventListener('mouseMove', this.onMouseMove);
		stage.removeEventListener('mouseDown', this.onMouseDown);
	}
	
	onKeyUp(e){
	}

	onMouseDown(e)
	{
	}
	
	onMouseMove(e){
	}

	onMouseUp(e){
		
	}

}

