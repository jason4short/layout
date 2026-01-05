import stage 					from '../core/Stage.js';
import data 					from '../data/Data.js';
import undoManager				from '../core/UndoManager.js';
import fileManager				from '../core/FileManager.js';
import { AddShapesCommand }	from '../core/Commands.js';

import { EventDispatcher } 				from '../core/EventDispatcher.js';

import { LineTool } 					from "./LineTool.js";
import { HandTool } 					from "./HandTool.js";
import { PointerTool } 					from "./PointerTool.js";
import { StrokeTool } 					from "./StrokeTool.js";
import { CircleTool } 					from "./CircleTool.js";
import { ParallelLineTool }				from "./ParallelLineTool.js";
import { TrimTool } 					from "./TrimTool.js";
import { ThreePointArcTool } 			from "./ThreePointArcTool.js";
import { CenterPointArcTool } 			from "./CenterPointArcTool.js";
import { TangentPointArcTool } 			from "./TangentPointArcTool.js";
import { FilletTool } 					from "./FilletTool.js";
import { ChamferTool } 					from "./ChamferTool.js";
import { BoxTool } 						from "./BoxTool.js";
import { OppositeCornerEllipseTool } 	from "./OppositeCornerEllipseTool.js";
import { CenterPointEllipseTool } 		from "./CenterPointEllipseTool.js";
import { SplineTool } 					from "./SplineTool.js";
import { ScaleTool } 					from "./ScaleTool.js";
import { MirrorTool } 					from "./MirrorTool.js";
import { RotateTool } 					from "./RotateTool.js";
import { ImageTool } 					from "./ImageTool.js";



//import Event from "./core/Events";
//import flash.events.MouseEvent;



class ToolManager extends EventDispatcher
{
 	constructor(){
 		super();
		if (ToolManager.instance) return ToolManager.instance;
		
		// Bind handlers so `this` stays the Stage instance
		this.onKeyDown 					= this.onKeyDown.bind(this);
		this.onKeyUp 					= this.onKeyUp.bind(this);
		this.onMouseDown 				= this.onMouseDown.bind(this);
		this.onMouseMove 				= this.onMouseMove.bind(this);
		this.onMouseUp 					= this.onMouseUp.bind(this);

		// keep tools handy
		this.lineTool	 				= new LineTool();
		this.circleTool 				= new CircleTool();
		this.strokeTool 				= new StrokeTool();
		this.handTool					= new HandTool();
		this.pointerTool				= new PointerTool();
		this.parallelLineTool			= new ParallelLineTool();
		this.trimTool					= new TrimTool();
		this.threePointArcTool			= new ThreePointArcTool();
		this.centerPointArcTool			= new CenterPointArcTool();
		this.tangentPointArcTool		= new TangentPointArcTool();
		this.filletTool					= new FilletTool();
		this.chamferTool				= new ChamferTool();
		this.boxTool					= new BoxTool();
		this.oppositeCornerEllipseTool	= new OppositeCornerEllipseTool();
		this.centerPointEllipseTool		= new CenterPointEllipseTool();
		this.splineTool					= new SplineTool();
		this.scaleTool					= new ScaleTool();
		this.mirrorTool					= new MirrorTool();
		this.rotateTool					= new RotateTool();
		this.imageTool					= new ImageTool();

		// Tool palette configuration: [tool, displayName, shortcut]
		this.toolPaletteConfig = [
			{ category: 'Select' },
			{ tool: this.pointerTool, 				name: 'Pointer', shortcut: 'V' },
			{ tool: this.handTool, 					name: 'Hand', shortcut: 'H' },
			{ category: 'Draw' },
			{ tool: this.lineTool, 					name: 'Line', shortcut: 'L' },
			{ tool: this.boxTool, 					name: 'Box', shortcut: 'B' },
			{ tool: this.imageTool, 				name: 'Image', shortcut: 'I' },
			{ tool: this.circleTool,				name: 'Circle', shortcut: 'C' },
			{ tool: this.oppositeCornerEllipseTool, name: 'Ellipse', shortcut: 'E' },
			{ tool: this.centerPointEllipseTool, 	name: 'Ellipse (Center)', shortcut: '4' },
			{ tool: this.splineTool, 				name: 'Spline', shortcut: 'S' },
			{ category: 'Arcs' },	
			{ tool: this.threePointArcTool, 		name: '3-Point Arc', shortcut: 'A' },
			{ tool: this.centerPointArcTool, 		name: 'Center Arc', shortcut: '1' },
			{ tool: this.tangentPointArcTool, 		name: 'Tangent Arc', shortcut: '3' },
			{ category: 'Modify' },	
			{ tool: this.trimTool, 					name: 'Trim', shortcut: 'T' },
			{ tool: this.filletTool, 				name: 'Fillet', shortcut: 'F' },
			{ tool: this.chamferTool, 				name: 'Chamfer', shortcut: 'K' },
			{ tool: this.parallelLineTool, 			name: 'Parallel', shortcut: 'P' },
			{ tool: this.scaleTool, 				name: 'Scale', shortcut: 'X' },
			{ tool: this.mirrorTool, 				name: 'Mirror', shortcut: 'M' },
			{ tool: this.rotateTool, 				name: 'Rotate', shortcut: 'R' },
		];

		return ToolManager.instance;
	}
	
	
	init(){
		this.buildToolPalette();		

		stage.addEventListener('keyUp', 	this.onKeyUp);
		stage.addEventListener('keyDown', 	this.onKeyDown);
		stage.addEventListener('mouseDown', this.onMouseDown);
		stage.addEventListener('mouseMove', this.onMouseMove);
		stage.addEventListener('mouseUp', 	this.onMouseUp);

		this.currentTool 	= this.pointerTool;
		this.currentTool.begin();
		this.updateToolNameDisplay();
	}

