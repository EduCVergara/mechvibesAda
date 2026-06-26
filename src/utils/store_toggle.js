class StorageToggle {
  constructor(store, key, defaultVal) {
    this.store = store;
    this.key = key;
    this.default = defaultVal;
  }

  get is_enabled() {
    if(!this.store.has(this.key)) return this.default;
    return this.store.get(this.key);
  }

  enable() {
    this.store.set(this.key, true);
  }

  disable() {
    this.store.set(this.key, false);
  }

  toggle() {
    if (this.is_enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }
}

module.exports = StorageToggle;
