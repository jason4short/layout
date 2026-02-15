// Symbol library browser - shows symbols from linked documents

import symbolLibrary from './SymbolLibrary.js';
import fileManager from './FileManager.js';
import undoManager from './UndoManager.js';
import stage from './Stage.js';
import data from '../data/Data.js';
import { PlaceLibrarySymbolCommand } from './Commands.js';
import { SymbolInstance } from '../geometry/Symbol.js';

class SymbolBrowser {
	constructor() {
		this.overlay = document.getElementById('symbolBrowser');
		this.gridEl = document.getElementById('symbolGrid');
		this.searchEl = document.getElementById('symbolSearch');

		this.overlay.addEventListener('click', (e) => {
			if (e.target === this.overlay) this.close();
		});

		document.getElementById('symbolCloseBtn').addEventListener('click', () => this.close());
		this.searchEl.addEventListener('input', () => this._filterCards());
		document.getElementById('symbolLinkBtn').addEventListener('click', () => this._linkLibrary());

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
				this.close();
			}
		});

		this._allCards = [];
		this._symbols = [];
	}

	async open() {
		this._symbols = await symbolLibrary.getLinkedSymbols();
		this._renderGrid();
		this.searchEl.value = '';
		this.overlay.classList.remove('hidden');
		this.searchEl.focus();
	}

	close() {
		this.overlay.classList.add('hidden');
	}

	_renderGrid() {
		this.gridEl.innerHTML = '';
		this._allCards = [];

		// Show linked libraries with unlink option
		if (data.linkedLibraries.length > 0) {
			const libHeader = document.createElement('div');
			libHeader.className = 'symbol-libs-header';
			for (const lib of data.linkedLibraries) {
				const tag = document.createElement('span');
				tag.className = 'symbol-lib-tag';
				tag.innerHTML = `${lib.name} <button class="symbol-lib-unlink" title="Unlink">\u00D7</button>`;
				tag.querySelector('button').addEventListener('click', (e) => {
					e.stopPropagation();
					data.linkedLibraries = data.linkedLibraries.filter(l => l.docId !== lib.docId);
					this.open(); // refresh
				});
				libHeader.appendChild(tag);
			}
			this.gridEl.appendChild(libHeader);
		}

		if (this._symbols.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'doc-empty';
			empty.innerHTML = data.linkedLibraries.length === 0
				? 'No linked libraries.<br>Click "Link Library" to add one.'
				: 'No symbols found in linked libraries.<br>Add symbol frames to your library documents.';
			this.gridEl.appendChild(empty);
			return;
		}

		// Group by library
		const byLib = new Map();
		for (const sym of this._symbols) {
			if (!byLib.has(sym.docId)) byLib.set(sym.docId, []);
			byLib.get(sym.docId).push(sym);
		}

		for (const [docId, symbols] of byLib) {
			// Library name header
			if (byLib.size > 1) {
				const header = document.createElement('div');
				header.className = 'symbol-group-header';
				header.textContent = symbols[0].docName;
				this.gridEl.appendChild(header);
			}

			for (const sym of symbols) {
				const card = document.createElement('div');
				card.className = 'doc-card';
				card.dataset.name = (sym.name || '').toLowerCase();

				const thumbEl = document.createElement('div');
				thumbEl.className = 'doc-thumb';
				// No thumbnail for library symbols (they're in another doc)
				thumbEl.style.display = 'flex';
				thumbEl.style.alignItems = 'center';
				thumbEl.style.justifyContent = 'center';
				thumbEl.style.fontSize = '12px';
				thumbEl.style.color = '#666';
				thumbEl.textContent = `${Math.round(sym.width)}\u00D7${Math.round(sym.height)}`;

				const info = document.createElement('div');
				info.className = 'doc-info';

				const name = document.createElement('div');
				name.className = 'doc-card-name';
				name.textContent = sym.name;

				const meta = document.createElement('div');
				meta.className = 'doc-card-date';
				meta.textContent = sym.docName;

				info.append(name, meta);
				card.append(thumbEl, info);

				card.addEventListener('click', async () => {
					await this._placeSymbol(sym);
					this.close();
				});

				this.gridEl.appendChild(card);
				this._allCards.push(card);
			}
		}
	}

	async _placeSymbol(sym) {
		const center = stage.screenToWorld(stage.canvas.width / 2, stage.canvas.height / 2);

		// Ensure cache is loaded for this library
		if (!symbolLibrary.hasCached(sym.docId, sym.frameId)) {
			await symbolLibrary.refreshLibrary(sym.docId);
		}

		// Center the symbol at the viewport center (not top-left)
		const x = center.x - (sym.width || 0) / 2;
		const y = center.y - (sym.height || 0) / 2;

		const instance = new SymbolInstance([null, x, y]);
		instance.libraryDocId = sym.docId;
		instance.libraryFrameId = sym.frameId;

		const cmd = new PlaceLibrarySymbolCommand(instance);
		undoManager.execute(cmd);
		stage.render();
	}

	_filterCards() {
		const query = this.searchEl.value.toLowerCase().trim();
		for (const card of this._allCards) {
			card.style.display = (!query || card.dataset.name.includes(query)) ? '' : 'none';
		}
	}

	async _linkLibrary() {
		if (!fileManager.storage) return;

		const docs = await fileManager.storage.listDocuments();
		// Filter out current document and already-linked docs
		const linkedIds = new Set(data.linkedLibraries.map(l => l.docId));
		const available = docs.filter(d =>
			d.id !== fileManager.currentDocumentId && !linkedIds.has(d.id)
		);

		if (available.length === 0) {
			alert('No other documents available to link.');
			return;
		}

		// Simple picker: show list of available docs
		const names = available.map((d, i) => `${i + 1}. ${d.name}`).join('\n');
		const choice = prompt(`Link a library document:\n\n${names}\n\nEnter number:`);
		if (!choice) return;

		const index = parseInt(choice) - 1;
		if (index < 0 || index >= available.length) return;

		const doc = available[index];
		data.linkedLibraries.push({ docId: doc.id, name: doc.name });
		await symbolLibrary.refreshLibrary(doc.id);
		this.open(); // refresh
	}
}

export default SymbolBrowser;
