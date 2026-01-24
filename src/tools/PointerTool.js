import {Tool} 				from "./Tool.js";
import {Rectangle} 			from '../geometry/Rectangle.js';
import {Shape} 				from '../geometry/Geometry.js';
import {SymbolInstance}		from '../geometry/Symbol.js';
import {Frame}				from '../geometry/Frame.js';

import stage 				from '../core/Stage.js';
import toolManager			from './ToolManager.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';

import {AddShapesCommand,
		MoveCommand} 	from '../core/Commands.js';

export class PointerTool extends Tool
{
	// private members

	constructor()
	{
		super();

		this.name 	= "Pointer";
		this.usage 	= "Click to select. Drag to marquee or move. Option+drag to clone.";

		this.generateGuides 	= false; // Enable snapping for move operations

		// Drag state
		this.dragStart			= null;
		this.isDragging			= false;
		this.dragThreshold		= 5; // pixels to differentiate click from drag
		this.marqueeRect		= null;

		// Move state
		this.isMoving			= false;
		this.isCloning			= false; // Option+drag clones instead of moves
		this.moveTarget			= null; // {type: 'shape'|'point', shape, pointIndex?}
		this.moveStart			= null; // Snapped position when move started
		this.originalPositions	= []; // Store original positions for delta calc
		this.clonedShapes		= []; // Shapes created during clone operation

		// Double-click tracking
		this.lastClickTime		= 0;
		this.lastClickPos		= null;
		this.doubleClickThreshold = 300; // ms
		this.doubleClickDistance = 5; // pixels

		this.onMouseDown 		= this.onMouseDown.bind(this);
		this.onMouseMove 		= this.onMouseMove.bind(this);
		this.onMouseUp 			= this.onMouseUp.bind(this);
	}


	begin(){
		data.resetSnaps();
		this.updateCursor();
	}

	deactivate(){
		this.resetDrag();
	}
	
	updateCursor(){
		stage.setCursor('default');
	}
	
	reset(){
	}

	resetDrag(){
		// state
		this.isDragging 			= false;
		this.isMoving 				= false;
		this.isCloning 				= false;

		// items
		this.dragStart 				= null;
		this.moveTarget 			= null;
		this.moveStart 				= null;
		this.marqueeRect 			= null;
		stage.renderer.marqueeRect 	= null;
		this.originalPositions 		= [];
		this.clonedShapes 			= [];
		this.cornerResize 			= null;
		this.frameChildOriginals 	= null;

		data.clearExcludeFromSnap();
		data.resetSnaps();
		data.clearGuides();
	}


	distanceTo(a, b){
		return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
	}

	// Exclude selected shapes from snapping during move
	setSnapExclusions(){
		const shapesToExclude = [];

		// Add whole-shape selections
		for(const shape of data.getSelected()){
			shapesToExclude.push(shape);
		}

		// Add shapes with partial point selections
		for(const [shape] of data.getSelectedPoints().entries()){
			if(!shapesToExclude.includes(shape)){
				shapesToExclude.push(shape);
			}
		}

		data.setExcludeFromSnap(shapesToExclude);
	}

