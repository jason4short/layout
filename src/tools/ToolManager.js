import stage 							from '../core/Stage.js';
import data 							from '../data/Data.js';
import { Shape }						from '../geometry/Geometry.js';
import undoManager						from '../core/UndoManager.js';
import fileManager						from '../core/FileManager.js';
import { AddShapeCommand, AddShapesCommand, GroupCommand, UngroupCommand, MoveCommand, DeleteShapesCommand, ConvertToSymbolCommand, ApplyLayoutCommand }	from '../core/Commands.js';

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
import { FilletTest } 					from "./FilletTest.js";
import { ChamferTool } 					from "./ChamferTool.js";
import { BoxTool } 						from "./BoxTool.js";
import { OppositeCornerEllipseTool } 	from "./OppositeCornerEllipseTool.js";
import { CenterPointEllipseTool } 		from "./CenterPointEllipseTool.js";
import { SplineTool } 					from "./SplineTool.js";
import { ScaleTool } 					from "./ScaleTool.js";
import { MirrorTool } 					from "./MirrorTool.js";
import { RotateTool } 					from "./RotateTool.js";
import { ImageTool } 					from "./ImageTool.js";
import { DimensionTool } 				from "./DimensionTool.js";
import { HorizDimensionTool } 			from "./HorizDimensionTool.js";
import { VertDimensionTool } 			from "./VertDimensionTool.js";
import { AngleDimensionTool } 			from "./AngleDimensionTool.js";
import { TextTool } 					from "./TextTool.js";
import { OutlineTextTool } 				from "./OutlineTextTool.js";
import { PaperTool } 					from "./PaperTool.js";
import { FrameTool } 					from "./FrameTool.js";
import { BoardTool } 					from "./BoardTool.js";
import { SlotTool } 					from "./SlotTool.js";
import { PolygonTool } 					from "./PolygonTool.js";
import { LiveMirrorTool } 				from "./LiveMirrorTool.js";



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
		this.filletTest					= new FilletTest();
		this.chamferTool				= new ChamferTool();
		this.boxTool					= new BoxTool();
		this.oppositeCornerEllipseTool	= new OppositeCornerEllipseTool();
		this.centerPointEllipseTool		= new CenterPointEllipseTool();
		this.splineTool					= new SplineTool();
		this.scaleTool					= new ScaleTool();
		this.mirrorTool					= new MirrorTool();
		this.rotateTool					= new RotateTool();
		this.imageTool					= new ImageTool();
		this.dimensionTool				= new DimensionTool();
		this.horizDimensionTool			= new HorizDimensionTool();
		this.vertDimensionTool			= new VertDimensionTool();
		this.angleDimensionTool			= new AngleDimensionTool();
		this.textTool					= new TextTool();
		this.outlineTextTool			= new OutlineTextTool();
		this.paperTool					= new PaperTool();
		this.frameTool					= new FrameTool();
		this.boardTool					= new BoardTool();
		this.slotTool					= new SlotTool();
		this.polygonTool				= new PolygonTool();
		this.liveMirrorTool				= new LiveMirrorTool();

		// Tool palette configuration: [tool, displayName, shortcut, icon]
		this.toolPaletteConfig = [
			{ category: 'Select' },
			{ tool: this.pointerTool, 				name: 'Pointer', shortcut: 'V', icon: 'pointer' },
			{ tool: this.handTool, 					name: 'Hand', shortcut: 'H', icon: 'hand' },
			{ category: 'Draw' },
			{ tool: this.lineTool, 					name: 'Line', shortcut: 'L', icon: 'line' },
			{ tool: this.boxTool, 					name: 'Box', shortcut: 'B', icon: 'box' },
			{ tool: this.imageTool, 				name: 'Image', shortcut: 'I', icon: 'image' },
			{ tool: this.circleTool,				name: 'Circle', shortcut: 'C', icon: 'circle' },
			{ tool: this.oppositeCornerEllipseTool, name: 'Ellipse', shortcut: 'E', icon: 'ellipse' },
			{ tool: this.centerPointEllipseTool, 	name: 'Ellipse (Center)', shortcut: '4', icon: 'ellipse-center' },
			{ tool: this.splineTool, 				name: 'Spline', shortcut: 'S', icon: 'spline' },
			{ category: 'Arcs' },
			{ tool: this.threePointArcTool, 		name: '3-Point Arc', shortcut: 'A', icon: 'arc-3point' },
			{ tool: this.centerPointArcTool, 		name: 'Center Arc', shortcut: '1', icon: 'arc-center' },
			{ tool: this.tangentPointArcTool, 		name: 'Tangent Arc', shortcut: '3', icon: 'arc-tangent' },
			{ category: 'Primitives' },
			{ tool: this.boardTool, 				name: 'Board', shortcut: 'W', icon: 'board' },
			{ tool: this.slotTool, 					name: 'Slot', shortcut: 'U', icon: 'slot' },
			{ tool: this.polygonTool, 				name: 'Polygon', shortcut: 'G', icon: 'polygon' },
			{ tool: this.liveMirrorTool, 			name: 'Live Mirror', shortcut: 'Z', icon: 'mirror' },
			{ category: 'Modify' },
			{ tool: this.trimTool, 					name: 'Trim', shortcut: 'T', icon: 'trim' },
			{ tool: this.filletTool, 				name: 'Fillet', shortcut: 'F', icon: 'fillet' },
			{ tool: this.filletTest, 				name: 'Fillet Test', shortcut: null, icon: 'fillet' },
			{ tool: this.chamferTool, 				name: 'Chamfer', shortcut: 'K', icon: 'chamfer' },
			{ tool: this.parallelLineTool, 			name: 'Offset', shortcut: 'P', icon: 'parallel' },
			{ tool: this.scaleTool, 				name: 'Scale', shortcut: 'X', icon: 'scale' },
			{ tool: this.mirrorTool, 				name: 'Mirror', shortcut: 'M', icon: 'mirror' },
			{ tool: this.rotateTool, 				name: 'Rotate', shortcut: 'R', icon: 'rotate' },
			{ category: 'Annotate' },
			{ tool: this.dimensionTool, 			name: 'Dimension', shortcut: 'D', icon: 'dimension' },
			{ tool: this.horizDimensionTool, 		name: 'Horiz Dim', shortcut: null, icon: 'dimension_horiz' },
			{ tool: this.vertDimensionTool, 		name: 'Vert Dim', shortcut: null, icon: 'dimension_vert' },
			{ tool: this.angleDimensionTool, 		name: 'Angle Dim', shortcut: null, icon: 'angle-dimension' },
			{ tool: this.textTool, 					name: 'Text', shortcut: 'N', icon: 'text' },
			{ tool: this.outlineTextTool, 			name: 'Outline Text', shortcut: null, icon: 'outline-text' },
			{ category: 'Layout' },
			{ tool: this.paperTool, 				name: 'Paper', shortcut: 'O', icon: 'paper' },
			{ tool: this.frameTool, 				name: 'Frame', shortcut: 'Y', icon: 'frame' },
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
				// Tool button with icon
				const btn = document.createElement('button');
				btn.className = 'tool-btn';
				btn.dataset.toolId = item.tool.constructor.name;
				btn.title = `${item.name} (${item.shortcut})`;

				// Create icon image
				const icon = document.createElement('img');
				icon.src = `src/assets/tools/${item.icon}.svg`;
				icon.alt = item.name;
				icon.className = 'tool-icon';
				btn.appendChild(icon);

				btn.addEventListener('click', () => this.setTool(item.tool));
				palette.appendChild(btn);
			}
		}
	}

	setTool(tool)
	{	
		this.currentTool.deactivate();

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
	

	// determines if the selected tool generates snap points and DA guides during use.
	generateGuides(){
		if(stage.commandKey){
			return false;
		}else {
			return this.currentTool.generateGuides
		}
	}
	

	undo(){
		if(undoManager.undo()){
			stage.render();
		}
	}

	redo(){
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
 
	onKeyDown(e)
	{
		// console.log(e.key);
		
		// debug snap point coords
		if(e.key == 'd'){
			console.log(data.snapPoint.x, data.snapPoint.y)
		}

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

				case 'f':
				case 'F':
					if(stage.shiftKey){
						stage.zoomToFit(true); // Fit selected shapes
					} else {
						stage.zoomToFit(false); // Fit all shapes
					}
					e.preventDefault(); // Prevent browser find
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
						//console.log(`Copied ${copied} shape(s)`);
					}
					break;

				case 'x':
				case 'X':
					const cut = data.cut();
					if(cut > 0){
						//console.log(`Cut ${cut} shape(s)`);
						stage.render();
					}
					break;
	
				case 'v':
					// Check if a single Frame is selected (paste into it)
					const selected = data.getSelected();
					const selectedFrame = selected.length === 1 && selected[0].geometry === Shape.FRAME
						? selected[0] : null;

					// Calculate view center in world coordinates
					const centerX = stage.canvas.clientWidth / 2;
					const centerY = stage.canvas.clientHeight / 2;
					const worldCenter = stage.screenToWorld(centerX, centerY);

					const shapesToPaste = data.preparePaste(worldCenter.x, worldCenter.y);
					if(shapesToPaste.length > 0){
						// Temporarily set activeFrameId so AddShapesCommand handles coord conversion
						const prevActiveFrame = data.activeFrameId;
						if (selectedFrame) {
							data.activeFrameId = selectedFrame.id;
						}

						undoManager.execute(new AddShapesCommand(shapesToPaste));

						// Restore previous activeFrameId
						data.activeFrameId = prevActiveFrame;

						// Select pasted shapes (keep frame selected too for continued pasting)
						for(const shape of shapesToPaste){
							shape.selected = true;
						}
						stage.render();
					}
					break;

				case 'd':
				case 'D':
					// Cmd+D = Transform Again (duplicate + apply last transform)
					if(data.lastTransform && data.getSelected().length > 0){
						data.copy();
						// Use preparePaste with offset from centroid
						const targetX = data.clipboardCentroid.x + data.lastTransform.dx;
						const targetY = data.clipboardCentroid.y + data.lastTransform.dy;
						const clones = data.preparePaste(targetX, targetY);
						if(clones.length > 0){
							// When editing a group, assign clones to that group
							if(data.editingGroupId){
								for(const clone of clones){
									clone.groupId = data.editingGroupId;
								}
							}
							undoManager.execute(new AddShapesCommand(clones));
							data.selectNone();
							for(const clone of clones) clone.selected = true;
							stage.render();
						}
					}
					break;

				case 's':
					fileManager.save();
					break;
	
				case 'o':
					fileManager.confirmIfDirty(() => fileManager.open());
					break;

				case 'n':
					fileManager.confirmIfDirty(() => fileManager.newDocument());
					break;

				case 'g':
				case 'G':
					if(stage.shiftKey){
						// Cmd+Shift+G = Ungroup the root group(s) of selection
						const selectedForUngroup = data.getSelected();
						const groupsToUngroup = new Set();
						for(const shape of selectedForUngroup){
							if(shape.groupId){
								// Find the root group, not the direct group
								const rootGroupId = data.getRootGroupId(shape.groupId);
								groupsToUngroup.add(rootGroupId);
							}
						}
						if(groupsToUngroup.size > 0){
							undoManager.execute(new UngroupCommand(groupsToUngroup));
							console.log('Ungrouped selection');
							stage.render();
						}
					} else {
						// Cmd+G = Group selected shapes
						const selected = data.getSelected();
						if(selected.length > 1){
							undoManager.execute(new GroupCommand(selected));
							console.log('Created group');
							stage.render();
						}
					}
					break;

				case '7':
					// Cmd+7 = Convert selection to symbol source
					// The shapes become a symbol source group - Option+drag to create instances
					const selectedForSymbol = data.getSelected();
					if(selectedForSymbol.length > 0){
						const name = prompt('Symbol name:', 'My Symbol');
						if(name){
							undoManager.execute(new ConvertToSymbolCommand(selectedForSymbol, name));
							console.log(`Created symbol source "${name}" with ${selectedForSymbol.length} shape(s). Option+drag to create instances.`);
							stage.render();
						}
					}
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
				// First let the tool handle escape (may commit work)
				this.currentTool.reset();
				
				// Exit group editing mode if active
				if(data.isEditingGroup()){
					data.exitGroup();
				}
				// Then switch to pointer if not already there
				if(this.currentTool !== this.pointerTool){
					this.setTool(this.pointerTool);
				}
				
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

			case 'ArrowUp':
			case 'ArrowDown':
			case 'ArrowLeft':
			case 'ArrowRight':
				this.nudgeSelection(e.key, stage.shiftKey);
				e.preventDefault();
				break;
		}
	}

	// Nudge selected shapes by arrow keys
	// In auto-layout groups, reorder shapes instead of nudging
	nudgeSelection(key, shift) {

		const selected = data.getSelected();
		if (selected.length === 0) return;

		// Check for auto-layout group - reorder or ignore (no nudging)
		if (data.editingGroupId) {
			const group = data.groups.get(data.editingGroupId);
			if (group && group.autoLayout && group.layout) {
				// Only allow reordering with single selection
				if (selected.length === 1) {
					const mode = group.layout.mode;
					const isReorderKey = (mode === 'column' && (key === 'ArrowUp' || key === 'ArrowDown')) ||
					                     (mode === 'row' && (key === 'ArrowLeft' || key === 'ArrowRight'));

					if (isReorderKey) {
						const direction = (key === 'ArrowUp' || key === 'ArrowLeft') ? -1 : 1;
						this.reorderInAutoLayout(selected[0], group, direction);
					}
				}
				// Disable nudge in auto-layout groups
				return;
			}
		}

		// Standard nudge behavior (only outside auto-layout)
		const amount = shift ? 10 : 1;
		let dx = 0, dy = 0;

		switch (key) {
			case 'ArrowUp':    dy = -amount; break;
			case 'ArrowDown':  dy = amount;  break;
			case 'ArrowLeft':  dx = -amount; break;
			case 'ArrowRight': dx = amount;  break;
		}

		// Build move data for undo
		const moveData = [];

		// nudge selected points
		for (const shape of selected) {
			const pois = shape.getSnapPOIs();
			const selectableIndices = data.getSelectableIndices(shape);
			for (const index of selectableIndices) {
				const poi = pois[index];
				if (poi) {
					moveData.push({
						shape,
						index,
						oldX: poi.x,
						oldY: poi.y,
						newX: poi.x + dx,
						newY: poi.y + dy
					});
				}
			}
		}

		// Apply the move
		for (const shape of selected) {
			shape.translate(dx, dy);
		}

		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes(selected);

		// Record for undo
		undoManager.record(new MoveCommand(moveData));

		stage.render();
	}

	// Reorder a shape within an auto-layout group
	// direction: -1 = move earlier (up/left), 1 = move later (down/right)
	reorderInAutoLayout(shape, group, direction) {
		const mode = group.layout.mode;
		const isVertical = mode === 'column';

		// Get all shapes in this group, sorted by position
		const groupShapes = data.getDirectGroupShapes(data.editingGroupId);
		const sorted = [...groupShapes].sort((a, b) => {
			return isVertical
				? a.bounds.y - b.bounds.y
				: a.bounds.x - b.bounds.x;
		});

		// Find current index
		const currentIndex = sorted.indexOf(shape);
		if (currentIndex === -1) return false;

		// Calculate target index
		const targetIndex = currentIndex + direction;
		if (targetIndex < 0 || targetIndex >= sorted.length) return false;

		// Get the shape to swap with
		const swapShape = sorted[targetIndex];

		// Swap positions
		const shapePos = isVertical ? shape.bounds.y : shape.bounds.x;
		const swapPos = isVertical ? swapShape.bounds.y : swapShape.bounds.x;

		if (isVertical) {
			const dy = swapPos - shapePos;
			shape.translate(0, dy);
			swapShape.translate(0, -dy);
		} else {
			const dx = swapPos - shapePos;
			shape.translate(dx, 0);
			swapShape.translate(-dx, 0);
		}

		// Apply layout to clean up positions
		undoManager.execute(new ApplyLayoutCommand(data.editingGroupId));
		stage.render();

		return true;
	}
	
	
	onKeyUp(e)
	{
		// Handle command key release - deactivate strokeTool and restore cursor
		if(e.key == 'Meta'){
			if(this.strokeTool.active){
				this.strokeTool.deactivate();
			}
		}

		if(!(stage.commandKey && stage.spaceKey && stage.shiftKey)){
			this.currentTool.updateCursor();
		}
	}
}

const instance = new ToolManager();
export default instance;


