const path = require('path');
const { execFileSync } = require('child_process');

class startupHandler {
  constructor(app) {
    this.app = app;
  }

  get is_windows_dev() {
    return process.platform == 'win32' && !this.app.isPackaged;
  }

  get dev_run_key_path() {
    return 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  }

  get dev_run_key_name() {
    return `${path.basename(this.app.getAppPath())}.Dev`;
  }

  get dev_startup_command() {
    return `"${process.execPath}" "${this.app.getAppPath()}" --startup`;
  }

  get login_item_options() {
    if(this.is_windows_dev) {
      return {
        path: process.execPath,
        args: [this.app.getAppPath(), '--startup']
      };
    }

    return {
      args: ['--startup']
    };
  }

  get is_enabled() {
    if(this.is_windows_dev) {
      return this.has_dev_startup_entry();
    }

    return this.app.getLoginItemSettings(this.login_item_options).openAtLogin;
  }

  get was_started_at_login() {
    if(process.platform == 'darwin') {
      return this.app.getLoginItemSettings().wasOpenedAtLogin;
    }else{
      return process.argv.includes('--startup');
    }
  }

  enable() {
    if(this.is_windows_dev) {
      this.remove_legacy_electron_dev_entry();
      execFileSync('reg.exe', [
        'add',
        this.dev_run_key_path,
        '/v',
        this.dev_run_key_name,
        '/t',
        'REG_SZ',
        '/d',
        this.dev_startup_command,
        '/f'
      ], { windowsHide: true });
      return;
    }

    this.app.setLoginItemSettings({
      openAtLogin: true,
      ...this.login_item_options
    });
  }

  disable() {
    if(this.is_windows_dev) {
      this.remove_dev_startup_entry();
      this.remove_legacy_electron_dev_entry();
      return;
    }

    this.app.setLoginItemSettings({
      openAtLogin: false,
      ...this.login_item_options
    });
  }

  toggle() {
    if (this.is_enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  has_dev_startup_entry() {
    try {
      const output = execFileSync('reg.exe', [
        'query',
        this.dev_run_key_path,
        '/v',
        this.dev_run_key_name
      ], { encoding: 'utf8', windowsHide: true });

      return output.includes(this.app.getAppPath()) && output.includes('--startup');
    } catch {
      return false;
    }
  }

  remove_dev_startup_entry() {
    try {
      execFileSync('reg.exe', [
        'delete',
        this.dev_run_key_path,
        '/v',
        this.dev_run_key_name,
        '/f'
      ], { windowsHide: true });
    } catch {
      // The entry may not exist yet.
    }
  }

  remove_legacy_electron_dev_entry() {
    try {
      const output = execFileSync('reg.exe', [
        'query',
        this.dev_run_key_path,
        '/v',
        'electron.app.Electron'
      ], { encoding: 'utf8', windowsHide: true });

      if(!output.includes(this.app.getAppPath())){
        return;
      }

      execFileSync('reg.exe', [
        'delete',
        this.dev_run_key_path,
        '/v',
        'electron.app.Electron',
        '/f'
      ], { windowsHide: true });
    } catch {
      // The legacy entry may not exist.
    }
  }
}

module.exports = startupHandler;