	// Clone selected shapes and switch selection to clones
	// Special handling: Option+drag Frame (symbol source) creates instance, Option+drag instance creates another instance
	cloneSelectedShapes(){
		this.isCloning = true;
		this.clonedShapes = [];

		const selected = data.getSelected();

		// Check if we're dragging a Frame (symbol source)
		const selectedFrames = selected.filter(s => s.geometry === Shape.FRAME && s.isSymbolSource);

		if(selectedFrames.length === 1){
			const frame = selectedFrames[0];
			// Create a symbol instance at the frame's position
			const instance = new SymbolInstance([frame.id, frame.x, frame.y]);
			data.addShape(instance);
			instance.selected = true;
			this.clonedShapes.push(instance);

			// Deselect the frame
			frame.selected = false;

			// Update moveTarget to the new instance
			this.moveTarget = { type: 'shape', shape: instance };
			return;
		}

		// Check if we're dragging symbol instances - create new instances
		const instancesToCopy = selected.filter(s => s.geometry === Shape.SYMBOL);
		const nonInstances = selected.filter(s => s.geometry !== Shape.SYMBOL && s.geometry !== Shape.FRAME);

		// Create new instances for each dragged instance
		for(const instance of instancesToCopy){
			const newInstance = new SymbolInstance([
				instance.sourceFrameId,
				instance.x,
				instance.y
			]);
			data.addShape(newInstance);
			newInstance.selected = true;
			this.clonedShapes.push(newInstance);
			instance.selected = false;
		}

		// Handle non-instance, non-frame shapes with normal cloning
		if(nonInstances.length > 0){
			// Build mapping from old groupIds to new groupIds
			const groupIdMap = new Map();
			for(const shape of nonInstances){
				if(shape.groupId && !groupIdMap.has(shape.groupId)){
					// Walk up the group hierarchy to capture all ancestor groups
					let currentId = shape.groupId;
					while(currentId && !groupIdMap.has(currentId)){
						const newId = `group_${data._nextGroupId++}`;
						groupIdMap.set(currentId, newId);
						const group = data.groups.get(currentId);
						currentId = group ? group.parentId : null;
					}
				}
			}

			// Create new groups with remapped parentIds
			for(const [oldId, newId] of groupIdMap){
				const oldGroup = data.groups.get(oldId);
				const newParentId = oldGroup && oldGroup.parentId ? groupIdMap.get(oldGroup.parentId) : null;
				const layout = oldGroup && oldGroup.layout
					? { ...oldGroup.layout }
					: { mode: 'none', gap: 0, alignment: 'start', distribution: 'none' };
				data.groups.set(newId, { id: newId, parentId: newParentId, layout });
			}

			// Clone each non-instance shape with remapped groupId
			// Note: Shapes in frames are NOT cloned here - they're part of the symbol source
			for(const shape of nonInstances){
				if(shape.frameId) continue;  // Skip shapes that belong to frames

				const clone = shape.clone();
				if(clone.groupId){
					clone.groupId = groupIdMap.get(clone.groupId) || null;
				}
				data.addShape(clone);
				clone.selected = true;
				this.clonedShapes.push(clone);
				shape.selected = false;
			}
		}

		// Update moveTarget to reference a cloned shape
		if(this.moveTarget && this.clonedShapes.length > 0){
			// Find the clone corresponding to the original target
			const originalIndex = selected.indexOf(this.moveTarget.shape);
			if(originalIndex >= 0 && originalIndex < this.clonedShapes.length){
				this.moveTarget.shape = this.clonedShapes[originalIndex];
			} else {
				// Default to first cloned shape
				this.moveTarget.shape = this.clonedShapes[0];
			}
		}
	}

	// Store original positions of all selected items
	// Shapes in frames store LOCAL coords (relative to frame)
	// When a frame moves, its children move automatically
	storeOriginalPositions(){
		this.originalPositions = [];

		// If corner resize, only store that corner
		if(this.cornerResize){
			const shape = this.cornerResize.shape;
			const pois = shape.getSnapPOIs();
			const poi = pois[this.cornerResize.cornerIndex];
			if(poi){
				this.originalPositions.push({
					x: poi.x,
					y: poi.y,
					shape: shape,
					index: this.cornerResize.cornerIndex
				});
			}
			return;
		}

		// Store positions for whole-shape selections
		for(const shape of data.getSelected()){
			const selectableIndices = data.getSelectableIndices(shape);

			// For shapes with no selectable indices (like symbol instances),
			// store with index=-1 to indicate whole-shape move via translate()
			if(selectableIndices.length === 0){
				this.originalPositions.push({
					x: shape.bounds.x,
					y: shape.bounds.y,
					shape,
					index: -1  // Special marker for whole-shape translation
				});
				continue;
			}

			const pois = shape.getSnapPOIs();
			for(const index of selectableIndices){
				const poi = pois[index];
				if(poi){
					this.originalPositions.push({
						x: poi.x,
						y: poi.y,
						shape,
						index
					});
				}
			}
		}

		// Store positions for partial point selections
		for(const [shape, indices] of data.getSelectedPoints().entries()){
			const pois = shape.getSnapPOIs();
			for(const index of indices){
				const poi = pois[index];
				if(poi){
					this.originalPositions.push({
						x: poi.x,
						y: poi.y,
						shape,
						index
					});
				}
			}
		}
	}

