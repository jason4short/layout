// UndoManager - Command pattern implementation for undo/redo
// Each action that modifies data should create a Command and execute it through UndoManager

class UndoManager {
	constructor() {
		if (UndoManager.instance) {
			return UndoManager.instance;
		}

		this.undoStack = [];
		this.redoStack = [];
		this.maxHistory = 100; // Limit memory usage

		UndoManager.instance = this;
		return this;
	}

	// Execute a command and add it to the undo stack
	execute(command) {
		command.execute();
		this.undoStack.push(command);

		// Clear redo stack on new action
		this.redoStack = [];

		// Limit stack size
		if (this.undoStack.length > this.maxHistory) {
			this.undoStack.shift();
		}
	}

	// Record a command without executing (for actions already performed)
	record(command) {
		this.undoStack.push(command);

		// Clear redo stack on new action
		this.redoStack = [];

		// Limit stack size
		if (this.undoStack.length > this.maxHistory) {
			this.undoStack.shift();
		}
	}

	// Undo the last command
	undo() {
		if (this.undoStack.length === 0) {
			return false;
		}

		const command = this.undoStack.pop();
		command.undo();
		this.redoStack.push(command);
		return true;
	}

	// Redo the last undone command
	redo() {
		if (this.redoStack.length === 0) {
			return false;
		}

		const command = this.redoStack.pop();
		command.execute();
		this.undoStack.push(command);
		return true;
	}

	// Check if undo is available
	canUndo() {
		return this.undoStack.length > 0;
	}

	// Check if redo is available
	canRedo() {
		return this.redoStack.length > 0;
	}

	// Clear all history
	clear() {
		this.undoStack = [];
		this.redoStack = [];
	}

	// Get description of last undoable action (for UI)
	getUndoDescription() {
		if (this.undoStack.length === 0) return null;
		return this.undoStack[this.undoStack.length - 1].description;
	}

	// Get description of last redoable action (for UI)
	getRedoDescription() {
		if (this.redoStack.length === 0) return null;
		return this.redoStack[this.redoStack.length - 1].description;
	}
}

const instance = new UndoManager();
export default instance;