	/** Redraw everything. */
	render(){this.renderer.draw();}


	// Build the tool palette UI
	buildToolPalette(){
		const palette = document.getElementById('toolPalette');
		if(!palette) return;

		palette.innerHTML = '';

		for(const item of this.toolPaletteConfig){
			if(item.category){
				// Category header
				const header = document.createElement('h3');
				header.textContent = item.category;
				palette.appendChild(header);
			} else {
				// Tool button
				const btn = document.createElement('button');
				btn.className = 'tool-btn';
				btn.dataset.toolId = item.tool.constructor.name;
				btn.innerHTML = `${item.name}<span class="shortcut">${item.shortcut}</span>`;
				btn.addEventListener('click', () => this.setTool(item.tool));
				palette.appendChild(btn);
			}
		}
	}

	setTool(tool)
	{
		
		this.currentTool.exit();

		if(tool == this.strokeTool){
			this.strokeTool.begin();
		}else{
			data.clearGuides();
			//data.selectNone();
			this.currentTool = tool;
			this.currentTool.begin();
			this.currentTool.updateCursor();
		}

		this.updateToolNameDisplay();
		
		
		stage.render();
	}

	// Display current tool name and usage in the toolbar, update palette active state
	updateToolNameDisplay(){
		const toolNameEl = document.getElementById('currentToolName');
		if(toolNameEl && this.currentTool){
			const name = this.currentTool.name || 'Tool';
			const usage = this.currentTool.usage || '';
			toolNameEl.innerHTML = `<strong>${name}</strong> ${usage}`;
		}

		// Update palette active state
		const palette = document.getElementById('toolPalette');
		if(palette && this.currentTool){
			const toolId = this.currentTool.constructor.name;
			palette.querySelectorAll('.tool-btn').forEach(btn => {
				btn.classList.toggle('active', btn.dataset.toolId === toolId);
			});
		}
	}
	

	generateGuides(){
		if(stage.commandKey){
			return false;
		}else {
			return this.currentTool.generateGuides
		}
	}
	

	undo(){
		console.log("undo")
		if(undoManager.undo()){
			stage.render();
		}
	}

	redo(){
		console.log("redo")
		if(undoManager.redo()){
			stage.render();
		}
	}
	
	
	onMouseDown(e)
	{
		if(stage.spaceKey){
			this.handTool.onMouseDown(e);
			
		}else if(stage.commandKey){
			this.strokeTool.onMouseDown(e);
			
		}else if(stage.shiftKey){
			this.pointerTool.onMouseDown(e);
			
		}else{
			this.currentTool.onMouseDown(e);
		}
	}

	onMouseMove(e)
	{
		if(stage.spaceKey){
			this.handTool.onMouseMove(e);
			
		}else if(stage.commandKey){
			this.strokeTool.onMouseMove(e);

		}else if(stage.shiftKey){
			this.pointerTool.onMouseMove(e);

		}else{
			this.currentTool.onMouseMove(e);
		}
	}

	onMouseUp(e)
	{
		if(stage.spaceKey){
			this.handTool.onMouseUp(e);
			
		}else if(stage.commandKey){
			this.strokeTool.onMouseUp(e);
			
		}else if(stage.shiftKey){
			this.pointerTool.onMouseUp(e);

		}else{
			this.currentTool.onMouseUp(e);
		}
	}

// Select All
// fit
// new open, close, group? 

 
 
