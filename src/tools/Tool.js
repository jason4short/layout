import {InteractiveObject} from "../core/InteractiveObject.js";
import stage from '../core/Stage.js';

export class Tool extends InteractiveObject
{
	// private members

	constructor()
	{
		super();
		this.generateGuides = true;

	}
	
	onKeyDown(e){
	}
	
	/**
	 * Return the distance between two points.
	 */
	distanceBetweenPoints(firstPoint, secondPoint)
	{
		const deltaX = firstPoint.x - secondPoint.x;
		const deltaY = firstPoint.y - secondPoint.y;

		return Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
	}

}

