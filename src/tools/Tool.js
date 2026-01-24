import {InteractiveObject} 	from "../core/InteractiveObject.js";
//import stage 				from '../core/Stage.js';

export class Tool extends InteractiveObject
{
	// private members

	constructor()
	{
		super();
		this.generateGuides = true;

		// Tool metadata for UI
		this.name 	= "Tool";
		this.usage 	= "";

		// Event listener tracking for cleanup
		this._eventSubscriptions = [];
	}

	activate() {}
	deactivate() {}
	onKeyDown(e){}
	updateCursor(){}
	reset(){}

}

