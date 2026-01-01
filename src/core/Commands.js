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
		for (const item of this.moveData) {
			item.shape.updateControlPoint(item.index, item.newX, item.newY);
		}
		data.rebuildPOIs();
	}

	undo() {
		for (const item of this.moveData) {
			item.shape.updateControlPoint(item.index, item.oldX, item.oldY);
		}
		data.rebuildPOIs();
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
	}

	undo() {
		// Scale by inverse factor
		const inverseFactor = 1 / this.scaleFactor;
		for (const shape of this.shapes) {
			shape.scale(this.anchorX, this.anchorY, inverseFactor);
		}
		data.rebuildPOIs();
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
	}

	undo() {
		// Mirror is self-inverse - just mirror again
		for (const shape of this.shapes) {
			shape.mirror(this.x1, this.y1, this.x2, this.y2);
		}
		data.rebuildPOIs();
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
