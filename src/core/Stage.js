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

const scaleFactor = window.devicePixelRatio * 2;

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

		// Dirty flag rendering - prevents redundant draws
		this._isDirty 			= true;
		this._rafId 			= null;
		this._renderLoop 		= this._renderLoop.bind(this);

		// Throttle snap calculations (~60fps max)
		this._lastSnapTime 		= 0;
		this._snapThrottleMs 	= 16; // ~60fps

		// Performance monitoring
		this._perfMonitorEnabled = false;
		this._perfElement 		= null;
		this._lastFrameTime 	= 0;
		this._frameIntervals 	= [];
		this._drawTimes 		= [];
		this._snapTimes 		= [];
		this._maxFrameSamples 	= 60; // Rolling average over 60 frames

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
		this.canvas.addEventListener('wheel',		this.onWheel, { passive: false });

		// Mouse move/up on window to capture events outside canvas
		window.addEventListener('mousemove',	this.onMouseMove);
		window.addEventListener('mouseup',		this.onMouseUp);

		this.render();
    }

	/**
	 * Mark the stage as needing a redraw.
	 * Coalesces multiple calls into a single render via requestAnimationFrame.
	 */
	markDirty() {
		if (this._isDirty) return; // Already scheduled
		this._isDirty = true;

		if (this._rafId === null) {
			this._rafId = requestAnimationFrame(this._renderLoop);
		}
	}

	/**
	 * Internal render loop - called by requestAnimationFrame.
	 * Only renders if dirty flag is set.
	 */
	_renderLoop() {
		this._rafId = null;

		if (this._isDirty) {
			this._isDirty = false;

			const startTime = performance.now();
			this.renderer.draw();
			const frameTime = performance.now() - startTime;

			if (this._perfMonitorEnabled) {
				this._updatePerfMonitor(frameTime);
			}

			// Update inspector panel
			const insp = getInspector();
			if (insp) insp.update();
		}
	}
	
	
	/**
	 * Redraw everything immediately (synchronous).
	 * Use markDirty() for most cases to batch updates.
	 */
	render() {
		// Cancel any pending RAF to avoid double-render
		if (this._rafId !== null) {
			cancelAnimationFrame(this._rafId);
			this._rafId = null;
		}
		this._isDirty = false;

		const startTime = performance.now();
		this.renderer.draw();
		const frameTime = performance.now() - startTime;

		if (this._perfMonitorEnabled) {
			this._updatePerfMonitor(frameTime);
		}

		// Update inspector panel
		const insp = getInspector();
		if (insp) insp.update();
	}

	/**
	 * Toggle performance monitor display
	 */
	togglePerfMonitor() {
		this._perfMonitorEnabled = !this._perfMonitorEnabled;

		if (this._perfMonitorEnabled) {
			this._createPerfElement();
		} else if (this._perfElement) {
			this._perfElement.style.display = 'none';
		}
	}

	/**
	 * Create or show the performance monitor DOM element
	 */
	_createPerfElement() {
		if (!this._perfElement) {
			this._perfElement = document.createElement('div');
			this._perfElement.id = 'perfMonitor';
			this._perfElement.style.cssText = `
				position: fixed;
				top: 8px;
				right: 8px;
				background: rgba(0, 0, 0, 0.75);
				color: #0f0;
				font-family: monospace;
				font-size: 12px;
				padding: 6px 10px;
				border-radius: 4px;
				z-index: 10000;
				pointer-events: none;
				min-width: 100px;
			`;
			document.body.appendChild(this._perfElement);
		}
		this._perfElement.style.display = 'block';
		this._frameIntervals = [];
		this._drawTimes = [];
		this._snapTimes = [];
		this._lastFrameTime = 0;
	}

	/**
	 * Update the performance monitor with new frame timing
	 */
	_updatePerfMonitor(drawTimeMs) {
		if (!this._perfElement) return;

		const now = performance.now();

		// Track frame interval (time between frames)
		if (this._lastFrameTime > 0) {
			const interval = now - this._lastFrameTime;
			this._frameIntervals.push(interval);
			if (this._frameIntervals.length > this._maxFrameSamples) {
				this._frameIntervals.shift();
			}
		}
		this._lastFrameTime = now;

		// Track draw time
		this._drawTimes.push(drawTimeMs);
		if (this._drawTimes.length > this._maxFrameSamples) {
			this._drawTimes.shift();
		}

		// Calculate stats
		const avgInterval = this._frameIntervals.length > 0
			? this._frameIntervals.reduce((a, b) => a + b, 0) / this._frameIntervals.length
			: 16.67;
		const fps = 1000 / avgInterval;

		const avgDrawTime = this._drawTimes.reduce((a, b) => a + b, 0) / this._drawTimes.length;

		// Snap timing
		const avgSnapTime = this._snapTimes.length > 0
			? this._snapTimes.reduce((a, b) => a + b, 0) / this._snapTimes.length
			: 0;

		// Shape count
		const shapeCount = data.shapes.length;

		// Color code based on performance
		let color = '#0f0'; // Green = good
		if (avgInterval > 20) color = '#ff0'; // Yellow = below 50fps
		if (avgInterval > 33) color = '#f00'; // Red = below 30fps

		this._perfElement.style.color = color;
		this._perfElement.innerHTML = `
			FPS: ${fps.toFixed(0)}<br>
			Draw: ${avgDrawTime.toFixed(1)}ms<br>
			Snap: ${avgSnapTime.toFixed(1)}ms<br>
			Shapes: ${shapeCount} | Zoom: ${this.zoom.toFixed(1)}x
		`;
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

		// CSS size (layout size) - let CSS handle sizing via width:100%; height:100%
		const cssWidth = this.canvas.clientWidth || this.canvas.width;
		const cssHeight = this.canvas.clientHeight || this.canvas.height;

		// Backing store (actual pixel buffer) - set canvas resolution
		this.canvas.width = Math.max(1, Math.floor(cssWidth * devicePixelRatioClamped));
		this.canvas.height = Math.max(1, Math.floor(cssHeight * devicePixelRatioClamped));

		// Don't set style.width/height - let CSS rules (width:100%; height:100%) control sizing
		// This allows the canvas to resize with its container

		// Reset and scale the transform so 1 unit == 1 CSS pixel
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.scale(devicePixelRatioClamped, devicePixelRatioClamped);
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
		if (this.isInputFocused() && !this.commandKey) {
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
		let screenX, screenY;

		// Handle events from window (during drag outside canvas)
		if (e.target !== this.canvas) {
			const rect = this.canvas.getBoundingClientRect();
			screenX = e.clientX - rect.left;
			screenY = e.clientY - rect.top;
		} else {
			// Screen coords (relative to canvas element)
			screenX = e.offsetX;
			screenY = e.offsetY;
		}

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

	zoomIn() {
		const screenX = this.canvas.width/scaleFactor;
		const screenY = this.canvas.height/scaleFactor;
		this.zoomStage(this.zoom * 1.5, screenX, screenY);
	}

	zoomOut() {
		const screenX = this.canvas.width/scaleFactor;
		const screenY = this.canvas.height/scaleFactor;
		this.zoomStage(this.zoom / 1.5, screenX, screenY);
	}

	// Zoom centered on cursor position
	onWheel(e) {
		e.preventDefault();
		const zoomFactor = 1.1;
		const screenX = e.offsetX;
		const screenY = e.offsetY;
		
		//let newZoom;
		if(e.deltaY < 0){
			//newZoom = Math.min(this.maxZoom, this.zoom * zoomFactor);
			this.zoomStage(this.zoom * zoomFactor, screenX, screenY);
		} else {
			//newZoom = Math.max(this.minZoom, this.zoom / zoomFactor);
			this.zoomStage(this.zoom / zoomFactor, screenX, screenY);
		}
	}

	zoomStage(newZoom, screenX, screenY) {		
		// World position under cursor before zoom
		const worldX = (screenX - this.panX) / this.zoom;
		const worldY = (screenY - this.panY) / this.zoom;
		
		// apply new zoom setting
		this.zoom = newZoom;
		
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

	// Convert a screen-space distance to world units
	screenToWorldScale(screenValue) {
		return screenValue / this.zoom;
	}

	// Convert screen coordinates to world coordinates
	screenToWorld(screenX, screenY) {
		return {
			x: (screenX - this.panX) / this.zoom,
			y: (screenY - this.panY) / this.zoom
		};
	}

	// --------------------------------------------

	onMouseDown(e)
	{
		this.mouse = this.normalizeMouseEvent(e);

		if(e.which == 3){
			toolManager.handTool.onMouseDown(this.mouse);
		}else{
			this.dispatchEvent('mouseDown', this.mouse);
		}
	}

	onMouseMove(e)
	{
		this.mouse = this.normalizeMouseEvent(e);
		
		// right click and drag - pan the view
		if(e.which == 3){
			toolManager.handTool.onMouseMove(this.mouse);
			
		}else{
			// Throttle snap calculations to prevent excessive computation
			const now = performance.now();
			
			if (now - this._lastSnapTime >= this._snapThrottleMs) {
				this._lastSnapTime = now;
				const snapStart = performance.now();

				// find a snap point
				draftingAssistant.snap(this.mouse, toolManager.generateGuides());
				
				if (this._perfMonitorEnabled) {
					this._snapTimes.push(performance.now() - snapStart);
					if (this._snapTimes.length > this._maxFrameSamples) {
						this._snapTimes.shift();
					}
				}
			}
			
			this.dispatchEvent('mouseMove', this.mouse);
			this.markDirty(); // Batches renders via RAF
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





