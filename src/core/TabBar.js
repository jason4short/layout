// Tab bar for switching between open documents
// Each tab stores a docId. Switching saves current doc to IndexedDB, loads the target.

import fileManager from './FileManager.js';
import inspector from './Inspector.js';
import stage from './Stage.js';

class TabBar {
	constructor(el) {
		this.el = el;
		this.tabs = [];      // [{docId, name, dirty}]
		this.activeIndex = -1;
		this._switching = false; // guard against re-entrant switches
	}

	// Open a document in a tab. If already open, switch to it.
	async openTab(docId, name) {
		// Check for existing tab
		const existing = this.tabs.findIndex(t => t.docId === docId);
		if (existing >= 0) {
			if (existing !== this.activeIndex) {
				await this.switchTab(existing);
			}
			return;
		}

		// Add new tab
		this.tabs.push({ docId, name, dirty: false });
		const newIndex = this.tabs.length - 1;

		// If this is being called during a load (not a tab switch), just set active
		if (!this._switching) {
			this.activeIndex = newIndex;
		}

		this._render();
	}

	// Switch to a different tab by index
	async switchTab(index) {
		if (index === this.activeIndex) return;
		if (index < 0 || index >= this.tabs.length) return;
		if (this._switching) return;

		this._switching = true;
		const previousIndex = this.activeIndex;
		try {
			// Auto-save current doc before switching
			if (this.activeIndex >= 0 && fileManager.storage && fileManager.currentDocumentId) {
				await fileManager._autoSave();
			}

			// Load target document
			const target = this.tabs[index];
			this.activeIndex = index;
			const loaded = await fileManager.loadFromStorage(target.docId);
			if (!loaded) {
				this.activeIndex = previousIndex;
				this._render();
				return;
			}
			inspector.update();
			this._render();
		} finally {
			this._switching = false;
		}
	}

	// Close a tab
	async closeTab(index) {
		if (index < 0 || index >= this.tabs.length) return;

		const tab = this.tabs[index];

		// If dirty, confirm before closing
		if (tab.dirty) {
			const confirmed = await this._confirmClose(tab.name);
			if (!confirmed) return;
		}

		// Remove the tab
		this.tabs.splice(index, 1);

		if (this.tabs.length === 0) {
			// Last tab closed — create new document
			this.activeIndex = -1;
			await fileManager.newDocument();
			inspector.update();
			stage.render();
			return;
		}

		// Adjust active index
		if (index === this.activeIndex) {
			// Closed the active tab — switch to neighbor
			const newIndex = Math.min(index, this.tabs.length - 1);
			this.activeIndex = -1; // force switch
			await this.switchTab(newIndex);
		} else if (index < this.activeIndex) {
			this.activeIndex--;
			this._render();
		} else {
			this._render();
		}
	}

	// Remove a tab by document ID (e.g. when a document is deleted)
	async removeTab(docId) {
		const index = this.tabs.findIndex(t => t.docId === docId);
		if (index < 0) return;

		const wasActive = index === this.activeIndex;
		this.tabs.splice(index, 1);

		if (this.tabs.length === 0) {
			this.activeIndex = -1;
			this._render();
			return;
		}

		if (index < this.activeIndex) {
			this.activeIndex--;
		} else if (wasActive) {
			this.activeIndex = Math.min(index, this.tabs.length - 1);
		}

		this._render();

		// If the active document tab was removed, load the newly active tab document.
		if (wasActive) {
			const nextIndex = this.activeIndex;
			this.activeIndex = -1; // force switchTab to run
			await this.switchTab(nextIndex);
		}
	}

	// Update the active tab's name and dirty state
	updateActive(name, dirty) {
		if (this.activeIndex < 0 || this.activeIndex >= this.tabs.length) return;
		const tab = this.tabs[this.activeIndex];
		tab.name = name;
		tab.dirty = dirty;
		this._render();
	}

	// Update tab by document id (more robust than activeIndex-based updates)
	updateForDocument(docId, name, dirty) {
		const idx = this.tabs.findIndex(t => t.docId === docId);
		if (idx >= 0) {
			this.tabs[idx].name = name;
			this.tabs[idx].dirty = dirty;
			this._render();
			return;
		}

		// Do not relabel by activeIndex when docId isn't present yet.
		// The tab will be updated once it's created/opened.
		if (docId == null) {
			this.updateActive(name, dirty);
		}
	}

	// Save open tabs to localStorage
	_saveState() {
		const state = {
			tabs: this.tabs.map(t => ({ docId: t.docId, name: t.name })),
			activeIndex: this.activeIndex
		};
		localStorage.setItem('cadc-tabs', JSON.stringify(state));
	}

	// Load saved tab state from localStorage
	static loadState() {
		try {
			const json = localStorage.getItem('cadc-tabs');
			if (!json) return null;
			return JSON.parse(json);
		} catch {
			return null;
		}
	}

	// Render the tab bar DOM
	_render() {
		this._saveState();
		this.el.innerHTML = '';

		for (let i = 0; i < this.tabs.length; i++) {
			const tab = this.tabs[i];
			const el = document.createElement('div');
			el.className = 'tab' + (i === this.activeIndex ? ' active' : '');

			const label = document.createElement('span');
			label.className = 'tab-label';
			label.textContent = tab.name || 'Untitled';

			const close = document.createElement('span');
			close.className = 'tab-close';
			close.textContent = '\u00D7';
			close.addEventListener('click', (e) => {
				e.stopPropagation();
				this.closeTab(i);
			});

			label.addEventListener('dblclick', (e) => {
				e.stopPropagation();
				this._startRename(i, label);
			});

			el.append(label, close);
			el.addEventListener('click', () => this.switchTab(i));
			this.el.appendChild(el);
		}

		// New document button
		const newBtn = document.createElement('button');
		newBtn.className = 'tab-new';
		newBtn.textContent = '+';
		newBtn.title = 'New Design';
		newBtn.addEventListener('click', async () => {
			if (fileManager.storage && fileManager.currentDocumentId) {
				await fileManager._autoSave();
			}
			await fileManager.newDocument();
			inspector.update();
		});
		this.el.appendChild(newBtn);
	}

	// Inline rename on double-click
	_startRename(index, labelEl) {
		const tab = this.tabs[index];
		const input = document.createElement('input');
		input.type = 'text';
		input.value = tab.name || 'Untitled';
		input.className = 'tab-rename';
		labelEl.replaceWith(input);
		input.focus();
		input.select();

		const commit = async () => {
			const newName = input.value.trim() || 'Untitled';
			tab.name = newName;
			// If renaming the active tab, update FileManager too
			if (index === this.activeIndex) {
				await fileManager.renameDocument(newName);
			}
			this._render();
		};

		input.addEventListener('blur', commit);
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') input.blur();
			if (e.key === 'Escape') {
				input.value = tab.name || 'Untitled';
				input.blur();
			}
		});
	}

	// Simple confirm dialog for closing dirty tab
	_confirmClose(name) {
		return new Promise(resolve => {
			resolve(confirm(`"${name}" has unsaved changes. Close without saving?`));
		});
	}
}

const tabBar = new TabBar(document.getElementById('tabBar'));
export { TabBar };
export default tabBar;
