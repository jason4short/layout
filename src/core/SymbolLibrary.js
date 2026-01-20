import { SymbolDefinition, SymbolInstance } from '../geometry/Symbol.js';

/**
 * Symbol Library - manages symbol definitions with localStorage persistence
 */
class SymbolLibrary {
	constructor() {
		if (!SymbolLibrary.instance) {
			SymbolLibrary.instance = this;
		}

		this.definitions = new Map(); // id -> SymbolDefinition
		this.storageKey = 'cadc_symbol_library';
		this.shapeFactory = null; // Set by FileManager to avoid circular dependency

		// Load from localStorage deferred until shapeFactory is set

		return SymbolLibrary.instance;
	}

	// Set shape factory function (called by FileManager to avoid circular dependency)
	setShapeFactory(factory) {
		this.shapeFactory = factory;
		// Now we can load from localStorage
		this.load();
	}

	// Import a single definition from JSON data (used when loading .cadc files)
	importDefinition(defData) {
		if (!this.shapeFactory) {
			console.warn('Shape factory not set, cannot import definition');
			return null;
		}

		// Check if we already have this definition
		if (this.definitions.has(defData.id)) {
			return this.definitions.get(defData.id);
		}

		const def = SymbolDefinition.fromJSON(defData, this.shapeFactory);
		if (def) {
			this.definitions.set(def.id, def);
			this.save();
			return def;
		}
		return null;
	}

	// Create a new symbol from shapes
	createSymbol(name, shapes, anchorX, anchorY) {
		if (shapes.length === 0) {
			console.warn('Cannot create symbol from empty selection');
			return null;
		}

		// Calculate center if anchor not provided
		if (anchorX === undefined || anchorY === undefined) {
			let minX = Infinity, minY = Infinity;
			let maxX = -Infinity, maxY = -Infinity;

			for (const shape of shapes) {
				if (shape.bounds) {
					minX = Math.min(minX, shape.bounds.x);
					minY = Math.min(minY, shape.bounds.y);
					maxX = Math.max(maxX, shape.bounds.x + shape.bounds.width);
					maxY = Math.max(maxY, shape.bounds.y + shape.bounds.height);
				}
			}

			anchorX = (minX + maxX) / 2;
			anchorY = (minY + maxY) / 2;
		}

		const definition = new SymbolDefinition(name, shapes, anchorX, anchorY);
		this.definitions.set(definition.id, definition);
		this.save();

		console.log(`Created symbol "${name}" with ${shapes.length} shapes`);
		return definition;
	}

	// Get a symbol definition by ID
	getDefinition(id) {
		return this.definitions.get(id);
	}

	// Get a symbol definition by name
	getDefinitionByName(name) {
		for (const def of this.definitions.values()) {
			if (def.name === name) return def;
		}
		return null;
	}

	// Get all definitions
	getAllDefinitions() {
		return Array.from(this.definitions.values());
	}

	// Delete a symbol definition
	deleteDefinition(id) {
		const def = this.definitions.get(id);
		if (def) {
			this.definitions.delete(id);
			this.save();
			console.log(`Deleted symbol "${def.name}"`);
			return true;
		}
		return false;
	}

	// Rename a symbol
	renameDefinition(id, newName) {
		const def = this.definitions.get(id);
		if (def) {
			def.name = newName;
			this.save();
			return true;
		}
		return false;
	}

	// Create an instance of a symbol
	createInstance(definitionId, x, y, rotation = 0, scaleX = 1, scaleY = 1) {
		const definition = this.getDefinition(definitionId);
		if (!definition) {
			console.warn(`Symbol definition ${definitionId} not found`);
			return null;
		}

		const instance = new SymbolInstance([x, y, definitionId, rotation, scaleX, scaleY]);
		instance.definition = definition;
		return instance;
	}

	// Link an instance to its definition (after loading from file)
	linkInstance(instance) {
		if (instance.definitionId) {
			const definition = this.getDefinition(instance.definitionId);
			if (definition) {
				instance.definition = definition;
				return true;
			}
		}
		return false;
	}

	// Save library to localStorage
	save() {
		try {
			const data = [];
			for (const def of this.definitions.values()) {
				data.push(def.toJSON());
			}
			localStorage.setItem(this.storageKey, JSON.stringify(data));
		} catch (e) {
			console.error('Failed to save symbol library:', e);
		}
	}

	// Load library from localStorage
	load() {
		if (!this.shapeFactory) {
			return; // Wait until shape factory is set
		}

		try {
			const json = localStorage.getItem(this.storageKey);
			if (!json) return;

			const data = JSON.parse(json);
			this.definitions.clear();

			for (const defData of data) {
				const def = SymbolDefinition.fromJSON(defData, this.shapeFactory);
				if (def) {
					this.definitions.set(def.id, def);
				}
			}

			console.log(`Loaded ${this.definitions.size} symbols from library`);
		} catch (e) {
			console.error('Failed to load symbol library:', e);
		}
	}

	// Export library to JSON file
	exportLibrary(fileName = 'symbols.json') {
		const data = [];
		for (const def of this.definitions.values()) {
			data.push(def.toJSON());
		}

		const jsonString = JSON.stringify(data, null, 2);
		const blob = new Blob([jsonString], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// Import library from JSON file
	importLibrary(callback) {
		if (!this.shapeFactory) {
			console.warn('Shape factory not set, cannot import library');
			if (callback) callback(0, new Error('Shape factory not set'));
			return;
		}

		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';

		input.onchange = (e) => {
			const file = e.target.files[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = (event) => {
				try {
					const data = JSON.parse(event.target.result);
					let imported = 0;

					for (const defData of data) {
						const def = SymbolDefinition.fromJSON(defData, this.shapeFactory);
						if (def) {
							this.definitions.set(def.id, def);
							imported++;
						}
					}

					this.save();
					console.log(`Imported ${imported} symbols`);
					if (callback) callback(imported);
				} catch (err) {
					console.error('Failed to import library:', err);
					if (callback) callback(0, err);
				}
			};
			reader.readAsText(file);
		};

		input.click();
	}

	// Clear all definitions
	clear() {
		this.definitions.clear();
		this.save();
	}
}

const symbolLibrary = new SymbolLibrary();
export default symbolLibrary;
