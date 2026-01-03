import draftingAssistant 	from '../geometry/DraftingAssistant.js';
import data 				from '../data/Data.js';
import toolManager			from '../tools/ToolManager.js';

import { View } 			from "./View.js";
import { Rectangle } 		from "../geometry/Rectangle.js";
import { Renderer } 		from "./Renderer.js";
import { InputHandler } 	from './InputHandler';

// Lazy import to avoid circular dependency
let inspector = null;
const getInspector = () => {
	if (!inspector) {
		import('./Inspector.js').then(m => inspector = m.default);
	}
	return inspector;
};

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
		this.onWheel 			= this.onWheel.bind(this);
		this.onBlur 			= this.onBlur.bind(this);

		// Modifier key state
		this.optionKey			= false;
		this.controlKey			= false;
		this.shiftKey			= false;
		this.commandKey			= false;
		this.spaceKey			= false;
		this.toolSnaps			= false;

		// View transform (pan & zoom)
		this.panX				= 0;
		this.panY				= 0;
		this.zoom				= 1;
		this.minZoom			= 0.1;
		this.maxZoom			= 20;

		// View stack for zoom history
		this.viewStack			= [];
		
		// UI
		this.inputHandler 		= new InputHandler('toolbarTextInput');

		this.renderer 			= new Renderer();

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
		window.addEventListener('blur', 			this.onBlur);
		this.canvas.addEventListener('mousedown', 	this.onMouseDown);
		this.canvas.addEventListener('mousemove',	this.onMouseMove);
		this.canvas.addEventListener('mouseup',		this.onMouseUp);
		this.canvas.addEventListener('wheel',		this.onWheel, { passive: false });

		this.render();
    }

	/** Redraw everything. */
	render(){
		this.renderer.draw();
		// Update inspector panel
		const insp = getInspector();
		if (insp) insp.update();
	}

	setCursor(name, hotspotX=16, hotspotY=16){
		if(name == 'default'){
			this.canvas.style.cursor = 'default';
		}else if(name == 'crosshair'){
			this.canvas.style.cursor = 'crosshair';
		}else{
			this.canvas.style.cursor = `url("src/assets/cursors/${name}.png") ${hotspotX} ${hotspotY}, crosshair`;
		}
	}

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

	// Check if an input field has focus (typing should not trigger shortcuts)
	isInputFocused() {
		const tag = document.activeElement?.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
	}

	onKeyDown(e){
		// Always track modifier state
		this.shiftKey 		= e.shiftKey;
		this.commandKey 	= e.metaKey;
		this.controlKey 	= e.ctrlKey;
		this.optionKey 		= e.altKey;

		if(e.code === 'Space') this.spaceKey = true;

		// If typing in an input, don't intercept keys (except global shortcuts)
		if (this.isInputFocused()) {
			// Allow Escape to blur the input and return to canvas
			if (e.key === 'Escape') {
				document.activeElement.blur();
				e.preventDefault();
			}
			return;
		}

		// Prevent browser defaults for modifier combos and space
		if (this.commandKey || this.controlKey || this.optionKey || e.code === 'Space') {
			e.preventDefault();
		}

		this.dispatchEvent('keyDown', e);
	}

	onKeyUp(e){
		// Always track modifier state
		this.shiftKey 		= e.shiftKey;
		this.commandKey 	= e.metaKey;
		this.controlKey 	= e.ctrlKey;
		this.optionKey 		= e.altKey;
		if(e.code === 'Space') this.spaceKey = false;

		// If typing in an input, don't process shortcuts
		if (this.isInputFocused()) {
			return;
		}

		this.dispatchEvent('keyUp', e);
	}

	// Reset all modifier keys when window loses focus
	// This prevents stuck keys when switching apps with Cmd+Tab etc.
	onBlur()
	{
		this.optionKey 	= false;
		this.controlKey = false;
		this.shiftKey 	= false;
		this.commandKey = false;
		this.spaceKey 	= false;
	}
		
	// Normalize mouse event to canvas-relative coordinates
	// Converts screen coords to world coords (accounting for pan/zoom)
	normalizeMouseEvent(e) {
		// Screen coords (relative to canvas element)
		const screenX = e.offsetX;
		const screenY = e.offsetY;

		// Convert to world coords
		const worldX = (screenX - this.panX) / this.zoom;
		const worldY = (screenY - this.panY) / this.zoom;

		return {
			x: worldX,
			y: worldY,
			screenX: screenX,
			screenY: screenY,
			originalEvent: e
		};
	}

	// Zoom centered on cursor position
	onWheel(e) {
		e.preventDefault();

		const zoomFactor = 1.1;
		const screenX = e.offsetX;
		const screenY = e.offsetY;

		// World position under cursor before zoom
		const worldX = (screenX - this.panX) / this.zoom;
		const worldY = (screenY - this.panY) / this.zoom;

		// Apply zoom
		if(e.deltaY < 0){
			this.zoom = Math.min(this.maxZoom, this.zoom * zoomFactor);
		} else {
			this.zoom = Math.max(this.minZoom, this.zoom / zoomFactor);
		}

		// Adjust pan so the world point stays under cursor
		this.panX = screenX - worldX * this.zoom;
		this.panY = screenY - worldY * this.zoom;

		this.render();
	}

	// Reset view to default (no pan, zoom = 1)
	resetView() {
		this.panX = 0;
		this.panY = 0;
		this.zoom = 1;
		this.viewStack = [];
		this.render();
	}

	// Push current view state onto stack
	pushView() {
		this.viewStack.push({
			panX: this.panX,
			panY: this.panY,
			zoom: this.zoom
		});
	}

	// Pop view state from stack and restore it
	popView() {
		if(this.viewStack.length === 0) return false;

		const view = this.viewStack.pop();
		this.panX = view.panX;
		this.panY = view.panY;
		this.zoom = view.zoom;
		this.render();
		return true;
	}

	// Zoom to fit a world-space rectangle in the viewport
	// Pushes current view to stack first
	zoomToRect(worldRect) {
		// Push current view before changing
		this.pushView();

		// Get canvas dimensions (CSS pixels)
		const canvasWidth = this.canvas.clientWidth;
		const canvasHeight = this.canvas.clientHeight;

		// Calculate zoom to fit the rect with some padding
		const padding = 0.9; // 90% of viewport
		const zoomX = (canvasWidth * padding) / worldRect.width;
		const zoomY = (canvasHeight * padding) / worldRect.height;
		this.zoom = Math.min(zoomX, zoomY, this.maxZoom);
		this.zoom = Math.max(this.zoom, this.minZoom);

		// Center the rect in the viewport
		const worldCenterX = worldRect.x + worldRect.width / 2;
		const worldCenterY = worldRect.y + worldRect.height / 2;

		// Pan so world center maps to screen center
		this.panX = canvasWidth / 2 - worldCenterX * this.zoom;
		this.panY = canvasHeight / 2 - worldCenterY * this.zoom;

		this.render();
	}

	// Convert world coordinates to screen coordinates
	worldToScreen(worldX, worldY) {
		return {
			x: worldX * this.zoom + this.panX,
			y: worldY * this.zoom + this.panY
		};
	}

	// Convert a world-space distance/radius to screen pixels
	worldToScreenScale(worldValue) {
		return worldValue * this.zoom;
	}

	// Convert screen coordinates to world coordinates
	screenToWorld(screenX, screenY) {
		return {
			x: (screenX - this.panX) / this.zoom,
			y: (screenY - this.panY) / this.zoom
		};
	}

	onMouseMove(e)
	{
		this.mouse = this.normalizeMouseEvent(e);
		if(e.which == 3){
			console.log("hi")
			toolManager.handTool.onMouseMove(this.mouse);
		}else{		
			draftingAssistant.snap(this.mouse, toolManager.generateGuides());
			this.dispatchEvent('mouseMove', this.mouse);
			this.render();
		}
	}

	onMouseDown(e)
	{
		this.mouse = this.normalizeMouseEvent(e);
		
		if(e.which == 3){
			console.log("hi")
			toolManager.handTool.onMouseDown(this.mouse);
		}else{
			this.dispatchEvent('mouseDown', this.mouse);
		}
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





