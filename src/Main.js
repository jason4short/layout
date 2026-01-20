import stage from './core/Stage.js';

import data from './data/Data.js';
import toolManager from './tools/ToolManager.js';
import fileManager from './core/FileManager.js';
import inspector from './core/Inspector.js';

import {Shape} from './geometry/Geometry.js';
import {Intersections} from './data/Intersections.js';
import {exportToSVG, downloadSVG} from './core/SVGExporter.js';


let intersections = new Intersections();

stage.init();
toolManager.init();
inspector.init();

// Wire up file operation buttons
document.getElementById('btnNew').addEventListener('click', () => fileManager.newDocument());
document.getElementById('btnOpen').addEventListener('click', () => fileManager.open());
document.getElementById('btnSave').addEventListener('click', () => fileManager.save());

// Export SVG button
document.getElementById('btnExportSVG').addEventListener('click', () => {
	const paper = data.shapes.find(s => s.geometry === Shape.PAPER);
	if (!paper) {
		alert('Add a paper first (use the Paper tool to place one)');
		return;
	}
	const svg = exportToSVG(data.shapes, paper);
	const fileName = fileManager.currentFileName
		? fileManager.currentFileName.replace(/\.[^.]+$/, '.svg')
		: 'drawing.svg';
	downloadSVG(svg, fileName);
});

document.addEventListener('contextmenu', (e) => {
//	if(e.target === canvas){
		e.preventDefault();
//	}
});		
