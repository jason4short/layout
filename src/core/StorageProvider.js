// Abstract storage interface
// IndexedDB now, remote API later

class StorageProvider {
	// List all saved documents (metadata only)
	// Returns [{ id, name, updatedAt, createdAt }]
	async listDocuments() {
		throw new Error('Not implemented');
	}

	// Save a document (create or update)
	// doc: { id?, name, data }
	// Returns the document id
	async saveDocument(doc) {
		throw new Error('Not implemented');
	}

	// Load a document by id
	// Returns { id, name, data, updatedAt, createdAt } or null
	async loadDocument(id) {
		throw new Error('Not implemented');
	}

	// Delete a document by id
	async deleteDocument(id) {
		throw new Error('Not implemented');
	}

	// Check if storage is available
	async isAvailable() {
		return false;
	}
}

export default StorageProvider;
