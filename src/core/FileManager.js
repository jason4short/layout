import data, { DEFAULT_LAYOUT, DEFAULT_SIZING, DEFAULT_PADDING } from '../data/Data.js';
import stage from './Stage.js';
import undoManager from './UndoManager.js';
import {showConfirmDialog} from './ConfirmDialog.js';

import {Shape} from '../geometry/Geometry.js';
import {Construction} from '../geometry/Construction.js';
import geometryFactory from '../geometry/GeometryFactory.js';

class FileManager
{
	constructor()
	{
		if(!FileManager.instance){
			FileManager.instance = this;
		}

		this.currentFileName = null;
		this.fileVersion = '1.1';
		this._dirty = false;
		this._baseTitle = 'Layout';

		// Storage properties
		this.storage = null;
		this.currentDocumentId = null;
		this.currentDocumentName = 'Untitled';
		this._autoSaveTimer = null;
		this._autoSaveDelay = 500; // ms debounce
		this._autoSaveEnabled = false;

		// Tab bar reference (set by Main.js)
		this.tabBar = null;

		// Mark dirty on any undo/redo stack change
		undoManager.onChange = () => {
			this._setDirty(true);
			data.hatchDirty = true;
		};

		// Warn before closing tab with unsaved changes (only when auto-save is off)
		window.addEventListener('beforeunload', (e) => {
			if (this._dirty && !this._autoSaveEnabled) {
				e.preventDefault();
				e.returnValue = '';
			}
		});

		return FileManager.instance;
	}

	get dirty() { return this._dirty; }

	_setDirty(value) {
		if (this._dirty === value) return;
		this._dirty = value;
		this._updateTitle();
	}

	_updateTitle() {
		const name = this.currentDocumentName || 'Untitled';
		const dirty = this._dirty ? ' *' : '';
		document.title = `${name} - ${this._baseTitle}${dirty}`;
		if (this.tabBar) {
			this.tabBar.updateForDocument(this.currentDocumentId, name, this._dirty);
		}
	}

	// Initialize storage provider and enable auto-save
	async initStorage(provider) {
		if (!await provider.isAvailable()) {
			console.warn('Storage not available, auto-save disabled');
			return;
		}
		this.storage = provider;
		this._autoSaveEnabled = true;

		// Rewire onChange to also trigger auto-save
		undoManager.onChange = () => {
			this._setDirty(true);
			data.hatchDirty = true;
			this._scheduleAutoSave();
		};
	}

	_scheduleAutoSave() {
		if (!this._autoSaveEnabled) return;
		clearTimeout(this._autoSaveTimer);
		this._autoSaveTimer = setTimeout(() => this._autoSave(), this._autoSaveDelay);
	}

