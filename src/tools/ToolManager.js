import stage 					from '../core/Stage.js';
import data 					from '../data/Data.js';
import undoManager				from '../core/UndoManager.js';
import fileManager				from '../core/FileManager.js';
import { DeleteShapesCommand, AddShapesCommand }	from '../core/Commands.js';

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

		// Tool palette configuration: [tool, displayName, shortcut]
		this.toolPaletteConfig = [
			{ category: 'Select' },
			{ tool: this.pointerTool, name: 'Pointer', shortcut: 'V' },
			{ tool: this.handTool, name: 'Hand', shortcut: 'H' },
			{ category: 'Draw' },
			{ tool: this.lineTool, name: 'Line', shortcut: 'L' },
			{ tool: this.boxTool, name: 'Box', shortcut: 'B' },
			{ tool: this.circleTool, name: 'Circle', shortcut: 'C' },
			{ tool: this.oppositeCornerEllipseTool, name: 'Ellipse', shortcut: 'E' },
			{ tool: this.centerPointEllipseTool, name: 'Ellipse (Center)', shortcut: '4' },
			{ tool: this.splineTool, name: 'Spline', shortcut: 'S' },
			{ category: 'Arcs' },
			{ tool: this.threePointArcTool, name: '3-Point Arc', shortcut: 'A' },
			{ tool: this.centerPointArcTool, name: 'Center Arc', shortcut: '1' },
			{ tool: this.tangentPointArcTool, name: 'Tangent Arc', shortcut: '3' },
			{ category: 'Modify' },
			{ tool: this.trimTool, name: 'Trim', shortcut: 'T' },
			{ tool: this.filletTool, name: 'Fillet', shortcut: 'F' },
			{ tool: this.chamferTool, name: 'Chamfer', shortcut: 'K' },
			{ tool: this.parallelLineTool, name: 'Parallel', shortcut: 'P' },
			{ tool: this.scaleTool, name: 'Scale', shortcut: 'X' },
			{ tool: this.mirrorTool, name: 'Mirror', shortcut: 'M' },
			{ tool: this.rotateTool, name: 'Rotate', shortcut: 'R' },
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
	

	setToolByName(toolName)
	{
		switch(tool){
			case 'line':
				this.setTool(this.lineTool);
				break;

			case 'circle':
				this.setTool(this.circleTool);
				break;

			case 'hand':
				this.setTool(this.handTool);
				break;

			case 'stroke':
				this.setTool(this.strokeTool);
				break;
			
			case 'pointer':
				this.setTool(this.pointerTool);
				break;
			
			default:
				this.setTool(this.pointerTool);
				break;
	
		}
	}

	generateGuides(){
		if(stage.commandKey){
			return false;
		}else {
			return this.currentTool.generateGuides
		}
	}
	
	deleteSelected()
	{
		const selected = data.getSelected();
		if(selected.length > 0){
			undoManager.execute(new DeleteShapesCommand([...selected]));
			stage.render();
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
		}else{
			this.currentTool.onMouseUp(e);
		}
	}
	
	onKeyDown(e)
	{
		if(stage.commandKey){
			stage.setCursor('command', 8, 8);
			this.strokeTool.activate();
			data.resetSnaps();

		}else if(stage.shiftKey){
			stage.setCursor('default');

		}else{
			this.currentTool.updateCursor();
		}
	}

	onKeyUp(e)
	{
// 		if(this.strokeTool.active){
// 			this.strokeTool.deactivate();
// 			this.currentTool.updateCursor();
// 			return;
// 		}
			console.log("stage.controlKey "+stage.controlKey)
			console.log("stage.shiftKey "+stage.shiftKey)
	
		switch(e.key){
		
			case 'l':
				this.setTool(this.lineTool);
				break;
			

			case 'h':
				this.setTool(this.handTool);
				break;

			case 'p':
				this.setTool(this.parallelLineTool);
				break;

			case 't':
				this.setTool(this.trimTool);
				break;

			case 'a':
				this.setTool(this.threePointArcTool);
				break;

// 				case '1':
// 				this.setTool(this.centerPointArcTool);
// 				break;

// 				case '2':
// 				this.setTool(this.threePointArcTool);
// 				break;

// 				case '3':
// 				this.setTool(this.tangentPointArcTool);
// 				break;

			case 'f':
				this.setTool(this.filletTool);
				break;

			case 'k':
				this.setTool(this.chamferTool);
				break;

			case 'b':
				this.setTool(this.boxTool);
				break;

			case 'e':
				this.setTool(this.oppositeCornerEllipseTool);
				break;

			// 's' handled below with Ctrl+S check

			case 'x':
				this.setTool(this.scaleTool);
				break;

			case 'm':
				this.setTool(this.mirrorTool);
				break;

			case 'r':
				this.setTool(this.rotateTool);
				break;

// 				case '4':
// 				this.setTool(this.centerPointEllipseTool);
// 				break;

			case 'Escape':
				this.currentTool.reset();
				stage.render();
				break;
			
			case 'Delete':
			case 'Backspace':
				this.deleteSelected();
				break;

			case '0':
				stage.resetView();
				break;

			case 'z':
			case 'Z':
				if(stage.controlKey){
					if(stage.shiftKey){						
						this.redo();
					} else {
						this.undo();
					}
				}
				break;

			case 'c':
				if(stage.controlKey){
					const copied = data.copy();
					if(copied > 0){
						console.log(`Copied ${copied} shape(s)`);
					}
				}else{
					this.setTool(this.circleTool);
				}
				break;

			case 'v':
				if(stage.controlKey){
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
				}else{
					this.setTool(this.pointerTool);
				}
				break;

			case 's':
				if(stage.controlKey){
					fileManager.save();
				}else{
					this.setTool(this.splineTool);
				}
				break;

			case 'o':
				if(stage.controlKey){
					fileManager.open();
				}
				break;

			case 'n':
				if(stage.controlKey){
					fileManager.newDocument();
				}
				break;

			default:
		}
	}
}

const instance = new ToolManager();
export default instance;


