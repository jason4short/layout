



export class EventDispatcher {
    constructor() {
        this.listeners = {};
    }

    addEventListener(event, callback) {	    
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    removeEventListener(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(listener => listener !== callback);
    }

    dispatchEvent(event, ...args) {
        if (!this.listeners[event]) return;
        for (const listener of this.listeners[event]) {
            listener(...args);
        }
    }
}
