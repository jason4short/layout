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
		this.lineTool	 		= new LineTool();
		this.circleTool 		= new CircleTool();
		this.strokeTool 		= new StrokeTool();
		this.handTool			= new HandTool();
		this.pointerTool		= new PointerTool();
		this.parallelLineTool	= new ParallelLineTool();
		this.trimTool			= new TrimTool();
		this.threePointArcTool		= new ThreePointArcTool();
		this.centerPointArcTool		= new CenterPointArcTool();
		this.tangentPointArcTool	= new TangentPointArcTool();
		this.filletTool				= new FilletTool();
		this.chamferTool			= new ChamferTool();

		this.initTool(this.pointerTool);
	}
	
	/** Redraw everything. */
	render(){this.renderer.draw();}
	
    
	initTool(tool){
		this.currentTool 	= tool;
		this.currentTool.begin();
	}
	
	setTool(tool)
	{
		data.clearGuides();

		this.currentTool.exit();

		if(tool == this.strokeTool){
			this.strokeTool.begin();
		}else{
			this.currentTool = tool;
			this.currentTool.begin();
		}
		stage.toolSnaps = this.currentTool.willSnap;
		stage.render();
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

				case '1':
				this.setTool(this.centerPointArcTool);
				break;

				case '2':
				this.setTool(this.threePointArcTool);
				break;

				case '3':
				this.setTool(this.tangentPointArcTool);
				break;

				case 'f':
				this.setTool(this.filletTool);
				break;

				case 'k':
				this.setTool(this.chamferTool);
				break;

				case 'Delete':
				case 'Backspace':
				this.deleteSelected();
				break;

				default:
			}
		}
	}	
}

