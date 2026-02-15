// Business logic for linked library symbols
// Libraries are just .cadc documents. You link a document to access its symbols.
// Placing creates a SymbolInstance that references the library source directly.
// Source geometry is cached on data.libraryCache for sync rendering.

import data from '../data/Data.js';
import {Shape} from '../geometry/Geometry.js';
import geometryFactory from '../geometry/GeometryFactory.js';
import {Frame} from '../geometry/Frame.js';
import fileManager from './FileManager.js';

class SymbolLibrary {
	// Build cache key from docId + frameId
	_cacheKey(docId, frameId) {
		return `${docId}:${frameId}`;
	}

	// Check if a library symbol is cached
	hasCached(docId, frameId) {
		return data.libraryCache.has(this._cacheKey(docId, frameId));
	}

	// Load and cache all symbols from linked library documents
	// Call after loading a document or linking a new library
	async loadCache() {
		data.libraryCache.clear();

		if (!fileManager.storage) return;

		for (const lib of data.linkedLibraries) {
			await this._cacheLibrary(lib.docId);
		}
	}

	// Cache all symbols from a single library document
	async _cacheLibrary(docId) {
		if (!fileManager.storage) return;

		const doc = await fileManager.storage.loadDocument(docId);
		if (!doc || !doc.data) return;

		const json = doc.data;
		if (!json.shapes) return;

		for (const shapeData of json.shapes) {
			if (shapeData.geometry !== Shape.FRAME) continue;
			if (!shapeData.isSymbolSource) continue;
			if (!shapeData.symbolId) continue; // need stable ID for library references

			const shapeId = shapeData.id;
			const childShapes = json.shapes.filter(s => s.frameId === shapeId);

			// Create a lightweight frame object for label/dimensions
			const frame = new Frame([0, 0, shapeData.width, shapeData.height, shapeData.label]);
			frame.isSymbolSource = true;
			frame.symbolId = shapeData.symbolId;

			// Deserialize child shapes
			const shapes = [];
			for (const sd of childShapes) {
				const shape = geometryFactory.fromJSON(sd);
				if (!shape) continue;
				shapes.push(shape);
			}

			// Key by symbolId (stable across save/load) not shape id (changes)
			data.libraryCache.set(this._cacheKey(docId, shapeData.symbolId), { frame, shapes });
		}
	}

	// Refresh the cache for a single library (after linking)
	async refreshLibrary(docId) {
		for (const key of data.libraryCache.keys()) {
			if (key.startsWith(docId + ':')) {
				data.libraryCache.delete(key);
			}
		}
		await this._cacheLibrary(docId);
	}

	// Get all symbols from linked library documents (for the browser UI)
	async getLinkedSymbols() {
		if (!fileManager.storage) return [];

		const results = [];
		for (const lib of data.linkedLibraries) {
			const doc = await fileManager.storage.loadDocument(lib.docId);
			if (!doc || !doc.data) continue;

			const json = doc.data;
			if (!json.shapes) continue;

			for (const shapeData of json.shapes) {
				if (shapeData.geometry !== Shape.FRAME) continue;
				if (!shapeData.isSymbolSource) continue;
				if (!shapeData.symbolId) continue;

				results.push({
					docId: lib.docId,
					docName: lib.name,
					frameId: shapeData.symbolId, // stable ID, not shape ID
					name: shapeData.label || 'Symbol',
					width: shapeData.width,
					height: shapeData.height
				});
			}
		}
		return results;
	}
}

const symbolLibrary = new SymbolLibrary();
export default symbolLibrary;
