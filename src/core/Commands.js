// Command classes for undo/redo system
// Each command knows how to execute and undo itself

import data, { DEFAULT_LAYOUT, DEFAULT_SIZING, DEFAULT_PADDING } from '../data/Data.js';
import { calculateLayout } from './LayoutEngine.js';
import { Frame } from '../geometry/Frame.js';
import { AutoLayoutFrame } from '../geometry/AutoLayoutFrame.js';

// Base Command class
export class Command {
	constructor(description = 'Unknown action') {
		this.description = description;
	}

	execute() {
		throw new Error('Command.execute() must be implemented');
	}

	undo() {
		throw new Error('Command.undo() must be implemented');
	}
}

// Helper: Convert shape to frame-local coordinates
// Returns clone of original world coords for undo, or null if no frame
function prepareShapeForFrame(shape, frameId) {
	if (!frameId) return null;

	const frame = data.getFrame(frameId);
	if (!frame) return null;

	// Store original world coords for undo
	const worldCoords = shape.clone();

	// Convert shape from WORLD to FRAME-LOCAL coords
	if (shape.transformPoints) {
		shape.transformPoints(p => frame.worldToLocal(p));
	} else {
		const localOrigin = frame.worldToLocal(0, 0);
		shape.translate(localOrigin.x, localOrigin.y);
	}
	shape.update();
	shape.frameId = frameId;

	return worldCoords;
}

// Helper: Assign shape to editing group if ungrouped
// Returns true if shape was assigned, false otherwise
function assignShapeToEditingGroup(shape, groupId) {
	if (!groupId || shape.groupId) return false;
	shape.groupId = groupId;
	return true;
}

// Add shapes to the drawing
// If there's an active frame, converts shape coords to frame-local and assigns frameId
// If editing a group, assigns ungrouped shapes to that group
export class AddShapesCommand extends Command {
	constructor(shapes) {
		const shapeArray = Array.isArray(shapes) ? shapes : [shapes];
		super(shapeArray.length === 1 ? 'Add shape' : `Add ${shapeArray.length} shapes`);
		this.shapes = shapeArray;
		this.frameId = null;
		this.groupId = null;
		this.worldCoords = [];
		this.shapesAddedToGroup = [];
	}

	execute() {
		// Convert to frame-local coords if active frame
		if (data.activeFrameId) {
			for (const shape of this.shapes) {
				const worldCoords = prepareShapeForFrame(shape, data.activeFrameId);
				this.worldCoords.push(worldCoords);
			}
			if (this.worldCoords.some(w => w !== null)) {
				this.frameId = data.activeFrameId;
			}
		}

		// Assign ungrouped shapes to editing group
		if (data.editingGroupId) {
			this.groupId = data.editingGroupId;
			for (const shape of this.shapes) {
				if (assignShapeToEditingGroup(shape, data.editingGroupId)) {
					this.shapesAddedToGroup.push(shape);
				}
			}
		}

		for (const shape of this.shapes) {
			data.addShape(shape);
		}
	}

	undo() {
		for (const shape of this.shapes) {
			data.deleteShape(shape);
		}
		if (this.frameId) {
			for (let i = 0; i < this.shapes.length; i++) {
				if (this.worldCoords[i]) {
					this.shapes[i].copyFrom(this.worldCoords[i]);
				}
				this.shapes[i].frameId = null;
			}
		}
		for (const shape of this.shapesAddedToGroup) {
			shape.groupId = null;
		}
	}
}

// Convenience alias for single shape addition
export const AddShapeCommand = AddShapesCommand;

// Add a construction line
export class AddConstructionCommand extends Command {
	constructor(construction) {
		super('Add construction');
		this.construction = construction;
	}

	execute() {
		data.addConstruction(this.construction);
	}

	undo() {
		data.deleteShape(this.construction);
	}
}

// Delete all construction lines
export class DeleteConstructionsCommand extends Command {
	constructor() {
		super('Delete constructions');
		this.constructions = [];
	}

