import {EventDispatcher} from './EventDispatcher.js';

/**
 * Global event bus for decoupling modules.
 *
 * Usage:
 *   import events from './core/Events.js';
 *
 *   // Subscribe
 *   events.on('cursor-update', (info) => { ... });
 *
 *   // Publish
 *   events.emit('cursor-update', { position: 5, visible: true });
 *
 *   // Unsubscribe
 *   events.off('cursor-update', handler);
 */
class Events extends EventDispatcher {
	constructor() {
		super();
	}

	// Alias methods for cleaner API
	on(event, callback) {
		this.addEventListener(event, callback);
	}

	off(event, callback) {
		this.removeEventListener(event, callback);
	}

	emit(event, ...args) {
		this.dispatchEvent(event, ...args);
	}
}

// Singleton instance
const events = new Events();
export default events;
