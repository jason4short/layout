import stage 					from '../core/Stage.js';
import data 					from '../data/Data.js';
	
import { LineTool } 			from "./LineTool.js";
import { HandTool } 			from "./HandTool.js";
import { PointerTool } 			from "./PointerTool.js";
import { StrokeTool } 			from "./StrokeTool.js";
import { CircleTool } 			from "./CircleTool.js";
import { ParallelLineTool }		from "./ParallelLineTool.js";
import { TrimTool } 			from "./TrimTool.js";
import { ThreePointArcTool } 	from "./ThreePointArcTool.js";
import { CenterPointArcTool } 	from "./CenterPointArcTool.js";
import { TangentPointArcTool } 	from "./TangentPointArcTool.js";
import { FilletTool } 			from "./FilletTool.js";
import { ChamferTool } 			from "./ChamferTool.js";
import { BoxTool } 				from "./BoxTool.js";
import { OppositeCornerEllipseTool } from "./OppositeCornerEllipseTool.js";
import { CenterPointEllipseTool } 	from "./CenterPointEllipseTool.js";



//import Event from "./core/Events";
//import flash.events.MouseEvent;


export class ToolManager
{
 	constructor(){

		// Bind handlers so `this` stays the Stage instance
		this.onKeyDown 			= this.onKeyDown.bind(this);
		this.onKeyUp 			= this.onKeyUp.bind(this);

		window.addEventListener('keydown', 			this.onKeyDown, 	{ capture: true });
		window.addEventListener('keyup', 			this.onKeyUp, 		{ capture: true });

		this.stroke	 			= false;

		// keep tools handy
		this.lineTool	 			= new LineTool();
		this.circleTool 			= new CircleTool();
		this.strokeTool 			= new StrokeTool();
		this.handTool				= new HandTool();
		this.pointerTool			= new PointerTool();
		this.parallelLineTool		= new ParallelLineTool();
		this.trimTool				= new TrimTool();
		this.threePointArcTool		= new ThreePointArcTool();
		this.centerPointArcTool		= new CenterPointArcTool();
		this.tangentPointArcTool	= new TangentPointArcTool();
		this.filletTool				= new FilletTool();
		this.chamferTool			= new ChamferTool();
		this.boxTool				= new BoxTool();
		this.oppositeCornerEllipseTool	= new OppositeCornerEllipseTool();
		this.centerPointEllipseTool		= new CenterPointEllipseTool();

		// Tool palette configuration: [tool, displayName, shortcut]
		this.toolPaletteConfig = [
			{ category: 'Select' },
			{ tool: this.pointerTool, name: 'Pointer', shortcut: 'V' },
			{ category: 'Draw' },
			{ tool: this.lineTool, name: 'Line', shortcut: 'L' },
			{ tool: this.boxTool, name: 'Box', shortcut: 'B' },
			{ tool: this.circleTool, name: 'Circle', shortcut: 'C' },
			{ tool: this.oppositeCornerEllipseTool, name: 'Ellipse', shortcut: 'E' },
			{ tool: this.centerPointEllipseTool, name: 'Ellipse (Center)', shortcut: '4' },
			{ category: 'Arcs' },
			{ tool: this.threePointArcTool, name: '3-Point Arc', shortcut: 'A' },
			{ tool: this.centerPointArcTool, name: 'Center Arc', shortcut: '1' },
			{ tool: this.tangentPointArcTool, name: 'Tangent Arc', shortcut: '3' },
			{ category: 'Modify' },
			{ tool: this.trimTool, name: 'Trim', shortcut: 'T' },
			{ tool: this.filletTool, name: 'Fillet', shortcut: 'F' },
			{ tool: this.chamferTool, name: 'Chamfer', shortcut: 'K' },
			{ tool: this.parallelLineTool, name: 'Parallel', shortcut: 'P' },
		];

		this.buildToolPalette();
		this.initTool(this.pointerTool);
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

	initTool(tool){
		this.currentTool 	= tool;
		this.currentTool.begin();
		this.updateToolNameDisplay();
	}

	setTool(tool)
	{
		
		this.currentTool.exit();

		if(tool == this.strokeTool){
			this.strokeTool.begin();
		}else{
			data.clearGuides();
			data.selectNone();
			this.currentTool = tool;
			this.currentTool.begin();
		}
		
		stage.generateGuides = this.currentTool.generateGuides;
		this.updateToolNameDisplay();
		stage.render();
	}

	// Display current tool name in the toolbar and update palette active state
	updateToolNameDisplay(){
		const toolNameEl = document.getElementById('currentToolName');
		if(toolNameEl && this.currentTool){
			// Convert "FilletTool" to "Fillet Tool"
			const name = this.currentTool.constructor.name
				.replace(/Tool$/, '')
				.replace(/([A-Z])/g, ' $1')
				.trim();
			toolNameEl.textContent = name;
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

	deleteSelected()
	{
		if(data.deleteSelected() > 0){
			stage.render();
		}
	}

	onKeyDown(e)
	{
		if(stage.commandKey){
			this.stroke = true;
			this.setTool(this.strokeTool);
		}
	}
	
	onKeyUp(e)
	{
		if(this.stroke){
			this.stroke = false;
			this.strokeTool.exit();
			this.setTool(this.currentTool);
		}else{
		
			switch(e.key){
				case 'c':
				this.setTool(this.circleTool);
				break;
			
				case 'l':
				this.setTool(this.lineTool);
				break;
				
				case 'v':
				this.setTool(this.pointerTool);
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

// 				case '4':
// 				this.setTool(this.centerPointEllipseTool);
// 				break;

				case 'Delete':
				case 'Backspace':
				this.deleteSelected();
				break;

				default:
			}
		}
	}	
}