	execute() {
		// Store constructions before deleting for undo
		this.constructions = [...data.constructions];
		data._deleteConstructions();
	}

	undo() {
		// Restore all constructions
		for (const construction of this.constructions) {
			data.addConstruction(construction);
		}
	}
}

// Delete multiple shapes at once
export class DeleteShapesCommand extends Command {
	constructor(shapes) {
		const shapeArray = Array.isArray(shapes) ? shapes : [shapes];
		super(shapeArray.length === 1 ? 'Delete shape' : `Delete ${shapeArray.length} shapes`);
		this.shapes = shapeArray;
		this.wasSelected = shapeArray.map(s => s.selected);
	}

	execute() {
		for (const shape of this.shapes) {
			data.deleteShape(shape);
		}
	}

	undo() {
		for (let i = 0; i < this.shapes.length; i++) {
			data.addShape(this.shapes[i]);
			this.shapes[i].selected = this.wasSelected[i];
		}
	}
}

// Convenience alias for single shape deletion
export const DeleteShapeCommand = DeleteShapesCommand;

// Move shapes/points by a delta
// Coordinates are stored in frame-local space (or world space for non-frame shapes)
export class MoveCommand extends Command {
	constructor(moveData) {
		// moveData: [{shape, index, oldX, oldY, newX, newY}, ...]
		// index === -1 indicates whole-shape translation (use bounds)
		super('Move');
		this.moveData = moveData;
	}

