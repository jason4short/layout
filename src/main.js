//  Copyright (c) 2026 Jason Short. All rights reserved.
/*
This software is based on some early ideas by a hero of mine, Dr. Martin Newell. 

Martin wrote the Draffting Assistant and the app Vellum which I used as an Industrial Designer. 

I always missed having that tool around so I thought I would make my own version based on his expired patent. 
https://patents.google.com/patent/US5123087
                                      
                                                                                 
                                     .::.                                        
                                  :-::::::=:                                     
                                    -=====                                       
                           :-==+*#%@#=::=+*****==-:.                             
               .:--::. =**+*+++***++=========+++++****=.                         
             :::::::::+==============================++=.                        
             :-*     +==---:---=================------===                        
             :-+:   ===-:::::...................:::::-====         .:::...::.    
              :=*. -+=--:::::...          ......:::::--===-       --:..::..      
              .:=*:+==-:::::...           ......::::::--==+.     =:  ::          
               .:=*==-::::::...         .. ......:::::--===+    =: .::           
                .=+=--:::::...            .......::::::--==+=  :: .::            
                 ===--:::::..              .......:::::--===%:#-  :-:            
                 ===-:::::..               .......::::::-=====:  :=-             
                .===-:::::..                 ......::::::::::.  :-=              
                 ==--::::..                  ......:::::.     .:-=               
                 :==-::::...                  .....::::::..  :-=.                
                  :==-::::..                 .....:::::-===:..                   
                    -=-:::::...            ......:::::-==-                       
                    .:===--:::::...        ...:::::-====::                       
                   .::::-=====--:::::....:::::--=====-:::::.                     
                  ..:::::::::--=================--::::::::::                     
                    ...:::::::::::::::::::::::::...                              
                            ...........                                          
                                                                                 

*/







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
import tabBar, { TabBar } from './core/TabBar.js';


let intersections = new Intersections();

stage.init();
toolManager.init();
inspector.init();
palettePanel.init();

// Initialize storage and auto-load most recent document
const storageProvider = new IndexedDBProvider();
await fileManager.initStorage(storageProvider);
fileManager.tabBar = tabBar;

if (fileManager.storage) {
	const saved = TabBar.loadState();
	const docs = await fileManager.storage.listDocuments();
	const docIds = new Set(docs.map(d => d.id));

	if (saved && saved.tabs.length > 0) {
		// Restore saved tabs, skipping any that were deleted
		const validTabs = saved.tabs.filter(t => docIds.has(t.docId));
		if (validTabs.length > 0) {
			const activeIdx = Math.min(saved.activeIndex, validTabs.length - 1);
			// Load the active document
			await fileManager.loadFromStorage(validTabs[activeIdx].docId);
			// Rebuild tab array with fresh names from IndexedDB
			const docMap = new Map(docs.map(d => [d.id, d.name]));
			tabBar.tabs = validTabs.map(t => ({ docId: t.docId, name: docMap.get(t.docId) || t.name, dirty: false }));
			tabBar.activeIndex = activeIdx;
			tabBar._render();
		} else {
			await fileManager.newDocument();
		}
	} else if (docs.length > 0) {
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
	// Auto-save current doc before creating new one
	if (fileManager.storage && fileManager.currentDocumentId) {
		await fileManager._autoSave();
	}
	await fileManager.newDocument();
	inspector.update();
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
document.getElementById('menuShowAll').addEventListener('click', () => {
	stage.zoomToFit(false);
});
document.getElementById('menuClearGuides').addEventListener('click', () => {
	data.deleteConstructions();
	data.clearGuides();
	stage.render();
});

// Help panel
const helpPanel = document.getElementById('helpPanel');
document.getElementById('menuHelpOpen').addEventListener('click', () => {
	helpPanel.classList.remove('hidden');
});
document.getElementById('helpCloseBtn').addEventListener('click', () => {
	helpPanel.classList.add('hidden');
});
helpPanel.addEventListener('click', (e) => {
	if (e.target === helpPanel) helpPanel.classList.add('hidden');
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

	// Sync view menu checkmarks with loaded document state
	document.getElementById('menuToggleGrid').classList.toggle('unchecked', !data.gridVisible);
	document.getElementById('menuToggleSnapGrid').classList.toggle('unchecked', !data.snapToGrid);

	stage.render();
});

document.addEventListener('contextmenu', (e) => {
	e.preventDefault();
});
