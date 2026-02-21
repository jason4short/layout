// Document browser dialog - card grid with thumbnails

import fileManager from './FileManager.js';
import stage from './Stage.js';
import inspector from './Inspector.js';

class DocumentBrowser {
	constructor() {
		this.overlay = document.getElementById('documentBrowser');
		this.gridEl = document.getElementById('documentGrid');

		// Close on backdrop click
		this.overlay.addEventListener('click', (e) => {
			if (e.target === this.overlay) this.close();
		});

		// Close button
		document.getElementById('documentCloseBtn').addEventListener('click', () => this.close());

		// New file button
		document.getElementById('documentNewBtn').addEventListener('click', async () => {
			if (fileManager.storage && fileManager.currentDocumentId) {
				await fileManager._autoSave();
			}
			await fileManager.newDocument();
			inspector.update();
			this.close();
		});

		// Escape key closes
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
				this.close();
			}
		});
	}

	async open() {
		if (!fileManager.storage) return;

		const docs = await fileManager.storage.listDocuments();
		this._renderGrid(docs);
		this.overlay.classList.remove('hidden');
	}

	close() {
		this.overlay.classList.add('hidden');
	}

	_renderGrid(docs) {
		this.gridEl.innerHTML = '';

		if (docs.length === 0) {
			this.gridEl.innerHTML = '<div class="doc-empty">No saved documents yet</div>';
			return;
		}

		for (const doc of docs) {
			const card = document.createElement('div');
			card.className = 'doc-card';
			if (doc.id === fileManager.currentDocumentId) {
				card.classList.add('doc-current');
			}

			// Thumbnail area
			const thumbEl = document.createElement('div');
			thumbEl.className = 'doc-thumb';
			if (doc.thumbnail) {
				const img = document.createElement('img');
				img.src = doc.thumbnail;
				img.alt = doc.name;
				thumbEl.appendChild(img);
			}

			// Delete button (top-right of thumbnail)
			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'doc-card-delete';
			deleteBtn.textContent = '\u00D7';
			deleteBtn.title = 'Delete';
			deleteBtn.addEventListener('click', async (e) => {
				e.stopPropagation();
				if (!confirm(`Delete "${doc.name}"?`)) return;
				await fileManager.storage.deleteDocument(doc.id);
				if (fileManager.tabBar) await fileManager.tabBar.removeTab(doc.id);
				if (doc.id === fileManager.currentDocumentId && (!fileManager.tabBar || fileManager.tabBar.tabs.length === 0)) {
					await fileManager.newDocument();
					inspector.update();
				}
				this.open();
			});
			thumbEl.appendChild(deleteBtn);

			// Info area
			const info = document.createElement('div');
			info.className = 'doc-info';

			const name = document.createElement('div');
			name.className = 'doc-card-name';
			name.textContent = doc.name;

			// Double-click to rename
			name.addEventListener('dblclick', async (e) => {
				e.stopPropagation();
				const newName = prompt('Rename document:', doc.name);
				if (newName && newName.trim()) {
					const fullDoc = await fileManager.storage.loadDocument(doc.id);
					if (fullDoc) {
						await fileManager.storage.saveDocument({
							id: doc.id,
							name: newName.trim(),
							data: fullDoc.data,
							thumbnail: fullDoc.thumbnail
						});
						if (doc.id === fileManager.currentDocumentId) {
							fileManager.currentDocumentName = newName.trim();
							fileManager._updateTitle();
						}
						this.open();
					}
				}
			});

			const date = document.createElement('div');
			date.className = 'doc-card-date';
			date.textContent = this._formatDate(doc.updatedAt);

			info.append(name, date);
			card.append(thumbEl, info);

			// Click card to open document (in new tab)
			card.addEventListener('click', async () => {
				if (fileManager.storage && fileManager.currentDocumentId) {
					await fileManager._autoSave();
				}
				await fileManager.loadFromStorage(doc.id);
				inspector.update();
				this.close();
			});

			this.gridEl.appendChild(card);
		}
	}

	_formatDate(timestamp) {
		const date = new Date(timestamp);
		const month = date.getMonth() + 1;
		const day = date.getDate();
		const year = date.getFullYear();
		const hours = date.getHours();
		const mins = date.getMinutes().toString().padStart(2, '0');
		const ampm = hours >= 12 ? 'PM' : 'AM';
		const h = hours % 12 || 12;
		return `${month}/${day}/${year} @ ${h}:${mins} ${ampm}`;
	}
}

export default DocumentBrowser;