	onMouseDown(e)
	{
		this.generateGuides 	= true; // Enable snapping for move operations
	
		data.resetSnaps();

		// Check for double-click on text to edit
		const now = Date.now();
		const clickPos = { x: data.snapPoint.x, y: data.snapPoint.y };

		if(this.lastClickPos){
			const dx = clickPos.x - this.lastClickPos.x;
			const dy = clickPos.y - this.lastClickPos.y;
			const dist = Math.sqrt(dx * dx + dy * dy) * stage.zoom;

			if(now - this.lastClickTime < this.doubleClickThreshold && dist < this.doubleClickDistance){
				// Double-click detected - check if on text
				const textShape = this.findTextAtPoint(clickPos);
				if(textShape){
					this.editText(textShape, clickPos);
					this.lastClickTime = 0;
					this.lastClickPos = null;
					return;
				}

				// Double-click on grouped shape - enter group for editing
				const clickedShape = data.getTargetShape();
				if(clickedShape && clickedShape.groupId){
					// If already editing a group, go deeper into child group
					if(data.isEditingGroup()){
						// Check if clicking on a child group - enter that
						if(data.isChildGroupOfEditingGroup(clickedShape.groupId)){
							data.enterGroup(clickedShape.groupId);
							stage.render();
							this.lastClickTime = 0;
							this.lastClickPos = null;
							return;
						}
					} else {
						// Enter the root group for editing
						const rootId = data.getRootGroupId(clickedShape.groupId);
						data.enterGroup(rootId);
						stage.render();
						this.lastClickTime = 0;
						this.lastClickPos = null;
						return;
					}
				}
			}
		}

		this.lastClickTime = now;
		this.lastClickPos = clickPos;

		// Cmd+click toggles control point visibility
		if(stage.commandKey){
			data.toggleControlPoints();
			stage.render();
			return;
		}

		// Store both world and screen coords
		this.dragStart = {x: data.snapPoint.x, y: data.snapPoint.y, screenX: e.screenX, screenY: e.screenY};
		this.isDragging = false;
		this.isMoving = false;

		// Check if clicking on a shape
		this.moveTarget = data.getTargetShape();

		// Check if clicking on a control point for resizing FIRST
		// For Image: corners are POI indices 0-3, center is 4
		// For Ellipse: center is 0, corner is 1, axis points are 2-5
		// For Circle: center is 0, radius point is 1
		this.cornerResize = null;

		if(this.moveTarget && data.snapPoint.poiIndex !== undefined) {
			const geo = this.moveTarget.geometry;
			const poi = data.snapPoint.poiIndex;

			// Ellipse control points (0 and 1)
			// In 'center' mode: 0=center (move), 1=corner (resize)
			// In 'corners' mode: 0=corner1 (resize), 1=corner2 (resize)
			if(geo === Shape.ELLIPSE && (poi === 0 || poi === 1)) {
				// For corners mode, both are resize points
				// For center mode, 0 is move (handled by normal move), 1 is resize
				if(this.moveTarget.controlMode === 'corners' || poi === 1) {
					this.cornerResize = { shape: this.moveTarget, cornerIndex: poi };
				}
			}
			// Circle radius control point (1)
			else if(geo === Shape.CIRCLE && poi === 1) {
				this.cornerResize = { shape: this.moveTarget, cornerIndex: poi };
			}

			// Select the shape for control point resize
			if(this.cornerResize && !this.moveTarget.selected){
				data.selectNone();
				this.moveTarget.selected = true;
			}
		}

		// Select on mouse down (if clicking on a shape, but not a resize control point)
		if(this.moveTarget && !this.cornerResize){
			const shape = this.moveTarget;
			const clickingOnPOI = data.snapPoint.poiIndex !== undefined;
			const shapeAlreadySelected = shape.selected || data.getSelectedPoints().has(shape);

			// If there's a partial point selection, check if we should clear it
			const selectedPoints = data.getSelectedPoints();
			if(selectedPoints.size > 0){
				if(!selectedPoints.has(shape)){
					// Clicking on a different shape - clear partial selection
					data.selectedPoints.clear();
				} else {
					// Clicking on the same shape - check if clicking on a selected POI
					const selectedIndices = selectedPoints.get(shape);
					const clickedIndex = data.snapPoint.poiIndex;
					if(clickedIndex === undefined || !selectedIndices.has(clickedIndex)){
						// Not clicking on a selected POI - clear partial and select whole shape
						data.selectedPoints.clear();
						shape.selected = true;
					}
				}
			}

			// If shape is already selected and clicking on a POI, allow point dragging
			// (don't change selection - just let the drag happen)
			if(shapeAlreadySelected && clickingOnPOI){
				// Don't change selection - point drag will be handled by move logic
				stage.render();
			} else if(stage.shiftKey){
				// Shift+click toggles selection (including group)
				if(shape.groupId){
					const rootId = data.getRootGroupId(shape.groupId);
					const groupShapes = data.getGroupShapes(rootId);
					const shouldSelect = !shape.selected;
					for(const s of groupShapes){
						if(!s.locked) s.selected = shouldSelect;
					}
				} else {
					shape.selected = !shape.selected;
				}
				stage.render();
			} else if(!shapeAlreadySelected){
				// Click on unselected shape - select it (deselect others)
				data.selectNone();

				// Check if we're editing a group
				if(data.isEditingGroup()){
					// When editing a group, select items at the editing level
					if(data.isDirectChildOfEditingGroup(shape)){
						// Direct child shape - select just this shape
						shape.selected = true;
					} else if(shape.groupId && data.isChildGroupOfEditingGroup(shape.groupId)){
						// Shape in a child group - select the whole child group
						const childGroupShapes = data.getGroupShapes(shape.groupId);
						for(const s of childGroupShapes){
							if(!s.locked) s.selected = true;
						}
					} else {
						// Clicked outside the editing group - exit editing mode
						data.exitGroup();
						// Then do normal selection
						if(shape.groupId){
							data.selectGroup(shape);
						} else {
							shape.selected = true;
						}
					}
				} else if(shape.groupId){
					// Not editing - select entire group hierarchy
					data.selectGroup(shape);
				} else {
					shape.selected = true;
				}
				stage.render();
			}
			// If already selected (not on POI), keep it selected (for move operation)
		} else if(!stage.shiftKey) {
			// No target shape (clicked on empty space or intersection)
			// Clear selection so marquee can start fresh
			data.selectNone();
			stage.render();
		}

		// create a guide reference from initial point
		if(this.moveTarget)
			draftingAssistant.setCurrentSnapPoint(data.snapPoint, true);
	}

