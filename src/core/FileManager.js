import data, { DEFAULT_LAYOUT, DEFAULT_SIZING, DEFAULT_PADDING } from '../data/Data.js';
import stage from './Stage.js';
import undoManager from './UndoManager.js';

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
		this.fileVersion = '1.1';  // Updated version for new symbol model

		return FileManager.instance;
	}

	// Serialize all document data to JSON
	toJSON()
	{
		// Serialize shapes, including id, groupId, frameId
		const shapes = data.shapes.map(shape => {
			const json = shape.toJSON();
			json.id = shape.id;  // Preserve shape ID for references
			if(shape.groupId) json.groupId = shape.groupId;
			if(shape.frameId) json.frameId = shape.frameId;
			return json;
		});
		const constructions = data.constructions.map(c => c.toJSON());

		// Serialize groups with layout properties and symbol source info
		const groups = [];
		for(const [id, group] of data.groups){
			const groupData = {
				id: group.id,
				parentId: group.parentId,
				layout: group.layout || { ...DEFAULT_LAYOUT }
			};
			// Save symbol source properties if present
			if(group.isSymbolSource){
				groupData.isSymbolSource = true;
				groupData.symbolName = group.symbolName || 'Symbol';
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
			penStyleOverrides: data.penStyleOverrides
		};
	}

	// Deserialize from JSON and rebuild document
	fromJSON(json)
	{
		// Clear existing data
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

		// Restore viewport
		if(json.viewport){
			stage.panX = json.viewport.panX || 0;
			stage.panY = json.viewport.panY || 0;
			stage.zoom = json.viewport.zoom || 1;
		}

		// Restore groups with layout properties and symbol source info
		if(json.groups){
			let maxId = 0;
			for(const groupData of json.groups){
				const group = {
					id: groupData.id,
					parentId: groupData.parentId || null,
					layout: groupData.layout || { ...DEFAULT_LAYOUT }
				};
				// Restore symbol source properties if present
				if(groupData.isSymbolSource){
					group.isSymbolSource = true;
					group.symbolName = groupData.symbolName || 'Symbol';
				}
				data.groups.set(groupData.id, group);
				// Track highest group ID number for _nextGroupId
				const match = groupData.id.match(/group_(\d+)/);
				if(match) maxId = Math.max(maxId, parseInt(match[1]));
			}
			data._nextGroupId = maxId + 1;
		}

		// Restore color palette
		if(json.colorPalette){
			data.colorPalette = json.colorPalette;
		}

		// Restore background color
		if(json.backgroundColor){
			data.backgroundColor = json.backgroundColor;
		}

		// Restore theme settings
		if(json.theme){
			data.theme = json.theme;
		}
		if(json.penStyleOverrides){
			data.penStyleOverrides = json.penStyleOverrides;
		}

		// Recreate shapes - track old ID → new ID mapping for references
		const idMap = new Map();  // oldId → newId
		const pendingFrameIds = [];  // shapes that need frameId remapped
		const pendingSourceFrameIds = [];  // SymbolInstances that need sourceFrameId remapped

		if(json.shapes){
			for(const shapeData of json.shapes){
				const shape = this.createShapeFromJSON(shapeData);
				if(shape){
					const oldId = shapeData.id;

					// Restore groupId if present
					if(shapeData.groupId) shape.groupId = shapeData.groupId;

					// Track frameId for later remapping
					if(shapeData.frameId){
						pendingFrameIds.push({ shape, oldFrameId: shapeData.frameId });
					}

					// Track SymbolInstance sourceFrameId for later remapping
					if(shape.geometry === Shape.SYMBOL && shape.sourceFrameId){
						pendingSourceFrameIds.push({ shape, oldSourceFrameId: shape.sourceFrameId });
					}

					data.addShape(shape);

					// Map old ID to new ID
					if(oldId){
						idMap.set(oldId, shape.id);
					}
				}
			}
		}

		// Remap frameId references
		for(const { shape, oldFrameId } of pendingFrameIds){
			const newFrameId = idMap.get(oldFrameId);
			if(newFrameId){
				shape.frameId = newFrameId;
			} else {
				console.warn('FileManager: Could not remap frameId', oldFrameId);
			}
		}

		// Remap SymbolInstance sourceFrameId references
		for(const { shape, oldSourceFrameId } of pendingSourceFrameIds){
			const newSourceFrameId = idMap.get(oldSourceFrameId);
			if(newSourceFrameId){
				shape.sourceFrameId = newSourceFrameId;
				shape.update();  // Recalculate bounds with valid source
			} else {
				console.warn('FileManager: Could not remap sourceFrameId', oldSourceFrameId);
			}
		}

		// Recreate constructions
		if(json.constructions){
			for(const conData of json.constructions){
				const construction = Construction.fromJSON(conData);
				if(construction){
					data.addConstruction(construction);
				}
			}
		}

		// Link angle dimensions to their referenced lines
		// Remap stored line reference IDs from old->new shape IDs before linking.
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

		// Rebuild POIs now that all frameId references are valid
		data.rebuildPOIs();

		stage.render();
	}

	// Factory method to create shapes from JSON based on geometry type
	createShapeFromJSON(shapeData)
	{
		return geometryFactory.fromJSON(shapeData);
	}

	// Save document to file (triggers download)
	save(fileName = 'drawing.cadc')
	{
		const json = this.toJSON();
		const jsonString = JSON.stringify(json, null, 2);
		const blob = new Blob([jsonString], { type: 'application/json' });

		// Create download link
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		this.currentFileName = fileName;
		console.log('Saved:', fileName);
	}

	// Open file picker and load document
	open()
	{
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.cadc,.json';

		input.onchange = (e) => {
			const file = e.target.files[0];
			if(!file) return;

			const reader = new FileReader();
			reader.onload = (event) => {
				try {
					const json = JSON.parse(event.target.result);
					this.fromJSON(json);
					this.currentFileName = file.name;
					console.log('Loaded:', file.name);
				} catch(err){
					console.error('Failed to load file:', err);
					alert('Failed to load file. Invalid format.');
				}
			};
			reader.readAsText(file);
		};

		input.click();
	}

	// Create new document (clear everything)
	newDocument()
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
		data.exitGroup();
		data.clearActiveFrame();
		undoManager.clear();

		stage.panX = 0;
		stage.panY = 0;
		stage.zoom = 1;

		this.currentFileName = null;
		stage.render();
		console.log('New document created');
	}
}

const fileManager = new FileManager();
export default fileManager;