	// Capture a small thumbnail of the current canvas (aspect-preserving crop)
	_captureThumbnail() {
		try {
			const canvas = stage.canvas;
			if (!canvas) return null;
			const thumbWidth = 400;
			const thumbHeight = 240;
			const thumb = document.createElement('canvas');
			thumb.width = thumbWidth;
			thumb.height = thumbHeight;
			const ctx = thumb.getContext('2d');

			// Cover-crop: scale source to fill thumb, center the crop
			const srcW = canvas.width;
			const srcH = canvas.height;
			const srcAspect = srcW / srcH;
			const thumbAspect = thumbWidth / thumbHeight;
			let sx, sy, sw, sh;
			if (srcAspect > thumbAspect) {
				// Source is wider - crop sides
				sh = srcH;
				sw = srcH * thumbAspect;
				sx = (srcW - sw) / 2;
				sy = 0;
			} else {
				// Source is taller - crop top/bottom
				sw = srcW;
				sh = srcW / thumbAspect;
				sx = 0;
				sy = (srcH - sh) / 2;
			}
			ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, thumbWidth, thumbHeight);
			return thumb.toDataURL('image/png', 0.7);
		} catch (e) {
			return null;
		}
	}

	// True if document has no geometry worth saving
	_isDocumentEmpty() {
		return data.shapes.length === 0 && data.constructions.length === 0;
	}

	// Delete the current document from storage if it's empty
	async _cleanupEmptyDocument() {
		if (!this.storage || !this.currentDocumentId) return;
		if (this._isDocumentEmpty()) {
			const docId = this.currentDocumentId;
			await this.storage.deleteDocument(docId);
			if (this.tabBar) this.tabBar.removeTab(docId);
			this.currentDocumentId = null;
		}
	}

	async _autoSave() {
		if (!this.storage || !this.currentDocumentId) return;
		// Don't save empty documents
		if (this._isDocumentEmpty()) return;
		try {
			const json = this.toJSON();
			const thumbnail = this._captureThumbnail();
			await this.storage.saveDocument({
				id: this.currentDocumentId,
				name: this.currentDocumentName,
				data: json,
				thumbnail: thumbnail
			});
			this._setDirty(false);
		} catch (err) {
			console.error('Auto-save failed:', err);
		}
	}

	// Save current document to storage (create or update)
	async saveToStorage(name) {
		if (!this.storage) return null;
		const json = this.toJSON();
		const thumbnail = this._captureThumbnail();
		const docName = name || this.currentDocumentName || 'Untitled';
		const id = await this.storage.saveDocument({
			id: this.currentDocumentId,
			name: docName,
			data: json,
			thumbnail: thumbnail
		});
		this.currentDocumentId = id;
		this.currentDocumentName = docName;
		this._setDirty(false);
		return id;
	}

	// Rename the current document (saves even if document is empty)
	async renameDocument(newName) {
		if (!newName || !newName.trim()) return;
		this.currentDocumentName = newName.trim();
		this._updateTitle();
		if (this.storage && this.currentDocumentId) {
			const json = this.toJSON();
			const thumbnail = this._captureThumbnail();
			await this.storage.saveDocument({
				id: this.currentDocumentId,
				name: this.currentDocumentName,
				data: json,
				thumbnail: thumbnail
			});
			this._setDirty(false);
		}
	}

	// Load a document from storage by id
	async loadFromStorage(id) {
		if (!this.storage) return false;
		// Clean up current doc if it's empty before switching
		await this._cleanupEmptyDocument();
		const doc = await this.storage.loadDocument(id);
		if (!doc) {
			console.error('Document not found:', id);
			return false;
		}
		this.fromJSON(doc.data);
		this.currentDocumentId = doc.id;
		this.currentDocumentName = doc.name;
		if (this.tabBar) {
			await this.tabBar.openTab(doc.id, doc.name);
		}
		this._updateTitle();
		document.dispatchEvent(new CustomEvent('document-loaded'));
		return true;
	}

	// Show confirmation dialog if there are unsaved changes, then run callback
	confirmIfDirty(callback) {
		if (!this._dirty) {
			callback();
			return;
		}
		showConfirmDialog('You have unsaved changes that will be lost. Continue without saving?', callback);
	}

	// Serialize all document data to JSON
	toJSON()
	{
		const shapes = data.shapes.map(shape => {
			const json = shape.toJSON();
			json.id = shape.id;
			if(shape.groupId) json.groupId = shape.groupId;
			if(shape.frameId) json.frameId = shape.frameId;
			return json;
		});
		const constructions = data.constructions.map(c => c.toJSON());

		const groups = [];
		for(const [id, group] of data.groups){
			const groupData = {
				id: group.id,
				parentId: group.parentId,
				layout: group.layout || { ...DEFAULT_LAYOUT }
			};
			if(group.isSymbolSource){
				groupData.isSymbolSource = true;
				groupData.symbolName = group.symbolName || 'Symbol';
			}
			if(group.hatchType && group.hatchType !== 'none'){
				groupData.hatchType = group.hatchType;
				groupData.hatchAngle = group.hatchAngle;
				groupData.hatchSpacing = group.hatchSpacing;
			}
			groups.push(groupData);
		}

		return {
			version: this.fileVersion,
			viewport: {
				panX: stage.panX,
				panY: stage.panY,
				zoom: stage.zoom
			},
			shapes: shapes,
			constructions: constructions,
			groups: groups,
			colorPalette: data.colorPalette,
			backgroundColor: data.backgroundColor,
			theme: data.theme,
			penStyleOverrides: data.penStyleOverrides,
			gridVisible: data.gridVisible,
			snapToGrid: data.snapToGrid,
			linkedLibraries: data.linkedLibraries.length > 0 ? data.linkedLibraries : undefined
		};
	}

	// Deserialize from JSON and rebuild document
	fromJSON(json)
	{
		data.shapes = [];
		data.constructions = [];
		data.intersectionSet.clear();
		data.intersectionsByShape.clear();
		data.spatialGrid.clear();
		data.shapePOIs = [];
		data.selectedPoints.clear();
		data.resetSnaps();
		data.clearGuides();
		data.groups.clear();
		data._nextGroupId = 1;
		data.exitGroup();
		data.clearActiveFrame();
		undoManager.clear();

		if(json.viewport){
			stage.panX = json.viewport.panX || 0;
			stage.panY = json.viewport.panY || 0;
			stage.zoom = json.viewport.zoom || 1;
		}

		if(json.groups){
			let maxId = 0;
			for(const groupData of json.groups){
				const group = {
					id: groupData.id,
					parentId: groupData.parentId || null,
					layout: groupData.layout || { ...DEFAULT_LAYOUT }
				};
				if(groupData.isSymbolSource){
					group.isSymbolSource = true;
					group.symbolName = groupData.symbolName || 'Symbol';
				}
				if(groupData.hatchType){
					group.hatchType = groupData.hatchType;
					group.hatchAngle = groupData.hatchAngle;
					group.hatchSpacing = groupData.hatchSpacing;
				}
				data.groups.set(groupData.id, group);
				const match = groupData.id.match(/group_(\d+)/);
				if(match) maxId = Math.max(maxId, parseInt(match[1]));
			}
			data._nextGroupId = maxId + 1;
		}

		if(json.colorPalette){
			data.colorPalette = json.colorPalette;
		}
		if(json.backgroundColor){
			data.backgroundColor = json.backgroundColor;
		}
		if(json.theme){
			data.theme = json.theme;
		}
		if(json.penStyleOverrides){
			data.penStyleOverrides = json.penStyleOverrides;
		}
		if(json.gridVisible !== undefined){
			data.gridVisible = json.gridVisible;
		}
		if(json.snapToGrid !== undefined){
			data.snapToGrid = json.snapToGrid;
		}
		data.linkedLibraries = json.linkedLibraries || [];

		const idMap = new Map();
		const pendingFrameIds = [];
		const pendingSourceFrameIds = [];

		if(json.shapes){
			for(const shapeData of json.shapes){
				const shape = this.createShapeFromJSON(shapeData);
				if(shape){
					const oldId = shapeData.id;
					if(shapeData.groupId) shape.groupId = shapeData.groupId;
					if(shapeData.frameId){
						pendingFrameIds.push({ shape, oldFrameId: shapeData.frameId });
					}
					if(shape.geometry === Shape.SYMBOL && shape.sourceFrameId){
						pendingSourceFrameIds.push({ shape, oldSourceFrameId: shape.sourceFrameId });
					}
					data.addShape(shape);
					if(oldId){
						idMap.set(oldId, shape.id);
					}
				}
			}
		}

		for(const { shape, oldFrameId } of pendingFrameIds){
			const newFrameId = idMap.get(oldFrameId);
			if(newFrameId){
				shape.frameId = newFrameId;
			} else {
				console.warn('FileManager: Could not remap frameId', oldFrameId);
			}
		}

		for(const { shape, oldSourceFrameId } of pendingSourceFrameIds){
			const newSourceFrameId = idMap.get(oldSourceFrameId);
			if(newSourceFrameId){
				shape.sourceFrameId = newSourceFrameId;
				shape.update();
			} else {
				console.warn('FileManager: Could not remap sourceFrameId', oldSourceFrameId);
			}
		}

		if(json.constructions){
			for(const conData of json.constructions){
				const construction = Construction.fromJSON(conData);
				if(construction){
					data.addConstruction(construction);
				}
			}
		}

		for (const shape of data.shapes) {
			if (shape.geometry === Shape.ANGLE_DIMENSION) {
				if (shape._line1Id) {
					const remapped = idMap.get(shape._line1Id);
					if (remapped) {
						shape._line1Id = remapped;
					} else {
						console.warn('FileManager: Could not remap angle dimension line1Id', shape._line1Id);
						shape._line1Id = null;
					}
				}
				if (shape._line2Id) {
					const remapped = idMap.get(shape._line2Id);
					if (remapped) {
						shape._line2Id = remapped;
					} else {
						console.warn('FileManager: Could not remap angle dimension line2Id', shape._line2Id);
						shape._line2Id = null;
					}
				}
			}
		}

		const shapesById = new Map();
		for(const shape of data.shapes){
			if(shape.id) shapesById.set(shape.id, shape);
		}
		for(const shape of data.shapes){
			if(shape.geometry === Shape.ANGLE_DIMENSION && shape.linkLines){
				shape.linkLines(shapesById);
			}
		}

		data.rebuildPOIs();
		this._setDirty(false);
		stage.render();
	}

	// Factory method to create shapes from JSON
	createShapeFromJSON(shapeData)
	{
		return geometryFactory.fromJSON(shapeData);
	}

	// Export document to file (triggers download)
	exportFile(fileName)
	{
		const name = fileName || this.currentDocumentName || 'drawing';
		const fullName = name.endsWith('.cadc') ? name : `${name}.cadc`;

		const json = this.toJSON();
		const jsonString = JSON.stringify(json, null, 2);
		const blob = new Blob([jsonString], { type: 'application/json' });

		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = fullName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		this.currentFileName = fullName;
		console.log('Exported:', fullName);
	}

	// Import file from disk via file picker
	importFile()
	{
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.cadc,.json';

		input.onchange = async (e) => {
			const file = e.target.files[0];
			if(!file) return;

			const reader = new FileReader();
			reader.onload = async (event) => {
				try {
					const json = JSON.parse(event.target.result);
					this.fromJSON(json);
					this.currentFileName = file.name;

					// Save imported file into storage so auto-save works
					if (this.storage) {
						const docName = file.name.replace(/\.[^.]+$/, '');
						this.currentDocumentId = null; // force new entry
						await this.saveToStorage(docName);
						if (this.tabBar) {
							await this.tabBar.openTab(this.currentDocumentId, docName);
						}
					}

					document.dispatchEvent(new CustomEvent('document-loaded'));
					console.log('Imported:', file.name);
				} catch(err){
					console.error('Failed to load file:', err);
					alert('Failed to load file. Invalid format.');
				}
			};
			reader.readAsText(file);
		};

		input.click();
	}

	// Legacy alias
	open() { this.importFile(); }
	save(fileName) { this.exportFile(fileName); }

	// Create new document (clear everything)
	async newDocument()
	{
		data.shapes = [];
		data.constructions = [];
		data.intersectionSet.clear();
		data.intersectionsByShape.clear();
		data.spatialGrid.clear();
		data.shapePOIs = [];
		data.selectedPoints.clear();
		data.resetSnaps();
		data.clearGuides();
		data.groups.clear();
		data._nextGroupId = 1;
		data.linkedLibraries = [];
		data.libraryCache.clear();
		data.exitGroup();
		data.clearActiveFrame();
		data.backgroundColor = '#F0F0F0';
		data.theme = 'light';
		data.penStyleOverrides = {};
		data.gridVisible = false;
		data.snapToGrid = false;
		undoManager.clear();

		stage.panX = 0;
		stage.panY = 0;
		stage.zoom = 1;

		this.currentFileName = null;

		// Create a new storage entry so auto-save has a target
		if (this.storage) {
			this.currentDocumentId = null; // force new entry
			this.currentDocumentName = 'Untitled';
			await this.saveToStorage('Untitled');
		} else {
			this.currentDocumentId = null;
			this.currentDocumentName = 'Untitled';
		}

		this._setDirty(false);
		this._updateTitle();
		if (this.tabBar) {
			await this.tabBar.openTab(this.currentDocumentId, this.currentDocumentName);
		}
		stage.render();
		console.log('New document created');
	}
}

const fileManager = new FileManager();
export default fileManager;
