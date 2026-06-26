'use strict';

const fs = require('fs-extra');

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {};

    try {
      if (fs.existsSync(filePath)) {
        const stored = fs.readJsonSync(filePath);
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
          this.data = stored;
        }
      }
    } catch {
      this.data = {};
    }
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    fs.writeJsonSync(this.filePath, this.data, { spaces: 2 });
  }
}

module.exports = JsonStore;
