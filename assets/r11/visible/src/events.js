'use strict';
// Minimal synchronous event bus.

class EventBus {
  constructor() {
    this.handlers = new Map();
    this.history = [];
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(fn);
    return () => this.off(event, fn);
  }

  once(event, fn) {
    const wrapper = (...args) => {
      this.off(event, fn);
      return fn(...args);
    };
    return this.on(event, wrapper);
  }

  off(event, fn) {
    const list = this.handlers.get(event);
    if (!list) return;
    const idx = list.findIndex((h) => h === fn || h.original === fn);
    if (idx >= 0) list.splice(idx, 1);
  }

  emit(event, payload) {
    this.history.push({ event, payload });
    const list = (this.handlers.get(event) || []).slice();
    for (const h of list) h(payload);
    return list.length;
  }

  listenerCount(event) {
    return (this.handlers.get(event) || []).length;
  }
}

module.exports = { EventBus };
