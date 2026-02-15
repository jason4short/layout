// Shared IndexedDB connection with schema migrations

class DatabaseManager {
	constructor(dbName = 'cadc-documents') {
		this.dbName = dbName;
		this.version = 2; // v2 adds symbols store
		this.db = null;
	}

	async open() {
		if (this.db) return this.db;

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.version);

			request.onupgradeneeded = (event) => {
				const db = event.target.result;

				// v1: documents store
				if (!db.objectStoreNames.contains('documents')) {
					const store = db.createObjectStore('documents', { keyPath: 'id' });
					store.createIndex('updatedAt', 'updatedAt');
					store.createIndex('name', 'name');
				}

				// v2: symbols store
				if (!db.objectStoreNames.contains('symbols')) {
					const store = db.createObjectStore('symbols', { keyPath: 'id' });
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
			await this.open();
			return true;
		} catch (e) {
			console.warn('IndexedDB not available:', e);
			return false;
		}
	}
}

const databaseManager = new DatabaseManager();
export default databaseManager;
