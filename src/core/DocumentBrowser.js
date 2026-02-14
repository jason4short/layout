// Document list dialog for managing saved documents

import fileManager from './FileManager.js';
import stage from './Stage.js';
import inspector from './Inspector.js';

class DocumentBrowser {
	constructor() {
		this.overlay = document.getElementById('documentBrowser');
		this.listEl = document.getElementById('documentList');

		// Close on backdrop click
		this.overlay.addEventListener('click', (e) => {
			if (e.target === this.overlay) this.close();
		});

		// Close button
		document.getElementById('documentCloseBtn').addEventListener('click', () => this.close());

		// New document button
		document.getElementById('documentNewBtn').addEventListener('click', async () => {
			await fileManager.newDocument();
			inspector.update();
			this.close();
		});
	}

	async open() {
		if (!fileManager.storage) return;

		const docs = await fileManager.storage.listDocuments();
		this._renderList(docs);
		this.overlay.classList.remove('hidden');
	}

	close() {
		this.overlay.classList.add('hidden');
	}

	_renderList(docs) {
		this.listEl.innerHTML = '';

		if (docs.length === 0) {
			this.listEl.innerHTML = '<div class="doc-empty">No saved documents</div>';
			return;
		}

		for (const doc of docs) {
			const row = document.createElement('div');
			row.className = 'doc-row';
			if (doc.id === fileManager.currentDocumentId) {
				row.classList.add('doc-current');
			}

			// Document name (clickable to open)
			const name = document.createElement('span');
			name.className = 'doc-name';
			name.textContent = doc.name;
			name.addEventListener('click', async () => {
				await fileManager.loadFromStorage(doc.id);
				inspector.update();
				this.close();
			});

			// Last modified date
			const date = document.createElement('span');
			date.className = 'doc-date';
			date.textContent = this._formatDate(doc.updatedAt);

			// Rename button
			const renameBtn = document.createElement('button');
			renameBtn.className = 'doc-action';
			renameBtn.textContent = '\u270E'; // pencil
			renameBtn.title = 'Rename';
			renameBtn.addEventListener('click', async (e) => {
				e.stopPropagation();
				const newName = prompt('Rename document:', doc.name);
				if (newName && newName.trim()) {
					// Load doc data to re-save with new name
					const fullDoc = await fileManager.storage.loadDocument(doc.id);
					if (fullDoc) {
						await fileManager.storage.saveDocument({
							id: doc.id,
							name: newName.trim(),
							data: fullDoc.data
						});
						// Update current name if this is the open document
						if (doc.id === fileManager.currentDocumentId) {
							fileManager.currentDocumentName = newName.trim();
							fileManager._updateTitle();
						}
						this.open(); // refresh list
					}
				}
			});

			// Delete button
			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'doc-delete';
			deleteBtn.textContent = '\u00D7'; // ×
			deleteBtn.title = 'Delete';
			deleteBtn.addEventListener('click', async (e) => {
				e.stopPropagation();
				if (!confirm(`Delete "${doc.name}"?`)) return;

				await fileManager.storage.deleteDocument(doc.id);

				// If we deleted the current document, create a new one
				if (doc.id === fileManager.currentDocumentId) {
					await fileManager.newDocument();
					inspector.update();
				}
				this.open(); // refresh list
			});

			row.append(name, date, renameBtn, deleteBtn);
			this.listEl.appendChild(row);
		}
	}

	_formatDate(timestamp) {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / 60000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;

		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;

		return date.toLocaleDateString();
	}
}

export default DocumentBrowser;
