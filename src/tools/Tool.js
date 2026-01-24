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

	// remove XXX	
	distanceBetweenPoints(firstPoint, secondPoint)
	{
		const deltaX = firstPoint.x - secondPoint.x;
		const deltaY = firstPoint.y - secondPoint.y;

		return Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
	}

}

