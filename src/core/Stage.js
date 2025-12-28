import draftingAssistant 	from '../geometry/DraftingAssistant.js';

import { View } 			from "./View.js";
import { Rectangle } 		from "../geometry/Rectangle.js";
import { Renderer } 		from "./Renderer.js";
import {InputHandler} 		from './InputHandler';

//import Event from "./core/Events";
//import flash.events.MouseEvent;


class Stage extends View
{
 	constructor(){
 		super();
 		
		if (Stage.instance) return Stage.instance;
    
        this.init 				= this.init.bind(this);
        this.onResize 			= this.onResize.bind(this);

		// Bind handlers so `this` stays the Stage instance
		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
		this.onKeyDown 			= this.onKeyDown.bind(this);
		this.onKeyUp 			= this.onKeyUp.bind(this);

		// Modifier key state
		this.optionKey			= false;
		this.controlKey			= false;
		this.shiftKey			= false;
		this.commandKey			= false;
		this.toolSnaps			= false;
		
		// UI
		this.inputHandler 		= new InputHandler('toolbarTextInput');

		this.renderer 			= new Renderer();

		this.init();		
        return Stage.instance;
	}
	
    init(){
		this.canvas 	= document.getElementById('stage');
		this.ctx 		= this.canvas.getContext('2d');;
		this.document 	= document;


		// Initial DPI setup + on window resize (CSS size may change)
		this.configureCanvasForHighDPI();
		window.addEventListener("resize", this.onResize);

		// the stage hears all
		window.addEventListener('keydown', 			this.onKeyDown, 	{ capture: true });
		window.addEventListener('keyup', 			this.onKeyUp, 		{ capture: true });
		this.canvas.addEventListener('mousedown', 	this.onMouseDown);
		this.canvas.addEventListener('mousemove',	this.onMouseMove);
		this.canvas.addEventListener('mouseup',		this.onMouseUp);
    }

	/** Redraw everything. */
	render(){this.renderer.draw();}
	
	/**
	 * Ensure the canvas backing store matches CSS size * devicePixelRatio,
	 * then scale the context so drawing uses 1:1 logical pixels.
	 */
	configureCanvasForHighDPI() {
		const devicePixelRatioClamped = Math.max(1, window.devicePixelRatio || 1);

		// CSS size (layout size). If not styled, fallback to current attribute size.
		const cssWidth = this.canvas.clientWidth || this.canvas.width;
		const cssHeight = this.canvas.clientHeight || this.canvas.height;

		// Backing store (actual pixel buffer)
		this.canvas.width = Math.max(1, Math.floor(cssWidth * devicePixelRatioClamped));
		this.canvas.height = Math.max(1, Math.floor(cssHeight * devicePixelRatioClamped));

		// Keep CSS size equal to logical coordinate system
		this.canvas.style.width = cssWidth + "px";
		this.canvas.style.height = cssHeight + "px";

		// Reset and scale the transform so 1 unit == 1 CSS pixel
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.scale(devicePixelRatioClamped, devicePixelRatioClamped);

		// Optional: align 1px strokes crisply on whole pixels
		// this.ctx.translate(0.5, 0.5);

		// Trigger a redraw after resizing/scaling
	}
	
	
	/** Handle window resize (CSS size changed). */
	onResize() {
		this.configureCanvasForHighDPI();
		this.render();
	}

	onKeyDown(e)
	{
		if (e.key === 'Shift')			this.shiftKey 	= true;
		else if (e.key === 'Meta')		this.commandKey = true;
		else if (e.key === 'Control')	this.controlKey = true;
		else if (e.key === 'Alt') 		this.optionKey 	= true;
		
		this.dispatchEvent('keyDown', e);
	}
	
	onKeyUp(e)
	{
		if (e.key === 'Shift')			this.shiftKey 	= false;
		else if (e.key === 'Meta')		this.commandKey = false;
		else if (e.key === 'Control')	this.controlKey = false;
		else if (e.key === 'Alt') 		this.optionKey 	= false;

		this.dispatchEvent('keyUp', e);
	}
		
	// Normalize mouse event to canvas-relative coordinates
	normalizeMouseEvent(e) {
		// Create a simple object with canvas-relative x/y
		// offsetX/offsetY are relative to the canvas element
		return {
			x: e.offsetX,
			y: e.offsetY,
			offsetX: e.offsetX,
			offsetY: e.offsetY,
			originalEvent: e
		};
	}

	onMouseMove(e)
	{
		this.mouse = this.normalizeMouseEvent(e);
		if(this.toolSnaps)
			draftingAssistant.snap(this.mouse);
		this.dispatchEvent('mouseMove', this.mouse);
		this.render();
	}

	onMouseDown(e)
	{
		this.dispatchEvent('mouseDown', this.normalizeMouseEvent(e));
	}

	onMouseUp(e)
	{
		this.dispatchEvent('mouseUp', this.normalizeMouseEvent(e));
	}
	
	// UI for input handling
	setDimensionInputValue(dim){
		this.inputHandler.setInputValue(dim);
	}
	
	setInputCallback(callback){
		this.inputHandler.setCallback(callback);
	}
	
	
}

const instance = new Stage();
//Object.freeze(instance); // Optional: Prevent modifications to the instance
export default instance;