	onKeyDown(e)
	{
// 		console.log("onKeyDown"+ e);
		if(e.key == 'd'){
			console.log(data.snapPoint.x, data.snapPoint.y)
		}

// 		console.log(e.key)
		if(stage.commandKey){
			stage.setCursor('command', 8, 8);
			this.strokeTool.activate();
			data.resetSnaps();

		} else if(stage.spaceKey){
			stage.setCursor('hand');

		} else if(stage.shiftKey){
			stage.setCursor('default');

		} 
		
		if(stage.commandKey){
			switch(e.key){
				case '-':
					stage.zoomOut();
					break;

				case '=':
					stage.zoomIn();
					break;

				case 'a':
					data.selectAll();
					stage.render();
					break;
					
				case '0':
					stage.resetView();
					break;
	
				case 'z':
				case 'Z':
					if(stage.commandKey){
						if(stage.shiftKey){						
							this.redo();
						} else {
							this.undo();
						}
					}
					break;
	
				case 'c':
				case 'C':
					const copied = data.copy();
					if(copied > 0){
						console.log(`Copied ${copied} shape(s)`);
					}
					break;
	
				case 'v':
					// Calculate view center in world coordinates
					const centerX = stage.canvas.clientWidth / 2;
					const centerY = stage.canvas.clientHeight / 2;
					const worldCenter = stage.screenToWorld(centerX, centerY);

					const shapesToPaste = data.preparePaste(worldCenter.x, worldCenter.y);
					if(shapesToPaste.length > 0){
						undoManager.execute(new AddShapesCommand(shapesToPaste));
						// Select pasted shapes
						data.selectNone();
						for(const shape of shapesToPaste){
							shape.selected = true;
						}
						console.log(`Pasted ${shapesToPaste.length} shape(s)`);
						stage.render();
					}				
					break;
	
				case 's':
					fileManager.save();
					break;
	
				case 'o':
					fileManager.open();
					break;
	
				case 'n':
					fileManager.newDocument();
					break;

				case 'l':
				case 'L':
					if(stage.shiftKey){
						// Shift+Cmd+L = Unlock all shapes
						let unlockCount = 0;
						for(const shape of data.shapes){
							if(shape.locked){
								shape.locked = false;
								unlockCount++;
							}
						}
						if(unlockCount > 0){
							console.log(`Unlocked ${unlockCount} shape(s)`);
							stage.render();
						}
					} else {
						// Cmd+L = Lock selection
						const selected = data.getSelected();
						if(selected.length > 0){
							for(const shape of selected){
								shape.locked = true;
								shape.selected = false; // Deselect when locking
							}
							console.log(`Locked ${selected.length} shape(s)`);
							stage.render();
						}
					}
					break;

				default:
			}
			return;
		}

		// no modifier keys
		switch(e.key){
			case 'Escape':
				this.currentTool.reset();
				stage.render();
				break;
			
			case 'Delete':
			case 'Backspace':
				data.deleteSelected();
				stage.render();
				break;
				
			case 'F1':
				this.setTool(this.pointerTool);
				break;

			case 'F2':
				this.setTool(this.lineTool);
				break;
				
			case 'F3':
				this.setTool(this.parallelLineTool);
				break;

			case 'F4':
				//this.setTool(this.parallelLineTool);
				data.deleteConstructions();
				break;

			case 'F5':
				this.setTool(this.lineTool);
				break;

			case 'F6':
				this.setTool(this.filletTool);
				break;

			case 'F7':
				this.setTool(this.trimTool);
				break;

			case '[':
				// Decrease opacity on selected images
				for(const shape of data.getSelected()){
					if(shape.opacity !== undefined){
						shape.opacity = Math.max(0.1, shape.opacity - 0.1);
					}
				}
				stage.render();
				break;

			case ']':
				// Increase opacity on selected images
				for(const shape of data.getSelected()){
					if(shape.opacity !== undefined){
						shape.opacity = Math.min(1.0, shape.opacity + 0.1);
					}
				}
				stage.render();
				break;

			case '`':
				// Toggle performance monitor
				stage.togglePerfMonitor();
				break;
		}
	}
	
	
	onKeyUp(e)
	{
//		console.log("onKeyUp toolMan"+ e);

		// Handle command key release - deactivate strokeTool and restore cursor
		if(e.key == 'Meta'){
			if(this.strokeTool.active){
				this.strokeTool.deactivate();
			}
		}

		if(!(stage.commandKey && stage.spaceKey && stage.shiftKey)){
			this.currentTool.updateCursor();
		}
			
// 
// 		// Handle shift key release - restore cursor
// 		if(stage.shiftKey){
// 			this.currentTool.updateCursor();
// 			return;
// 		} else if(stage.spaceKey){
// 			this.currentTool.updateCursor();
// 		}

	}
}

const instance = new ToolManager();
export default instance;


