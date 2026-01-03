// Command classes for undo/redo system
// Each command knows how to execute and undo itself

import data from '../data/Data.js';

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

// Add a single shape
export class AddShapeCommand extends Command {
	constructor(shape) {
		super('Add shape');
		this.shape = shape;
	}

	execute() {
		data.addShape(this.shape);
	}

	undo() {
		data.deleteShape(this.shape);
	}
}

// Add multiple shapes at once
export class AddShapesCommand extends Command {
	constructor(shapes) {
		super(`Add ${shapes.length} shapes`);
		this.shapes = shapes;
	}

	execute() {
		for (const shape of this.shapes) {
			data.addShape(shape);
		}
	}

	undo() {
		for (const shape of this.shapes) {
			data.deleteShape(shape);
		}
	}
}

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

// Delete a single shape
export class DeleteShapeCommand extends Command {
	constructor(shape) {
		super('Delete shape');
		this.shape = shape;
		this.wasSelected = shape.selected;
	}

	execute() {
		data.deleteShape(this.shape);
	}

	undo() {
		data.addShape(this.shape);
		this.shape.selected = this.wasSelected;
	}
}

// Delete multiple shapes at once
export class DeleteShapesCommand extends Command {
	constructor(shapes) {
		super(`Delete ${shapes.length} shapes`);
		this.shapes = shapes;
		this.wasSelected = shapes.map(s => s.selected);
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

// Move shapes/points by a delta
export class MoveCommand extends Command {
	constructor(moveData) {
		// moveData: [{shape, index, oldX, oldY, newX, newY}, ...]
		super('Move');
		this.moveData = moveData;
	}

	execute() {
		const affectedShapes = new Set();
		for (const item of this.moveData) {
			item.shape.updateControlPoint(item.index, item.newX, item.newY);
			affectedShapes.add(item.shape);
		}
		data.rebuildPOIs();
		data.recalculateIntersectionsForShapes([...affectedShapes]);
	}

	undo() {
		const affectedShapes = new Set();
		for (const item of this.moveData) {
			item.shape.updateControlPoint(item.index, item.oldX, item.oldY);
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
	constructor(chamferLine, line1, line2, line1Original, line2Original) {
		super('Chamfer');
		this.chamferLine = chamferLine;
		this.line1 = line1;
		this.line2 = line2;
		// Store clones of original line states for undo
		this.line1Original = line1Original;
		this.line2Original = line2Original;
		// Store trimmed states for redo (captured on first execute)
		this.line1Trimmed = null;
		this.line2Trimmed = null;
		this.firstExecute = true;
	}

	execute() {
		if (this.firstExecute) {
			this.firstExecute = false;
			// Capture trimmed states for later redo
			this.line1Trimmed = this.line1.clone();
			this.line2Trimmed = this.line2.clone();
			return;
		}

		// Redo: add chamfer line and apply trimmed line states
		data.addShape(this.chamferLine);
		this.line1.copyFrom(this.line1Trimmed);
		this.line2.copyFrom(this.line2Trimmed);
	}

	undo() {
		// Remove the chamfer line
		data.deleteShape(this.chamferLine);
		// Restore lines to original state
		this.line1.copyFrom(this.line1Original);
		this.line2.copyFrom(this.line2Original);
	}
}

// Fillet command - creates arc and trims two lines
export class FilletCommand extends Command {
	constructor(arc, line1, line2, line1Original, line2Original) {
		super('Fillet');
		this.arc = arc;
		this.line1 = line1;
		this.line2 = line2;
		// Store clones of original line states for undo
		this.line1Original = line1Original;
		this.line2Original = line2Original;
		// Store trimmed states for redo (captured on first execute)
		this.line1Trimmed = null;
		this.line2Trimmed = null;
		this.firstExecute = true;
	}

	execute() {
		if (this.firstExecute) {
			this.firstExecute = false;
			// Capture trimmed states for later redo
			this.line1Trimmed = this.line1.clone();
			this.line2Trimmed = this.line2.clone();
			return;
		}

		// Redo: add arc and apply trimmed line states
		data.addShape(this.arc);
		this.line1.copyFrom(this.line1Trimmed);
		this.line2.copyFrom(this.line2Trimmed);
	}

	undo() {
		// Remove the arc
		data.deleteShape(this.arc);
		// Restore lines to original state
		this.line1.copyFrom(this.line1Original);
		this.line2.copyFrom(this.line2Original);
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
