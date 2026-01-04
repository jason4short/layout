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

	/**
	 * Subscribe to an event with automatic cleanup tracking.
	 * Use this instead of addEventListener directly.
	 * @param {EventDispatcher} target - Object to listen to
	 * @param {string} event - Event name
	 * @param {Function} callback - Event handler
	 */
	subscribe(target, event, callback) {
		const boundCallback = callback.bind(this);
		target.addEventListener(event, boundCallback);
		this._eventSubscriptions.push({ target, event, callback: boundCallback });
	}

	/**
	 * Called when tool is activated. Override to set up event listeners.
	 * Always call super.activate() first.
	 */
	activate() {
		// Base implementation - subclasses override
	}

	/**
	 * Called when tool is deactivated. Automatically cleans up all event subscriptions.
	 * Override to add custom cleanup, but always call super.deactivate().
	 */
	deactivate() {
		// Remove all tracked event subscriptions
		for (const sub of this._eventSubscriptions) {
			sub.target.removeEventListener(sub.event, sub.callback);
		}
		this._eventSubscriptions = [];
		this.reset();
	}

	onKeyDown(e){
	}

	updateCursor(){

	}

	reset(){
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

