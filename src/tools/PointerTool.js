import {Tool} 				from "./Tool.js";
import {Rectangle} 			from '../geometry/Rectangle.js';
import {Shape} 				from '../geometry/Geometry.js';

import { DoubleClick } 		from '../core/DoubleClick.js';

import stage 				from '../core/Stage.js';
import toolManager			from './ToolManager.js';
import data 				from '../data/Data.js';
import undoManager			from '../core/UndoManager.js';
import draftingAssistant 	from '../geometry/DraftingAssistant.js';

import {AddShapesCommand,
		MoveCommand,
		ResizeAutoLayoutGroupCommand,
		ApplyLayoutCommand} 	from '../core/Commands.js';
import { calculateLayout } from '../core/LayoutEngine.js';

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
		this.doubleClick		= new DoubleClick();

		// Paper drag state (handled separately from geometry)
		this.paperTarget		= null;  // Paper being dragged
		this.paperDragStart		= null;  // {screenX, screenY} when drag started 

		// Double-click tracking
// 		this.lastClickTime		= 0;
// 		this.lastClickPos		= null;
// 		this.doubleClickThreshold = 300; // ms
// 		this.doubleClickDistance = 5; // pixels

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
		this.groupResize 			= null;
		this.frameChildOriginals 	= null;

		// Paper state
		this.paperTarget 			= null;
		this.paperDragStart 		= null;

		data.clearExcludeFromSnap();
		data.resetSnaps();
		data.clearGuides();
	}

	// Check if screen coords hit a paper label
	// Returns the Paper object if hit, null otherwise
	getPaperAtScreen(screenX, screenY){
		for(const shape of data.shapes){
			if(shape.geometry === Shape.PAPER && shape.hitTestLabel(screenX, screenY)){
				return shape;
			}
		}
		return null;
	}


	distanceTo(a, b){
		return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
	}

	// Check if clicking on an auto-layout group resize handle
	checkForGroupResizeHandle(worldPos){
		// Check if renderer has stored handle positions from last draw
		const renderer = stage.renderer;
		if(!renderer.autoLayoutFrame || !renderer.autoLayoutHandles) return null;

		const { groupId, bounds } = renderer.autoLayoutFrame;
		const { corners, edges } = renderer.autoLayoutHandles;

		const hitRadius = 8 / stage.zoom; // Screen-space hit area converted to world

		// Check corners first (they have priority)
		for(const corner of corners){
			const dx = worldPos.x - corner.x;
			const dy = worldPos.y - corner.y;
			if(Math.sqrt(dx*dx + dy*dy) < hitRadius){
				const group = data.groups.get(groupId);
				return {
					groupId,
					handleType: 'corner',
					corner: corner.corner,
					cursor: corner.cursor,
					originalBounds: { ...bounds },
					originalSizing: group ? { ...group.sizing } : null,
					originalShapePositions: this.captureGroupShapePositions(groupId)
				};
			}
		}

		// Check edges
		for(const edge of edges){
			const dx = worldPos.x - edge.x;
			const dy = worldPos.y - edge.y;
			if(Math.sqrt(dx*dx + dy*dy) < hitRadius){
				const group = data.groups.get(groupId);
				return {
					groupId,
					handleType: 'edge',
					edge: edge.edge,
					cursor: edge.cursor,
					originalBounds: { ...bounds },
					originalSizing: group ? { ...group.sizing } : null,
					originalShapePositions: this.captureGroupShapePositions(groupId)
				};
			}
		}

		return null;
	}

	// Capture positions of all shapes in a group for undo
	captureGroupShapePositions(groupId){
		const shapes = data.getGroupShapes(groupId);
		return shapes.map(shape => ({
			shape,
			x: shape.bounds.x,
			y: shape.bounds.y
		}));
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
	// Shapes decide how to clone themselves via cloneForDrag()
	cloneSelectedShapes(){
		this.isCloning = true;
		this.clonedShapes = [];

		const selected = data.getSelected();

		// Clone group hierarchy (only used when not editing a group)
		const groupIdMap = data.editingGroupId ? null : data.cloneGroupHierarchy(selected);

		// Clone each shape using its cloneForDrag() method
		for(const shape of selected){
			if(shape.frameId) continue;  // Skip shapes that belong to frames

			const clone = shape.cloneForDrag();
			if(data.editingGroupId){
				// When editing a group, clones stay in that group
				clone.groupId = data.editingGroupId;
			} else if(clone.groupId && groupIdMap){
				// Otherwise remap group hierarchy for cloned groups
				clone.groupId = groupIdMap.get(clone.groupId) || null;
			}
			data.addShape(clone);
			clone.selected = true;
			this.clonedShapes.push(clone);
			shape.selected = false;
		}

		// Update moveTarget to reference a cloned shape
		if(this.moveTarget && this.clonedShapes.length > 0){
			const originalIndex = selected.indexOf(this.moveTarget.shape);
			if(originalIndex >= 0 && originalIndex < this.clonedShapes.length){
				this.moveTarget.shape = this.clonedShapes[originalIndex];
			} else {
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
		// Enable snapping for move operations
		this.generateGuides 	= true;

		// clear any existing snaps
		data.resetSnaps();

		// Check for paper label click first (screen-space, not geometry)
		const paper = this.getPaperAtScreen(e.screenX, e.screenY);
		if(paper){
			// Select only the paper, deselect everything else
			data.selectNone();
			paper.selected = true;
			this.paperTarget = paper;
			this.paperDragStart = {
				screenX: e.screenX,
				screenY: e.screenY,
				origX: paper.x,
				origY: paper.y
			};
			this.dragStart = { screenX: e.screenX, screenY: e.screenY };
			stage.render();
			return;
		}

		// Check for double-click on text to edit
		// xxx move to double click object?
		const now = Date.now();

		// store first click point
		const clickPos = { x: data.snapPoint.x, y: data.snapPoint.y };

		if(this.doubleClick.click()){
			console.log("double clickl!")

			// Double-click detected - let the shape handle it
			const clickedShape = data.getTargetShape();
			if(clickedShape){
				const context = { toolManager, data, stage };
				if(clickedShape.handleDoubleClick(clickPos, context)){
					this.lastClickTime = 0;
					this.lastClickPos = null;
					return;
				}
			}

			// is it a group?
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


		// Store both world and screen coords
		// XXX drag manager?
		this.dragStart 	= {x: data.snapPoint.x, y: data.snapPoint.y, screenX: e.screenX, screenY: e.screenY};
		this.isDragging = false;
		this.isMoving 	= false;

		// Check if clicking on a shape
		this.moveTarget = data.getTargetShape();

		// Check if clicking on an auto-layout group resize handle
		this.groupResize = this.checkForGroupResizeHandle(clickPos);
		if(this.groupResize){
			return; // Handle resize in onMouseMove/Up
		}

		// Check if clicking on a resize control point
		// Shapes define their own control point types via getControlPointType()
		this.cornerResize = null;

		if(this.moveTarget && data.snapPoint.poiIndex !== undefined) {
			const poi = data.snapPoint.poiIndex;
			const controlType = this.moveTarget.getControlPointType(poi);

			if(controlType === 'resize') {
				this.cornerResize = { shape: this.moveTarget, cornerIndex: poi };

				// Select the shape for control point resize
				if(!this.moveTarget.selected){
					data.selectNone();
					this.moveTarget.selected = true;
				}
			}
		}

		// Select on mouse down (if clicking on a shape, but not a resize control point)
		if(this.moveTarget && !this.cornerResize){
			const shape = this.moveTarget;
			const clickingOnPOI = data.snapPoint.poiIndex !== undefined;
			const shapeAlreadySelected = shape.selected || data.getSelectedPoints().has(shape);

			// If there's a partial point selection, only clear it if clicking on an UNSELECTED shape
			// This preserves mixed selections (whole shapes + individual points) during drag
			const selectedPoints = data.getSelectedPoints();
			if(selectedPoints.size > 0 && !shapeAlreadySelected){
				// Clicking on an unselected shape - clear partial selections
				data.selectedPoints.clear();
			}

			// If shape is already selected and clicking on a POI, allow point dragging
			// (don't change selection - just let the drag happen)
			// Exception: Shift+click promotes partial selection to whole shape
			const hasPartialSelection = data.getSelectedPoints().has(shape) && !shape.selected;

			if(stage.shiftKey && hasPartialSelection){
				// Shift+click on shape with partial point selection → promote to whole shape
				data.selectedPoints.delete(shape);
				shape.selected = true;
				stage.render();
			} else if(shapeAlreadySelected && clickingOnPOI){
				// Don't change selection - point drag will be handled by move logic
				stage.render();
			} else if(shapeAlreadySelected && !clickingOnPOI){
				// Clicking on an already-selected shape (not on a POI) - maintain selection for drag
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

		// Handle paper dragging (screen-space, not geometry)
		if(this.paperTarget){
			const screenDx = e.screenX - this.paperDragStart.screenX;
			const screenDy = e.screenY - this.paperDragStart.screenY;

			// Convert screen delta to world delta
			const worldDx = screenDx / stage.zoom;
			const worldDy = screenDy / stage.zoom;

			// Move paper directly
			this.paperTarget.translate(worldDx, worldDy);

			// Update drag start for next frame
			this.paperDragStart = { screenX: e.screenX, screenY: e.screenY };

			stage.render();
			return;
		}

		// Handle group resize
		if(this.groupResize){
			this.updateGroupResize(e);
			stage.render();
			return;
		}

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

		// Find which containers are being moved (their children DON'T need separate movement)
		// When a container moves, its children stay in LOCAL coords - they move with it automatically
		const movingContainerIds = new Set();
		for(const original of this.originalPositions){
			if(original.shape.isContainer()){
				movingContainerIds.add(original.shape.id);
			}
		}

		// Apply delta to all stored original positions
		for(const original of this.originalPositions){
			const shape = original.shape;

			// Skip shapes whose parent container is also being moved
			// (they'll move automatically since they store LOCAL coords)
			if(shape.frameId && movingContainerIds.has(shape.frameId)){
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

	// Update auto-layout group resize based on current mouse position
	updateGroupResize(e){
		if(!this.groupResize) return;

		const { groupId, handleType, corner, edge, originalBounds } = this.groupResize;
		const group = data.groups.get(groupId);
		if(!group) return;

		// Current world position
		const currentX = e.x;
		const currentY = e.y;

		// Calculate new dimensions based on which handle is being dragged
		let newWidth = originalBounds.width;
		let newHeight = originalBounds.height;

		if(handleType === 'corner'){
			// Corner handles affect both dimensions
			switch(corner){
				case 'br': // bottom-right
					newWidth = currentX - originalBounds.x;
					newHeight = currentY - originalBounds.y;
					break;
				case 'bl': // bottom-left
					newWidth = (originalBounds.x + originalBounds.width) - currentX;
					newHeight = currentY - originalBounds.y;
					break;
				case 'tr': // top-right
					newWidth = currentX - originalBounds.x;
					newHeight = (originalBounds.y + originalBounds.height) - currentY;
					break;
				case 'tl': // top-left
					newWidth = (originalBounds.x + originalBounds.width) - currentX;
					newHeight = (originalBounds.y + originalBounds.height) - currentY;
					break;
			}
		} else if(handleType === 'edge'){
			// Edge handles affect one dimension
			switch(edge){
				case 'right':
					newWidth = currentX - originalBounds.x;
					break;
				case 'left':
					newWidth = (originalBounds.x + originalBounds.width) - currentX;
					break;
				case 'bottom':
					newHeight = currentY - originalBounds.y;
					break;
				case 'top':
					newHeight = (originalBounds.y + originalBounds.height) - currentY;
					break;
			}
		}

		// Enforce minimum size
		newWidth = Math.max(20, newWidth);
		newHeight = Math.max(20, newHeight);

		// Update group sizing - switch to fixed mode on dragged axes
		if(handleType === 'corner' || edge === 'left' || edge === 'right'){
			group.sizing.widthMode = 'fixed';
			group.sizing.fixedWidth = newWidth;
		}
		if(handleType === 'corner' || edge === 'top' || edge === 'bottom'){
			group.sizing.heightMode = 'fixed';
			group.sizing.fixedHeight = newHeight;
		}

		// Trigger live layout
		this.applyLiveLayout(groupId);

		// Update cursor
		stage.setCursor(this.groupResize.cursor);
	}

	// Apply layout without creating undo command (for live preview)
	applyLiveLayout(groupId){
		const group = data.groups.get(groupId);
		if(!group || group.layout.mode === 'none') return;

		const items = data.getLayoutItems(groupId);
		const bounds = data.getAutoLayoutBounds(groupId);
		if(!bounds || items.length === 0) return;

		// Use content area for layout (respects padding)
		const layoutBounds = bounds.contentArea || bounds;

		const moves = calculateLayout(items, layoutBounds, group.layout);

		// Apply moves
		for(const move of moves){
			if(move.dx === 0 && move.dy === 0) continue;

			if(move.type === 'shape'){
				move.item.translate(move.dx, move.dy);
			} else if(move.type === 'group'){
				const groupShapes = data.getGroupShapes(move.item);
				for(const shape of groupShapes){
					shape.translate(move.dx, move.dy);
				}
			}
		}
	}

	// Finish group resize and create undo command
	finishGroupResize(){
		if(!this.groupResize) return;

		const { groupId, originalSizing, originalShapePositions } = this.groupResize;
		const group = data.groups.get(groupId);
		if(!group) return;

		// Capture new state
		const newSizing = { ...group.sizing };
		const newShapePositions = this.captureGroupShapePositions(groupId);

		// Create undo command
		undoManager.record(new ResizeAutoLayoutGroupCommand(
			groupId,
			originalSizing,
			newSizing,
			originalShapePositions,
			newShapePositions
		));

		// Rebuild POIs
		data.rebuildPOIs();

		// Reset cursor
		stage.setCursor('default');
	}

	onMouseUp(e){
		this.generateGuides 	= false; // Enable snapping for move operations
		data.resetSnaps();

		// Handle group resize completion
		if(this.groupResize){
			this.finishGroupResize();
			this.resetDrag();
			stage.render();
			return;
		}

		// Handle paper drag completion
		if(this.paperTarget){
			const paper = this.paperTarget;
			const origX = this.paperDragStart.origX;
			const origY = this.paperDragStart.origY;

			// Only record undo if position changed
			if(paper.x !== origX || paper.y !== origY){
				// Record move for undo using MoveCommand with index -1 (whole shape)
				const moveData = [{
					shape: paper,
					index: -1,
					oldX: origX,
					oldY: origY,
					newX: paper.x,
					newY: paper.y
				}];
				undoManager.record(new MoveCommand(moveData));
			}

			this.resetDrag();
			stage.render();
			return;
		}

		if(this.isMoving){
			// Move operation complete - rebuild POI cache
			data.rebuildPOIs();

			// Recalculate intersections for moved shapes
			// Note: When frames move, their children move automatically (local coords)
			// so we need to recalculate intersections for frame children too
			const movedShapes = new Set(this.originalPositions.map(p => p.shape));

			// Add container children to movedShapes for intersection recalc
			for(const orig of this.originalPositions){
				if(orig.shape.isContainer()){
					for(const child of orig.shape.getContainedShapes()){
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

				// Store transform for "Transform Again" (Cmd+D)
				const snapPt = draftingAssistant.getCurrentSnapPoint();
				data.lastTransform = {
					dx: snapPt.x - this.moveStart.x,
					dy: snapPt.y - this.moveStart.y
				};

				// Apply layout if cloning into an auto-layout group
				if(data.editingGroupId){
					const group = data.groups.get(data.editingGroupId);
					if(group && group.autoLayout){
						undoManager.execute(new ApplyLayoutCommand(data.editingGroupId));
					}
				}

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

					// Apply layout if moving within an auto-layout group
					if(data.editingGroupId){
						const group = data.groups.get(data.editingGroupId);
						if(group && group.autoLayout){
							undoManager.execute(new ApplyLayoutCommand(data.editingGroupId));
						}
					}
				}
			}
		} else if(this.isDragging && this.marqueeRect){
			// Finish marquee selection
			data.selectByMarquee(this.marqueeRect, stage.shiftKey);
			this.marqueeRect = null;

		} else if(this.dragStart && !this.isDragging && !this.isMoving && !this.moveTarget){
			// Click on empty space (no shape) - deselect all and exit group editing
			if(!stage.shiftKey){
				// Apply layout to any auto-layout groups before deselecting
				this.applyPendingLayouts();
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

	// Apply layout to any auto-layout groups that have selected shapes
	applyPendingLayouts(){
		const selected = data.getSelected();
		if(selected.length === 0) return;

		// Collect unique group IDs from selected shapes that have autoLayout
		const autoLayoutGroupIds = new Set();
		for(const shape of selected){
			if(shape.groupId){
				const group = data.groups.get(shape.groupId);
				if(group && group.autoLayout){
					autoLayoutGroupIds.add(shape.groupId);
				}
			}
		}

		// Apply layout to each group
		for(const groupId of autoLayoutGroupIds){
			undoManager.execute(new ApplyLayoutCommand(groupId));
		}
	}
}