	onMouseMove(e){
		if(!this.dragStart) return;

		// Calculate distance in screen space for threshold check
		const screenDx = e.screenX - this.dragStart.screenX;
		const screenDy = e.screenY - this.dragStart.screenY;
		const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

		// World-space delta for marquee
		const dx = e.x - this.dragStart.x;
		const dy = e.y - this.dragStart.y;

		// Check if we've moved past the drag threshold (screen pixels)
		if(!this.isDragging && !this.isMoving && screenDist > this.dragThreshold){
			if(this.moveTarget){
				// Start move operation
				this.isMoving = true;
				// Store the snap point when move started
				const snap = draftingAssistant.getCurrentSnapPoint();
				this.moveStart = {x: snap.x, y: snap.y};

				// Option+drag = clone shapes (but not for corner resize)
				if(stage.optionKey && !this.cornerResize){
					this.cloneSelectedShapes();
				}

				this.storeOriginalPositions();
				// Exclude selected shapes from snapping
				this.setSnapExclusions();
			} else {
				// Start marquee selection
				this.isDragging = true;
				if(!stage.shiftKey){
					data.selectNone();
				}
			}
		}

		if(this.isMoving){
			// Move selected items (uses snap points, not dx/dy)
			this.updateMove();
			stage.render();

		} else if(this.isDragging){
			// Update marquee rectangle (world coords)
			this.marqueeRect = new Rectangle(
				Math.min(this.dragStart.x, e.x),
				Math.min(this.dragStart.y, e.y),
				Math.abs(dx),
				Math.abs(dy)
			);
			stage.renderer.marqueeRect = this.marqueeRect;
			stage.render();
		}
	}

	updateMove(){
		if(this.originalPositions.length === 0) return;

		// Get current snap point (already set by Stage.onMouseMove)
		const snapPt = draftingAssistant.getCurrentSnapPoint();

		// Calculate delta from where we started dragging (WORLD space)
		const worldDx = snapPt.x - this.moveStart.x;
		const worldDy = snapPt.y - this.moveStart.y;

		// Find which frames are being moved (their children DON'T need separate movement)
		// When a frame moves, its children stay in LOCAL coords - they move with the frame automatically
		const movingFrameIds = new Set();
		for(const original of this.originalPositions){
			if(original.shape.geometry === Shape.FRAME){
				movingFrameIds.add(original.shape.id);
			}
		}

		// Apply delta to all stored original positions
		for(const original of this.originalPositions){
			const shape = original.shape;

			// Skip shapes whose parent frame is also being moved
			// (they'll move automatically since they store LOCAL coords)
			if(shape.frameId && movingFrameIds.has(shape.frameId)){
				continue;
			}

			// For shapes inside frames, convert world delta to local delta
			let dx = worldDx;
			let dy = worldDy;
			if(shape.frameId){
				const frame = data.getFrame(shape.frameId);
				if(frame){
					const localDelta = frame.worldToLocalDelta(worldDx, worldDy);
					dx = localDelta.x;
					dy = localDelta.y;
				}
			}

			const newX = original.x + dx;
			const newY = original.y + dy;

			if(original.index === -1){
				// Whole-shape translation (for symbol instances, frames, etc.)
				const currentX = shape.bounds.x;
				const currentY = shape.bounds.y;
				shape.translate(newX - currentX, newY - currentY);
			} else {
				shape.updateControlPoint(original.index, newX, newY);
			}
		}
	}

