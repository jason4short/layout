// IndexedDB storage for documents

import StorageProvider from './StorageProvider.js';

class IndexedDBProvider extends StorageProvider {
	constructor(dbName = 'cadc-documents', version = 1) {
		super();
		this.dbName = dbName;
		this.version = version;
		this.db = null;
	}

	// Lazy open/create the database
	async _open() {
		if (this.db) return this.db;

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.version);

			request.onupgradeneeded = (event) => {
				const db = event.target.result;
				if (!db.objectStoreNames.contains('documents')) {
					const store = db.createObjectStore('documents', { keyPath: 'id' });
					store.createIndex('updatedAt', 'updatedAt');
					store.createIndex('name', 'name');
				}
			};

			request.onsuccess = (event) => {
				this.db = event.target.result;
				resolve(this.db);
			};

			request.onerror = (event) => {
				reject(event.target.error);
			};
		});
	}

	async isAvailable() {
		try {
			await this._open();
			return true;
		} catch (e) {
			console.warn('IndexedDB not available:', e);
			return false;
		}
	}

	async listDocuments() {
		const db = await this._open();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('documents', 'readonly');
			const store = tx.objectStore('documents');
			const index = store.index('updatedAt');
			const request = index.openCursor(null, 'prev'); // newest first
			const results = [];

			request.onsuccess = (event) => {
				const cursor = event.target.result;
				if (cursor) {
					const doc = cursor.value;
					results.push({
						id: doc.id,
						name: doc.name,
						updatedAt: doc.updatedAt,
						createdAt: doc.createdAt
					});
					cursor.continue();
				} else {
					resolve(results);
				}
			};
			request.onerror = (event) => reject(event.target.error);
		});
	}

	async saveDocument(doc) {
		const db = await this._open();
		const now = Date.now();

		// If updating, preserve original createdAt
		let createdAt = now;
		if (doc.id) {
			const existing = await this.loadDocument(doc.id);
			if (existing) {
				createdAt = existing.createdAt;
			}
		}

		const record = {
			id: doc.id || crypto.randomUUID(),
			name: doc.name || 'Untitled',
			data: doc.data,
			updatedAt: now,
			createdAt: createdAt
		};

		return new Promise((resolve, reject) => {
			const tx = db.transaction('documents', 'readwrite');
			const store = tx.objectStore('documents');
			store.put(record);
			tx.oncomplete = () => resolve(record.id);
			tx.onerror = (event) => reject(event.target.error);
		});
	}

	async loadDocument(id) {
		const db = await this._open();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('documents', 'readonly');
			const store = tx.objectStore('documents');
			const request = store.get(id);
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = (event) => reject(event.target.error);
		});
	}

	async deleteDocument(id) {
		const db = await this._open();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('documents', 'readwrite');
			const store = tx.objectStore('documents');
			store.delete(id);
			tx.oncomplete = () => resolve();
			tx.onerror = (event) => reject(event.target.error);
		});
	}
}

export default IndexedDBProvider;
