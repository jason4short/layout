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
import undoManager from './core/UndoManager.js';
import symbolLibrary from './core/SymbolLibrary.js';

import IndexedDBProvider from './core/IndexedDBProvider.js';
import DocumentBrowser from './core/DocumentBrowser.js';
import SymbolBrowser from './core/SymbolBrowser.js';


let intersections = new Intersections();

stage.init();
toolManager.init();
inspector.init();
palettePanel.init();

// Initialize storage and auto-load most recent document
const storageProvider = new IndexedDBProvider();
await fileManager.initStorage(storageProvider);

if (fileManager.storage) {
	const docs = await fileManager.storage.listDocuments();
	if (docs.length > 0) {
		await fileManager.loadFromStorage(docs[0].id); // most recent
	} else {
		await fileManager.newDocument();
	}
} else {
	fileManager._updateTitle();
}

// Document browser
const documentBrowser = new DocumentBrowser();

// Symbol library browser
const symbolBrowser = new SymbolBrowser();

// Wire up File menu items
document.getElementById('menuNew').addEventListener('click', async () => {
	fileManager.confirmIfDirty(async () => {
		await fileManager.newDocument();
		inspector.update();
	});
});
document.getElementById('menuDocuments').addEventListener('click', () => documentBrowser.open());
document.getElementById('menuSymbolLibrary').addEventListener('click', () => symbolBrowser.open());
document.getElementById('menuImportFile').addEventListener('click', () => {
	fileManager.confirmIfDirty(() => fileManager.importFile());
});
document.getElementById('menuExportFile').addEventListener('click', () => fileManager.exportFile());

// Export SVG
document.getElementById('menuExportSVG').addEventListener('click', () => {
	const paper = data.shapes.find(s => s.geometry === Shape.PAPER);
	if (!paper) {
		alert('Add a paper first (use the Paper tool to place one)');
		return;
	}
	const svg = exportToSVG([...data.shapes, ...data.getExportHatchLines()], paper);
	const fileName = fileManager.currentDocumentName
		? fileManager.currentDocumentName.replace(/\.[^.]+$/, '') + '.svg'
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
	const fileName = fileManager.currentDocumentName
		? fileManager.currentDocumentName.replace(/\.[^.]+$/, '') + '.gcode'
		: 'drawing.gcode';
	downloadGcode(gcode, fileName);
});

// Export DXF
document.getElementById('menuExportDXF').addEventListener('click', () => {
	const dxf = exportToDXF([...data.shapes, ...data.getExportHatchLines()]);
	const fileName = fileManager.currentDocumentName
		? fileManager.currentDocumentName.replace(/\.[^.]+$/, '') + '.dxf'
		: 'drawing.dxf';
	downloadDXF(dxf, fileName);
});

// Wire up View menu items
document.getElementById('menuToggleGrid').addEventListener('click', () => {
	data.gridVisible = !data.gridVisible;
	document.getElementById('menuToggleGrid').classList.toggle('unchecked', !data.gridVisible);
	stage.render();
});
document.getElementById('menuToggleSnapGrid').addEventListener('click', () => {
	data.snapToGrid = !data.snapToGrid;
	document.getElementById('menuToggleSnapGrid').classList.toggle('unchecked', !data.snapToGrid);
});

// Load library symbol cache after loading a document
// Then update library instances (their bounds/POIs need the cache)
document.addEventListener('document-loaded', async () => {
	await symbolLibrary.loadCache();

	// Update all library instances now that cache is available
	for (const shape of data.shapes) {
		if (shape.geometry === Shape.SYMBOL && shape.libraryDocId) {
			shape.update();
		}
	}
	data.rebuildPOIs();

	stage.render();
});

document.addEventListener('contextmenu', (e) => {
	e.preventDefault();
});
