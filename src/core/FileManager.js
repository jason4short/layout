import data from '../data/Data.js';
import stage from './Stage.js';
import undoManager from './UndoManager.js';

import {Shape} 				from '../geometry/Geometry.js';
import {Line} 				from '../geometry/Line.js';
import {Circle} 			from '../geometry/Circle.js';
import {Arc} 				from '../geometry/Arc.js';
import {TangentArc} 		from '../geometry/TangentArc.js';
import {Ellipse} 			from '../geometry/Ellipse.js';
import {EllipticalArc} 		from '../geometry/EllipticalArc.js';
import {Spline} 			from '../geometry/Spline.js';
import {Image} 				from '../geometry/Image.js';


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

		return FileManager.instance;
	}

	// Serialize all document data to JSON
	toJSON()
	{
		const shapes = data.shapes.map(shape => shape.toJSON());
		const constructions = data.constructions.map(c => c.toJSON());

		return {
			version: this.fileVersion,
			viewport: {
				panX: stage.panX,
				panY: stage.panY,
				zoom: stage.zoom
			},
			shapes: shapes,
			constructions: constructions
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
		undoManager.clear();

		// Restore viewport
		if(json.viewport){
			stage.panX = json.viewport.panX || 0;
			stage.panY = json.viewport.panY || 0;
			stage.zoom = json.viewport.zoom || 1;
		}

		// Recreate shapes
		if(json.shapes){
			for(const shapeData of json.shapes){
				const shape = this.createShapeFromJSON(shapeData);
				if(shape){
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