	onMouseUp(e){
		this.generateGuides 	= false; // Enable snapping for move operations
		data.resetSnaps();
		if(this.isMoving){
			// Move operation complete - rebuild POI cache
			data.rebuildPOIs();

			// Recalculate intersections for moved shapes
			// Note: When frames move, their children move automatically (local coords)
			// so we need to recalculate intersections for frame children too
			const movedShapes = new Set(this.originalPositions.map(p => p.shape));

			// Add frame children to movedShapes for intersection recalc
			for(const orig of this.originalPositions){
				if(orig.shape.geometry === Shape.FRAME){
					const frameChildren = data.getFrameShapes(orig.shape.id);
					for(const child of frameChildren){
						movedShapes.add(child);
					}
				}
			}

			data.recalculateIntersectionsForShapes([...movedShapes]);

			// Update any angle dimensions that depend on moved shapes
			data.updateDependentDimensions([...movedShapes]);

			if(this.isCloning && this.clonedShapes.length > 0){
				// Record clone command for undo (shapes already added)
				undoManager.record(new AddShapesCommand(this.clonedShapes));

			} else if(this.originalPositions.length > 0){
				// Record move command for undo
				// Shapes in frames store LOCAL coords - MoveCommand handles this

				const moveData = this.originalPositions.map(orig => {
					let newX, newY;
					if(orig.index === -1){
						// Whole shape translation - use bounds position
						newX = orig.shape.bounds.x;
						newY = orig.shape.bounds.y;
					} else {
						// Control point move - use POI position
						const pois = orig.shape.getSnapPOIs();
						const currentPos = pois[orig.index];
						newX = currentPos.x;
						newY = currentPos.y;
					}

					return {
						shape: orig.shape,
						index: orig.index,
						oldX: orig.x,
						oldY: orig.y,
						newX: newX,
						newY: newY
					};
				});

				if(moveData.length > 0){
					undoManager.record(new MoveCommand(moveData));
				}
			}
		} else if(this.isDragging && this.marqueeRect){
			// Finish marquee selection
			data.selectByMarquee(this.marqueeRect, stage.shiftKey);
			this.marqueeRect = null;

		} else if(this.dragStart && !this.isDragging && !this.isMoving && !this.moveTarget){
			// Click on empty space (no shape) - deselect all and exit group editing
			if(!stage.shiftKey){
				data.selectNone();
				data.exitGroup();
			}
		}

		this.resetDrag();
		this.updateActiveFrame();
		stage.render();
	}

	// Update active frame based on selection
	// If exactly one Frame is selected, it becomes active for drawing
	updateActiveFrame(){
		const selected = data.getSelected();
		const selectedFrames = selected.filter(s => s.geometry === Shape.FRAME);

		if(selectedFrames.length === 1){
			data.setActiveFrame(selectedFrames[0].id);
		} else {
			data.clearActiveFrame();
		}
	}

	// Get the current marquee rect for rendering
	getMarqueeRect(){
		return this.marqueeRect;
	}

	findTextAtPoint(point){
		for(const shape of data.shapes){
			if(shape.geometry === Shape.TEXT){
				const hit = shape.getGeoSnap(point, null, 5);
				if(hit){
					return shape;
				}
			}
		}
		return null;
	}

	editText(textShape, clickPos){
		// Switch to text tool and start editing
		toolManager.setTool(toolManager.textTool);

		// Set up the text tool to edit this shape
		const textTool = toolManager.textTool;
		textTool.text = textShape;
		textTool.cursorPos = textTool.getCursorPosFromClick(textShape, clickPos);
		textTool.isEditingExisting = true;

		// Remove from shapes and add to temp
		data.deleteShape(textShape);
		data.addTempShape(textShape);

		textTool.state = 1; // STATE.EDITING
		textTool.startCursorBlink();
		stage.render();
	}

}
