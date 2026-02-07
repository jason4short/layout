import stage from './core/Stage.js';

import data from './data/Data.js';
import toolManager from './tools/ToolManager.js';
import fileManager from './core/FileManager.js';
import inspector from './core/Inspector.js';
import palettePanel from './core/PalettePanel.js';
import units from './core/Units.js';

import {Shape} from './geometry/Geometry.js';
import {Intersections} from './data/Intersections.js';
import {exportToSVG, downloadSVG} from './core/SVGExporter.js';
import {exportToGcode, downloadGcode} from './core/GcodeExporter.js';
import {exportToDXF, downloadDXF} from './core/DXFExporter.js';
import {openSVGFile} from './core/SVGImporter.js';
import undoManager from './core/UndoManager.js';
import {AddShapesCommand} from './core/Commands.js';


let intersections = new Intersections();

stage.init();
toolManager.init();
inspector.init();
palettePanel.init();

// Coordinate display
const coordDisplay = document.getElementById('coordDisplay');
stage.onMouseMoveCallback = (worldX, worldY) => {
	if (coordDisplay) {
		const x = units.format(worldX, undefined, false);
		const y = units.format(worldY, undefined, false);
		coordDisplay.textContent = `X: ${x}  Y: ${y}`;
	}
};

// Wire up file operation buttons
document.getElementById('btnNew').addEventListener('click', () => fileManager.newDocument());
document.getElementById('btnOpen').addEventListener('click', () => fileManager.open());
document.getElementById('btnSave').addEventListener('click', () => fileManager.save());

// Import SVG button
document.getElementById('btnImportSVG').addEventListener('click', () => {
	openSVGFile((shapes, fileName) => {
		if (shapes.length === 0) {
			alert('No shapes found in SVG file');
			return;
		}
		// Add all imported shapes with undo support
		undoManager.execute(new AddShapesCommand(shapes));
		stage.render();
		console.log(`Imported ${shapes.length} shapes from ${fileName}`);
	});
});

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

// Export Gcode button
document.getElementById('btnExportGcode').addEventListener('click', () => {
	const paper = data.shapes.find(s => s.geometry === Shape.PAPER);
	if (!paper) {
		alert('Add a paper first (use the Paper tool to place one)');
		return;
	}
	const gcode = exportToGcode(data.shapes, paper);
	const fileName = fileManager.currentFileName
		? fileManager.currentFileName.replace(/\.[^.]+$/, '.gcode')
		: 'drawing.gcode';
	downloadGcode(gcode, fileName);
});

// Export DXF button
document.getElementById('btnExportDXF').addEventListener('click', () => {
	const dxf = exportToDXF(data.shapes);
	const fileName = fileManager.currentFileName
		? fileManager.currentFileName.replace(/\.[^.]+$/, '.dxf')
		: 'drawing.dxf';
	downloadDXF(dxf, fileName);
});

document.addEventListener('contextmenu', (e) => {
//	if(e.target === canvas){
		e.preventDefault();
//	}
});		
