import stage from './core/Stage.js';

import data from './data/Data.js';
import toolManager from './tools/ToolManager.js';
import fileManager from './core/FileManager.js';
import inspector from './core/Inspector.js';
import palettePanel from './core/PalettePanel.js';
import units from './core/Units.js';
import menuBar from './core/MenuBar.js';

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

// Wire up File menu items
document.getElementById('menuNew').addEventListener('click', () => fileManager.confirmIfDirty(() => fileManager.newDocument()));
document.getElementById('menuOpen').addEventListener('click', () => fileManager.confirmIfDirty(() => fileManager.open()));
document.getElementById('menuSave').addEventListener('click', () => fileManager.save());

// Import SVG
document.getElementById('menuImportSVG').addEventListener('click', () => {
	openSVGFile((shapes, fileName) => {
		if (shapes.length === 0) {
			alert('No shapes found in SVG file');
			return;
		}
		undoManager.execute(new AddShapesCommand(shapes));
		stage.render();
		console.log(`Imported ${shapes.length} shapes from ${fileName}`);
	});
});

// Export SVG
document.getElementById('menuExportSVG').addEventListener('click', () => {
	const paper = data.shapes.find(s => s.geometry === Shape.PAPER);
	if (!paper) {
		alert('Add a paper first (use the Paper tool to place one)');
		return;
	}
	const svg = exportToSVG([...data.shapes, ...data.getExportHatchLines()], paper);
	const fileName = fileManager.currentFileName
		? fileManager.currentFileName.replace(/\.[^.]+$/, '.svg')
		: 'drawing.svg';
	downloadSVG(svg, fileName);
});

// Export Gcode
document.getElementById('menuExportGcode').addEventListener('click', () => {
	const paper = data.shapes.find(s => s.geometry === Shape.PAPER);
	if (!paper) {
		alert('Add a paper first (use the Paper tool to place one)');
		return;
	}
	const gcode = exportToGcode([...data.shapes, ...data.getExportHatchLines()], paper);
	const fileName = fileManager.currentFileName
		? fileManager.currentFileName.replace(/\.[^.]+$/, '.gcode')
		: 'drawing.gcode';
	downloadGcode(gcode, fileName);
});

// Export DXF
document.getElementById('menuExportDXF').addEventListener('click', () => {
	const dxf = exportToDXF([...data.shapes, ...data.getExportHatchLines()]);
	const fileName = fileManager.currentFileName
		? fileManager.currentFileName.replace(/\.[^.]+$/, '.dxf')
		: 'drawing.dxf';
	downloadDXF(dxf, fileName);
});

document.addEventListener('contextmenu', (e) => {
	e.preventDefault();
});
