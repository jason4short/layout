// IndexedDB storage for documents (uses shared DatabaseManager)

import StorageProvider from './StorageProvider.js';
import databaseManager from './DatabaseManager.js';

class IndexedDBProvider extends StorageProvider {
	async _open() {
		return databaseManager.open();
	}

	async isAvailable() {
		return databaseManager.isAvailable();
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
						thumbnail: doc.thumbnail || null,
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
			thumbnail: doc.thumbnail || null,
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
