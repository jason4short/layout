import data from '../data/Data.js';
import stage from './Stage.js';
import undoManager from './UndoManager.js';
import symbolLibrary from './SymbolLibrary.js';

import {Shape} 				from '../geometry/Geometry.js';
import {Line} 				from '../geometry/Line.js';
import {Circle} 			from '../geometry/Circle.js';
import {Arc} 				from '../geometry/Arc.js';
import {TangentArc} 		from '../geometry/TangentArc.js';
import {Ellipse} 			from '../geometry/Ellipse.js';
import {EllipticalArc} 		from '../geometry/EllipticalArc.js';
import {Spline} 			from '../geometry/Spline.js';
import {Image} 				from '../geometry/Image.js';
import {Dimension} 			from '../geometry/Dimension.js';
import {RadialDimension} 	from '../geometry/RadialDimension.js';
import {Text} 				from '../geometry/Text.js';
import {Paper} 				from '../geometry/Paper.js';
import {SymbolInstance} 	from '../geometry/Symbol.js';

import {Construction} from '../geometry/Construction.js';

class FileManager
{
	constructor()
	{
		if(!FileManager.instance){
			FileManager.instance = this;
		}

		this.currentFileName = null;
		this.fileVersion = '1.0';

		// Initialize symbol library with shape factory (deferred to avoid circular dep issues)
		setTimeout(() => {
			symbolLibrary.setShapeFactory((shapeData) => this.createShapeFromJSON(shapeData));
		}, 0);

		return FileManager.instance;
	}

	// Serialize all document data to JSON
	toJSON()
	{
		// Serialize shapes, including groupId
		const shapes = data.shapes.map(shape => {
			const json = shape.toJSON();
			if(shape.groupId) json.groupId = shape.groupId;
			return json;
		});
		const constructions = data.constructions.map(c => c.toJSON());

		// Serialize groups
		const groups = [];
		for(const [id, group] of data.groups){
			groups.push({ id: group.id, parentId: group.parentId });
		}

		// Collect symbol definitions used by symbol instances in this document
		const usedDefinitionIds = new Set();
		for(const shape of data.shapes){
			if(shape.geometry === Shape.SYMBOL && shape.definitionId){
				usedDefinitionIds.add(shape.definitionId);
			}
		}
		const symbolDefinitions = [];
		for(const id of usedDefinitionIds){
			const def = symbolLibrary.getDefinition(id);
			if(def){
				symbolDefinitions.push(def.toJSON());
			}
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
			symbolDefinitions: symbolDefinitions
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
		undoManager.clear();

		// Restore viewport
		if(json.viewport){
			stage.panX = json.viewport.panX || 0;
			stage.panY = json.viewport.panY || 0;
			stage.zoom = json.viewport.zoom || 1;
		}

		// Restore groups
		if(json.groups){
			let maxId = 0;
			for(const groupData of json.groups){
				data.groups.set(groupData.id, { id: groupData.id, parentId: groupData.parentId || null });
				// Track highest group ID number for _nextGroupId
				const match = groupData.id.match(/group_(\d+)/);
				if(match) maxId = Math.max(maxId, parseInt(match[1]));
			}
			data._nextGroupId = maxId + 1;
		}

		// Recreate shapes
		if(json.shapes){
			for(const shapeData of json.shapes){
				const shape = this.createShapeFromJSON(shapeData);
				if(shape){
					// Restore groupId if present
					if(shapeData.groupId) shape.groupId = shapeData.groupId;
					data.addShape(shape);
				}
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

		// Load symbol definitions embedded in the file
		if(json.symbolDefinitions){
			for(const defData of json.symbolDefinitions){
				symbolLibrary.importDefinition(defData);
			}
		}

		// Link symbol instances to their definitions
		for(const shape of data.shapes){
			if(shape.geometry === Shape.SYMBOL){
				symbolLibrary.linkInstance(shape);
			}
		}

		stage.render();
	}

	// Factory method to create shapes from JSON based on geometry type
	createShapeFromJSON(shapeData)
	{
		switch(shapeData.geometry){
			case Shape.LINE:
				return Line.fromJSON(shapeData);
			case Shape.CIRCLE:
				return Circle.fromJSON(shapeData);
			case Shape.ARC:
				return Arc.fromJSON(shapeData);
			case Shape.TANGENT_ARC:
				return TangentArc.fromJSON(shapeData);
			case Shape.ELLIPSE:
				return Ellipse.fromJSON(shapeData);
			case Shape.SPLINE:
				return Spline.fromJSON(shapeData);
			case Shape.ELLIPTICAL_ARC:
				return EllipticalArc.fromJSON(shapeData);
			case Shape.IMAGE:
				return Image.fromJSON(shapeData);
			case Shape.DIMENSION:
				return Dimension.fromJSON(shapeData);
			case Shape.RADIAL_DIMENSION:
				return RadialDimension.fromJSON(shapeData);
			case Shape.TEXT:
				return Text.fromJSON(shapeData);
			case Shape.PAPER:
				return Paper.fromJSON(shapeData);
			case Shape.SYMBOL:
				return SymbolInstance.fromJSON(shapeData);
			default:
				console.warn('Unknown geometry type:', shapeData.geometry);
				return null;
		}
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