	execute() {
		const affectedShapes = new Set();
		for (const item of this.moveData) {
			if (item.index === -1) {
				// Whole shape translation
				const dx = item.newX - item.shape.bounds.x;
				const dy = item.newY - item.shape.bounds.y;
				item.shape.translate(dx, dy);
			} else {
				item.shape.updateControlPoint(item.index, item.newX, item.newY);
			}
			affectedShapes.add(item.shape);
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes([...affectedShapes]);
	}

	undo() {
		const affectedShapes = new Set();
		for (const item of this.moveData) {
			if (item.index === -1) {
				// Whole shape translation
				const dx = item.oldX - item.shape.bounds.x;
				const dy = item.oldY - item.shape.bounds.y;
				item.shape.translate(dx, dy);
			} else {
				item.shape.updateControlPoint(item.index, item.oldX, item.oldY);
			}
			affectedShapes.add(item.shape);
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes([...affectedShapes]);
	}
}

// Scale shapes
export class ScaleCommand extends Command {
	constructor(shapes, anchorX, anchorY, scaleFactor) {
		super('Scale');
		this.shapes = shapes;
		this.anchorX = anchorX;
		this.anchorY = anchorY;
		this.scaleFactor = scaleFactor;
	}

	execute() {
		for (const shape of this.shapes) {
			shape.scale(this.anchorX, this.anchorY, this.scaleFactor);
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes(this.shapes);
	}

	undo() {
		// Scale by inverse factor
		const inverseFactor = 1 / this.scaleFactor;
		for (const shape of this.shapes) {
			shape.scale(this.anchorX, this.anchorY, inverseFactor);
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes(this.shapes);
	}
}

// Mirror shapes (self-inverse operation)
export class MirrorCommand extends Command {
	constructor(shapes, x1, y1, x2, y2) {
		super('Mirror');
		this.shapes = shapes;
		this.x1 = x1;
		this.y1 = y1;
		this.x2 = x2;
		this.y2 = y2;
	}

	execute() {
		for (const shape of this.shapes) {
			shape.mirror(this.x1, this.y1, this.x2, this.y2);
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes(this.shapes);
	}

	undo() {
		// Mirror is self-inverse - just mirror again
		for (const shape of this.shapes) {
			shape.mirror(this.x1, this.y1, this.x2, this.y2);
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes(this.shapes);
	}
}

// Rotate shapes around an anchor point
export class RotateCommand extends Command {
	constructor(shapes, anchorX, anchorY, angleRad) {
		super('Rotate');
		this.shapes = shapes;
		this.anchorX = anchorX;
		this.anchorY = anchorY;
		this.angleRad = angleRad;
	}

	execute() {
		for (const shape of this.shapes) {
			shape.rotate(this.anchorX, this.anchorY, this.angleRad);
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes(this.shapes);
	}

	undo() {
		// Rotate by negative angle
		for (const shape of this.shapes) {
			shape.rotate(this.anchorX, this.anchorY, -this.angleRad);
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes(this.shapes);
	}
}

// Composite command for grouping multiple commands
export class CompositeCommand extends Command {
	constructor(commands, description = 'Multiple actions') {
		super(description);
		this.commands = commands;
	}

	execute() {
		for (const cmd of this.commands) {
			cmd.execute();
		}
	}

	undo() {
		// Undo in reverse order
		for (let i = this.commands.length - 1; i >= 0; i--) {
			this.commands[i].undo();
		}
	}
}

// Chamfer command - creates chamfer line and trims two lines
export class ChamferCommand extends Command {
	constructor(chamferLine, shape1, shape2, shape1Original, shape2Original) {
		super('Chamfer');
		this.chamferLine = chamferLine;
		this.shape1 = shape1;
		this.shape2 = shape2;
		// Store clones of original shape states for undo
		this.shape1Original = shape1Original;
		this.shape2Original = shape2Original;
		// Store trimmed states for redo (captured on first execute)
		this.shape1Trimmed = null;
		this.shape2Trimmed = null;
		this.firstExecute = true;
	}

	execute() {
		if (this.firstExecute) {
			this.firstExecute = false;
			// Capture trimmed states for later redo (only for shapes that were trimmed)
			if (this.shape1Original) {
				this.shape1Trimmed = this.shape1.clone();
			}
			if (this.shape2Original) {
				this.shape2Trimmed = this.shape2.clone();
			}
			// Recalculate intersections for the trimmed shapes
			const shapesToUpdate = [this.shape1, this.shape2].filter(s => s);
			data.recalculateIntersectionsForShapes(shapesToUpdate);
			data.rebuildPOIs();
			return;
		}

		// Redo: add chamfer line and apply trimmed shape states
		data.addShape(this.chamferLine);
		if (this.shape1Trimmed) {
			this.shape1.copyFrom(this.shape1Trimmed);
		}
		if (this.shape2Trimmed) {
			this.shape2.copyFrom(this.shape2Trimmed);
		}
		// Recalculate intersections for the modified shapes
		const shapesToUpdate = [this.shape1, this.shape2].filter(s => s);
		data.recalculateIntersectionsForShapes(shapesToUpdate);
		data.rebuildPOIs();
	}

	undo() {
		// Remove the chamfer line
		data.deleteShape(this.chamferLine);
		// Restore shapes to original state (only if they were trimmed)
		if (this.shape1Original) {
			this.shape1.copyFrom(this.shape1Original);
		}
		if (this.shape2Original) {
			this.shape2.copyFrom(this.shape2Original);
		}
		// Recalculate intersections for the restored shapes
		const shapesToUpdate = [this.shape1, this.shape2].filter(s => s);
		data.recalculateIntersectionsForShapes(shapesToUpdate);
		data.rebuildPOIs();
	}
}

// Fillet command - creates arc and trims two shapes (lines, arcs, or circles)
// Note: Circles are never trimmed (original is null), only lines and arcs are trimmed
export class FilletCommand extends Command {
	constructor(arc, shape1, shape2, shape1Original, shape2Original) {
		super('Fillet');
		this.arc = arc;
		this.shape1 = shape1;
		this.shape2 = shape2;
		// Store clones of original shape states for undo (null for circles)
		this.shape1Original = shape1Original;
		this.shape2Original = shape2Original;
		// Store trimmed states for redo (captured on first execute)
		this.shape1Trimmed = null;
		this.shape2Trimmed = null;
		this.firstExecute = true;
	}

	execute() {
		if (this.firstExecute) {
			this.firstExecute = false;
			// Capture trimmed states for later redo (only for shapes that were trimmed)
			if (this.shape1Original) {
				this.shape1Trimmed = this.shape1.clone();
			}
			if (this.shape2Original) {
				this.shape2Trimmed = this.shape2.clone();
			}
			// Recalculate intersections for the trimmed shapes
			const shapesToUpdate = [this.shape1, this.shape2].filter(s => s);
			data.recalculateIntersectionsForShapes(shapesToUpdate);
			data.rebuildPOIs();
			return;
		}

		// Redo: add arc and apply trimmed shape states
		data.addShape(this.arc);
		if (this.shape1Trimmed) {
			this.shape1.copyFrom(this.shape1Trimmed);
		}
		if (this.shape2Trimmed) {
			this.shape2.copyFrom(this.shape2Trimmed);
		}
		// Recalculate intersections for the modified shapes
		const shapesToUpdate = [this.shape1, this.shape2].filter(s => s);
		data.recalculateIntersectionsForShapes(shapesToUpdate);
		data.rebuildPOIs();
	}

	undo() {
		// Remove the arc
		data.deleteShape(this.arc);
		// Restore shapes to original state (only if they were trimmed)
		if (this.shape1Original) {
			this.shape1.copyFrom(this.shape1Original);
		}
		if (this.shape2Original) {
			this.shape2.copyFrom(this.shape2Original);
		}
		// Recalculate intersections for the restored shapes
		const shapesToUpdate = [this.shape1, this.shape2].filter(s => s);
		data.recalculateIntersectionsForShapes(shapesToUpdate);
		data.rebuildPOIs();
	}
}

// Trim command - removes shapes and adds new ones
// The trim operation is already performed before this command is created,
// so execute() is a no-op on first call. Subsequent calls (redo) do the work.
export class TrimCommand extends Command {
	constructor(shapesRemoved, shapesAdded, originalStates = null) {
		super('Trim');
		this.shapesRemoved = shapesRemoved;
		this.shapesAdded = shapesAdded;
		// originalStates: clones of shapes before modification (for undo)
		this.originalStates = originalStates;
		// trimmedStates: clones of shapes after modification (for redo)
		// Built on first execute from current state of modified shapes
		this.trimmedStates = null;
		// Track if this is the first execute (already done by tool)
		this.firstExecute = true;
	}

	execute() {
		// On first execute, capture the trimmed states for later redo
		if (this.firstExecute) {
			this.firstExecute = false;
			// Capture trimmed states for shapes that were modified in place
			this.trimmedStates = [];
			for (let i = 0; i < this.shapesRemoved.length; i++) {
				const shape = this.shapesRemoved[i];
				// If shape is also in added, it was modified - save its current (trimmed) state
				if (this.shapesAdded.includes(shape) && shape.clone) {
					this.trimmedStates[i] = shape.clone();
				} else {
					this.trimmedStates[i] = null;
				}
			}
			return;
		}

		// Redo: Remove original shapes
		for (const shape of this.shapesRemoved) {
			data.deleteShape(shape);
		}
		// Redo: Add new shapes, applying trimmed state if needed
		for (let i = 0; i < this.shapesAdded.length; i++) {
			const shape = this.shapesAdded[i];
			// If shape was modified in place, restore to trimmed state
			const removedIndex = this.shapesRemoved.indexOf(shape);
			if (removedIndex >= 0 && this.trimmedStates && this.trimmedStates[removedIndex]) {
				shape.copyFrom(this.trimmedStates[removedIndex]);
			}
			data.addShape(shape);
		}
	}

	undo() {
		// Remove added shapes
		for (const shape of this.shapesAdded) {
			data.deleteShape(shape);
		}
		// Restore removed shapes to original state
		for (let i = 0; i < this.shapesRemoved.length; i++) {
			const shape = this.shapesRemoved[i];
			// If we have original state, restore it
			if (this.originalStates && this.originalStates[i]) {
				shape.copyFrom(this.originalStates[i]);
			}
			data.addShape(shape);
		}
	}
}

// Group shapes together
export class GroupCommand extends Command {
	constructor(shapes) {
		super(`Group ${shapes.length} shapes`);
		this.shapes = shapes;
		this.groupId = null;
		// Store previous groupIds for undo
		this.previousGroupIds = shapes.map(s => s.groupId);
		// Store child groups that got reparented
		this.reparentedGroups = [];
	}

	execute() {
		// Find existing groups in selection that will become children
		const childGroupIds = new Set();
		for(const shape of this.shapes){
			if(shape.groupId){
				childGroupIds.add(shape.groupId);
			}
		}
		console.log('GroupCommand: shapes with existing groupIds:', [...childGroupIds]);

		// Create new group with layout properties
		this.groupId = `group_${data._nextGroupId++}`;
		data.groups.set(this.groupId, {
			id: this.groupId,
			parentId: null,
			autoLayout: false,
			layout: { ...DEFAULT_LAYOUT },
			sizing: { ...DEFAULT_SIZING },
			padding: { ...DEFAULT_PADDING }
		});
		console.log('GroupCommand: created new group', this.groupId);

		// Reparent child groups
		for(const childId of childGroupIds){
			const childGroup = data.groups.get(childId);
			console.log('GroupCommand: reparenting', childId, '- found:', !!childGroup);
			if(childGroup){
				this.reparentedGroups.push({ id: childId, oldParentId: childGroup.parentId });
				childGroup.parentId = this.groupId;
			}
		}

		// Assign ungrouped shapes to new group
		let ungroupedCount = 0;
		for(const shape of this.shapes){
			if(!shape.groupId){
				shape.groupId = this.groupId;
				ungroupedCount++;
			}
		}
		console.log('GroupCommand: assigned', ungroupedCount, 'ungrouped shapes to new group');
		console.log('GroupCommand: groups Map now has', data.groups.size, 'groups');
	}

	undo() {
		// Restore previous groupIds
		for(let i = 0; i < this.shapes.length; i++){
			this.shapes[i].groupId = this.previousGroupIds[i];
		}

		// Restore reparented groups
		for(const {id, oldParentId} of this.reparentedGroups){
			const group = data.groups.get(id);
			if(group){
				group.parentId = oldParentId;
			}
		}

		// Delete the group
		data.groups.delete(this.groupId);
	}
}

// Ungroup shapes (move up one level)
export class UngroupCommand extends Command {
	constructor(groupIds) {
		super(`Ungroup ${groupIds.size || groupIds.length} groups`);
		this.groupIds = [...groupIds];
		// Store state for undo
		this.groupData = []; // { id, parentId, shapes: [{shape, oldGroupId}], childGroups: [{id, oldParentId}] }
	}

	execute() {
		for(const groupId of this.groupIds){
			const group = data.groups.get(groupId);
			if(!group) continue;

			const parentId = group.parentId;
			const groupInfo = {
				id: groupId,
				parentId: parentId,
				autoLayout: group.autoLayout || false,
				layout: group.layout ? { ...group.layout } : null,
				sizing: group.sizing ? { ...group.sizing } : null,
				padding: group.padding ? { ...group.padding } : null,
				frameShapeId: group.frameShapeId || null,
				shapes: [],
				childGroups: []
			};

			// Delete the AutoLayoutFrame if it exists
			if (group.frameShapeId) {
				const frame = data.shapes.find(s => s.id === group.frameShapeId);
				if (frame) {
					data.deleteShape(frame);
					groupInfo.frameShape = frame; // Store for undo
				}
			}

			// Move shapes to parent group
			for(const shape of data.shapes){
				if(shape.groupId === groupId){
					groupInfo.shapes.push({ shape, oldGroupId: groupId });
					shape.groupId = parentId;
				}
			}

			// Move child groups to parent
			for(const [id, g] of data.groups){
				if(g.parentId === groupId){
					groupInfo.childGroups.push({ id, oldParentId: groupId });
					g.parentId = parentId;
				}
			}

			this.groupData.push(groupInfo);
			data.groups.delete(groupId);
		}
	}

	undo() {
		// Restore groups in reverse order
		for(const groupInfo of this.groupData.reverse()){
			// Recreate group with all properties
			data.groups.set(groupInfo.id, {
				id: groupInfo.id,
				parentId: groupInfo.parentId,
				autoLayout: groupInfo.autoLayout || false,
				layout: groupInfo.layout || { ...DEFAULT_LAYOUT },
				sizing: groupInfo.sizing || { ...DEFAULT_SIZING },
				padding: groupInfo.padding || { ...DEFAULT_PADDING },
				frameShapeId: groupInfo.frameShapeId || null
			});

			// Restore the AutoLayoutFrame if it existed
			if (groupInfo.frameShape) {
				data.addShape(groupInfo.frameShape);
			}

			// Restore shape groupIds
			for(const {shape, oldGroupId} of groupInfo.shapes){
				shape.groupId = oldGroupId;
			}

			// Restore child group parentIds
			for(const {id, oldParentId} of groupInfo.childGroups){
				const g = data.groups.get(id);
				if(g) g.parentId = oldParentId;
			}
		}
	}
}

// Apply auto-layout to a group
export class ApplyLayoutCommand extends Command {
	constructor(groupId) {
		super('Apply Layout');
		this.groupId = groupId;
		this.originalPositions = []; // For undo: { type, item, x, y }
	}

	execute() {
		const group = data.groups.get(this.groupId);
		if (!group || group.layout.mode === 'none') return;

		const items = data.getLayoutItems(this.groupId);
		const bounds = data.getAutoLayoutBounds(this.groupId);
		if (!bounds || items.length === 0) return;

		// Store original positions for undo
		this.originalPositions = items.map(item => ({
			type: item.type,
			item: item.item,
			x: item.bounds.x,
			y: item.bounds.y
		}));

		// Use content area for layout (respects padding)
		const layoutBounds = bounds.contentArea || bounds;

		// Calculate new positions
		const moves = calculateLayout(items, layoutBounds, group.layout);

		// Apply moves
		for (const move of moves) {
			if (move.dx === 0 && move.dy === 0) continue;

			if (move.type === 'shape') {
				move.item.translate(move.dx, move.dy);
			} else if (move.type === 'group') {
				// Move all shapes in the child group
				const groupShapes = data.getGroupShapes(move.item);
				for (const shape of groupShapes) {
					shape.translate(move.dx, move.dy);
				}
			}
		}

		data.rebuildPOIs();
		data.recalculateAllIntersections?.() || this._recalculateIntersections();
	}

	undo() {
		// Restore original positions
		for (const pos of this.originalPositions) {
			if (pos.type === 'shape') {
				const currentBounds = pos.item.bounds;
				const dx = pos.x - currentBounds.x;
				const dy = pos.y - currentBounds.y;
				if (dx !== 0 || dy !== 0) {
					pos.item.translate(dx, dy);
				}
			} else if (pos.type === 'group') {
				const currentBounds = data.getGroupBounds(pos.item);
				if (currentBounds) {
					const dx = pos.x - currentBounds.x;
					const dy = pos.y - currentBounds.y;
					if (dx !== 0 || dy !== 0) {
						const groupShapes = data.getGroupShapes(pos.item);
						for (const shape of groupShapes) {
							shape.translate(dx, dy);
						}
					}
				}
			}
		}

		data.rebuildPOIs();
		data.recalculateAllIntersections?.() || this._recalculateIntersections();
	}

	_recalculateIntersections() {
		// Fallback if recalculateAllIntersections doesn't exist
		const shapes = data.getGroupShapes(this.groupId);
		data.recalculateIntersectionsForShapes(shapes);
	}
}

// Convert selected shapes to a symbol source group
// The shapes stay on canvas as the source - use Option+drag to create instances
// Shapes are converted to frame-local coordinates
export class ConvertToSymbolCommand extends Command {
	constructor(shapes, name) {
		super(`Convert to Symbol: ${name}`);
		this.shapes = [...shapes];
		this.name = name;
		this.frame = null;
		this.previousFrameIds = [];  // Store original frameIds for undo
		this.worldCoords = [];  // Store original world coords for undo
	}

	execute() {
		// Calculate bounds of selected shapes
		let minX = Infinity, minY = Infinity;
		let maxX = -Infinity, maxY = -Infinity;

		for (const shape of this.shapes) {
			const b = shape.bounds;
			minX = Math.min(minX, b.x);
			minY = Math.min(minY, b.y);
			maxX = Math.max(maxX, b.x + b.width);
			maxY = Math.max(maxY, b.y + b.height);
		}

		// Add padding around the frame
		const padding = 10;
		const frameX = minX - padding;
		const frameY = minY - padding;
		const frameWidth = (maxX - minX) + padding * 2;
		const frameHeight = (maxY - minY) + padding * 2;

		// Create the Frame
		this.frame = new Frame([frameX, frameY, frameWidth, frameHeight, this.name]);
		this.frame.isSymbolSource = true;
		data.addShape(this.frame);

		// Store original state for undo
		this.previousFrameIds = this.shapes.map(s => s.frameId);
		this.worldCoords = this.shapes.map(s => s.clone());

		// Convert shapes to frame-local coords and assign to frame
		for (const shape of this.shapes) {
			// Convert from WORLD to FRAME-LOCAL coords
			shape.translate(-frameX, -frameY);
			shape.update();
			shape.frameId = this.frame.id;
		}

		// Select the frame
		data.selectNone();
		this.frame.selected = true;

		data.rebuildPOIs();
	}

	undo() {
		if (!this.frame) return;

		// Restore shapes to original world coords
		for (let i = 0; i < this.shapes.length; i++) {
			if (this.worldCoords[i]) {
				this.shapes[i].copyFrom(this.worldCoords[i]);
			}
			this.shapes[i].frameId = this.previousFrameIds[i];
		}

		// Remove the frame
		data.deleteShape(this.frame);
		this.frame = null;

		data.rebuildPOIs();
	}
}

// Break apart a symbol instance into a regular group
export class BreakApartInstanceCommand extends Command {
	constructor(instance) {
		super('Break Apart Instance');
		this.instance = instance;
		this.newShapes = [];
		this.newGroupId = null;
	}

	execute() {
		// Get exploded shapes (clones at instance position)
		this.newShapes = this.instance.explode();

		// Add shapes to data
		for (const shape of this.newShapes) {
			data.addShape(shape);
		}

		// Group the new shapes
		if (this.newShapes.length > 0) {
			this.newGroupId = data.createGroup(this.newShapes);
		}

		// Remove the instance
		data.deleteShape(this.instance);

		// Select the new shapes
		for (const shape of this.newShapes) {
			shape.selected = true;
		}

		data.rebuildPOIs();
	}

	undo() {
		// Remove the new shapes
		for (const shape of this.newShapes) {
			data.deleteShape(shape);
		}

		// Remove the group
		if (this.newGroupId) {
			data.groups.delete(this.newGroupId);
		}

		// Restore the instance
		data.addShape(this.instance);
		this.instance.selected = true;

		data.rebuildPOIs();
	}
}

// Generic command to break apart a compound shape into primitives
// Shape must implement breakApart() method returning array of new shapes
export class BreakApartCommand extends Command {
	constructor(shape) {
		super('Break Apart');
		this.shape = shape;
		this.newShapes = [];
	}

	execute() {
		if (!this.shape.breakApart) {
			throw new Error(`Shape ${this.shape.geometry} does not support breakApart`);
		}

		this.newShapes = this.shape.breakApart();

		for (const shape of this.newShapes) {
			data.addShape(shape);
			shape.selected = true;
		}

		data.deleteShape(this.shape);
		data.rebuildPOIs();
	}

	undo() {
		for (const shape of this.newShapes) {
			data.deleteShape(shape);
		}

		data.addShape(this.shape);
		this.shape.selected = true;
		data.rebuildPOIs();
	}
}

// Resize an auto-layout group
export class ResizeAutoLayoutGroupCommand extends Command {
	constructor(groupId, oldSizing, newSizing, oldPositions, newPositions) {
		super('Resize Auto-Layout Group');
		this.groupId = groupId;
		this.oldSizing = oldSizing;
		this.newSizing = newSizing;
		this.oldPositions = oldPositions;  // [{shape, x, y}]
		this.newPositions = newPositions;  // [{shape, x, y}]
	}

	execute() {
		const group = data.groups.get(this.groupId);
		if(group){
			group.sizing = { ...this.newSizing };
		}

		// Restore new positions
		for(const pos of this.newPositions){
			const dx = pos.x - pos.shape.bounds.x;
			const dy = pos.y - pos.shape.bounds.y;
			if(dx !== 0 || dy !== 0){
				pos.shape.translate(dx, dy);
			}
		}

		data.rebuildPOIs();
	}

	undo() {
		const group = data.groups.get(this.groupId);
		if(group){
			group.sizing = { ...this.oldSizing };
		}

		// Restore old positions
		for(const pos of this.oldPositions){
			const dx = pos.x - pos.shape.bounds.x;
			const dy = pos.y - pos.shape.bounds.y;
			if(dx !== 0 || dy !== 0){
				pos.shape.translate(dx, dy);
			}
		}

		data.rebuildPOIs();
	}
}

// Break a mirror zone into real geometry
export class BreakMirrorCommand extends Command {
	constructor(mirror) {
		super('Break Mirror');
		this.mirror = mirror;
		this.newShapes = [];
		this.newGroupId = null;
	}

	execute() {
		// Get exploded shapes (mirrored copies as real geometry)
		this.newShapes = this.mirror.explode();

		// Add shapes to data
		for (const shape of this.newShapes) {
			data.addShape(shape);
		}

		// Group the new shapes if there are multiple
		if (this.newShapes.length > 1) {
			this.newGroupId = data.createGroup(this.newShapes);
		}

		// Remove the mirror
		data.deleteShape(this.mirror);

		// Select the new shapes
		for (const shape of this.newShapes) {
			shape.selected = true;
		}

		data.rebuildPOIs();
	}

	undo() {
		// Remove the new shapes
		for (const shape of this.newShapes) {
			data.deleteShape(shape);
		}

		// Remove the group
		if (this.newGroupId) {
			data.groups.delete(this.newGroupId);
		}

		// Restore the mirror
		data.addShape(this.mirror);
		this.mirror.selected = true;

		data.rebuildPOIs();
	}
}

// Align or distribute shapes (generic command for both operations)
export class AlignCommand extends Command {
	constructor(shapes, deltas, description = 'Align') {
		super(description);
		this.shapes = shapes;
		this.deltas = deltas;
		this.originalPositions = shapes.map(s => ({ x: s.bounds.x, y: s.bounds.y }));
	}

	execute() {
		for (const { shape, dx, dy } of this.deltas) {
			if (dx !== 0 || dy !== 0) {
				shape.translate(dx, dy);
			}
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes(this.shapes);
	}

	undo() {
		for (let i = 0; i < this.shapes.length; i++) {
			const shape = this.shapes[i];
			const orig = this.originalPositions[i];
			const dx = orig.x - shape.bounds.x;
			const dy = orig.y - shape.bounds.y;
			if (dx !== 0 || dy !== 0) {
				shape.translate(dx, dy);
			}
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes(this.shapes);
	}
}
