// Modules to control application life and create native browser window
const { app, BrowserWindow, Tray, Menu, shell, ipcMain, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { execFile } = require('child_process');
const { fileURLToPath } = require('url');
const log = require("electron-log/main");
log.initialize();
const { uIOhook } = require('uiohook-napi');

const StartupHandler = require('./utils/startup_handler');
const StoreToggle = require('./utils/store_toggle');
const { validateFolderName } = require('./utils/safe-path');
const JsonStore = require('./utils/json-store');

const easyVolume = require('easy-volume');
const windowsVolumeExecutable = path.join(
  path.dirname(require.resolve('easy-volume')),
  'platforms',
  'windows',
  'volume.exe'
).replace('app.asar', 'app.asar.unpacked');

function runWindowsVolumeCommand(command){
  return new Promise((resolve, reject) => {
    execFile(windowsVolumeExecutable, [command], {
      windowsHide: true,
      timeout: 3000
    }, (error, stdout, stderr) => {
      if(error || stderr){
        reject(error || new Error(stderr));
        return;
      }
      resolve(`${stdout}`.trim());
    });
  });
}

const getVolume = process.platform === 'win32'
  ? async () => {
      const value = Number(await runWindowsVolumeCommand('get'));
      if(!Number.isFinite(value) || value < 0){
        throw new Error('Unable to read system volume');
      }
      return value;
    }
  : easyVolume.getVolume;

const getMute = process.platform === 'win32'
  ? async () => (await runWindowsVolumeCommand('mute_status')) !== '0'
  : easyVolume.getMute;

const SYSTRAY_ICON = path.join(__dirname, '/assets/system-tray-icon.png');
const user_dir = app.getPath("userData");
const custom_dir = path.join(user_dir, '/custom');
const current_pack_store_id = 'mechvibes-pack';
const renderer_setting_keys = [
  current_pack_store_id,
  'mechvibes-volume',
  'mechvibes-hidden',
  'mechvibes-language'
];
const store = new JsonStore(path.join(user_dir, 'config.json'));

const mute = new StoreToggle(store, "mechvibes-muted", false);
const start_minimized = new StoreToggle(store, "mechvibes-start-minimized", false);
const active_volume = new StoreToggle(store, "mechvibes-active-volume", true);
const adaptive_volume = new StoreToggle(store, "mechvibes-adaptive-volume", false);
const storage_prompted = new StoreToggle(store, "mechvibes-migrate-asked", false);
const headphone_name_patterns = [
  "headphone",
  "headphones",
  "headset",
  "earbud",
  "earbuds",
  "earphone",
  "earphones",
  "auricular",
  "auriculares",
  "audifono",
  "audifonos",
  "cascos",
  "cloud",
  "airpods",
  "buds"
];
const speaker_name_patterns = [
  "speaker",
  "speakers",
  "altavoz",
  "altavoces"
];

// Default log file paths
// On Windows: %appdata%\Mechvibes\logs\mechvibes.log
// On macOS: ~/Library/Logs/Mechvibes/mechvibes.log
// On Linux: ~/.config/Mechvibes/logs/mechvibes.log
//           $XDG_CONFIG_HOME/Mechvibes/logs/mechvibes.log
log.transports.file.fileName = "mechvibes.log";
log.transports.file.level = "info";
log.transports.file.resolvePathFn = (variables) => {
  return path.join(variables.libraryDefaultDir, variables.fileName);
}
log.variables.sender = "main";
// console.log(log.transports.console.format); // uncomment to see default formats in console
// console.log(log.transports.file.format); // uncomment to see default formats in console
log.transports.console.format = "{h}:{i}:{s}.{ms} {sender} › {text}"
log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]({sender}) {text}"

// const custom_dir = path.join(user_dir, "/custom");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var win = null;
var tray = null;
var startup_handler = null;
var audio_output_state = {
  headphonesConnected: false,
  outputNames: []
};
// create custom sound folder if not exists
fs.ensureDirSync(custom_dir);

function isTrustedLocalSender(event, allowedPages = []){
  try{
    const senderPath = fileURLToPath(event.senderFrame.url);
    return path.dirname(senderPath) === __dirname && (
      allowedPages.length === 0 || allowedPages.includes(path.basename(senderPath))
    );
  }catch{
    return false;
  }
}

ipcMain.on("get-app-context", (event) => {
  if(!isTrustedLocalSender(event, ["app.html", "install.html", "editor.html"])){
    event.returnValue = null;
    return;
  }
  event.returnValue = {
    appVersion: app.getVersion(),
    customDir: custom_dir,
    currentPackStoreId: current_pack_store_id,
    settings: Object.fromEntries(renderer_setting_keys
      .filter((key) => store.has(key))
      .map((key) => [key, store.get(key)]))
  };
});

ipcMain.on("set-renderer-setting", (event, key, value) => {
  if(
    !isTrustedLocalSender(event, ["app.html"]) ||
    !renderer_setting_keys.includes(key) ||
    !["string", "number", "boolean"].includes(typeof value)
  ){
    return;
  }
  store.set(key, value);
});

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
});

function setStoreToggle(toggle, enabled){
  if(enabled){
    toggle.enable();
  }else{
    toggle.disable();
  }
}

function normalizeAudioDeviceName(name){
  return `${name || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getOutputSearchText(output){
  return normalizeAudioDeviceName([
    output.name,
    output.description,
    output.interface,
    output.enumerator,
    output.container,
    output.devicePath
  ].filter((value) => !!value).join(" "));
}

function isVirtualHyperxOutput(output){
  const text = getOutputSearchText(output);
  return text.includes("ngenuity") || text.includes("hyperx virtual audio device");
}

function isPhysicalUsbOutput(output){
  const text = getOutputSearchText(output);
  return !isVirtualHyperxOutput(output) && text.includes("usb");
}

function isSpeakerNamedOutput(output){
  const name = normalizeAudioDeviceName(output.name);
  return speaker_name_patterns.some((pattern) => name.includes(pattern));
}

function isHeadphoneOutput(output, allOutputs){
  const text = getOutputSearchText(output);
  const hasDirectHeadphoneName = headphone_name_patterns.some((pattern) => text.includes(pattern));
  if(hasDirectHeadphoneName && !isVirtualHyperxOutput(output)){
    return true;
  }

  const hasHyperxVirtualOutput = allOutputs.some(isVirtualHyperxOutput);
  return hasHyperxVirtualOutput && isPhysicalUsbOutput(output) && isSpeakerNamedOutput(output);
}

function getWindowsActiveAudioOutputs(){
  return new Promise((resolve) => {
    if(process.platform !== "win32"){
      resolve([]);
      return;
    }

    const script = `
$base = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render'
$items = @(Get-ChildItem -Path $base -ErrorAction SilentlyContinue | ForEach-Object {
  $state = (Get-ItemProperty -Path $_.PSPath -Name DeviceState -ErrorAction SilentlyContinue).DeviceState
  if ($state -eq 1) {
    $props = Get-ItemProperty -Path ($_.PSPath + '\\Properties') -ErrorAction SilentlyContinue
    $name = $props.'{a45c254e-df1c-4efd-8020-67d146a850e0},2'
    if ($name) {
      [PSCustomObject]@{
        id = $_.PSChildName
        name = $name
        description = $props.'{a45c254e-df1c-4efd-8020-67d146a850e0},14'
        interface = $props.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
        enumerator = $props.'{a45c254e-df1c-4efd-8020-67d146a850e0},24'
        container = $props.'{b3f8fa53-0004-438e-9003-51a46e139bfc},26'
        devicePath = $props.'{233164c8-1b2c-4c7d-bc68-b671687a2567},1'
      }
    }
  }
})
$json = $items | ConvertTo-Json -Compress
if ($null -eq $json) { '[]' } else { $json }
`;

    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true,
      timeout: 5000
    }, (err, stdout) => {
      if(err){
        log.warn(`Audio output check failed: ${err.message}`);
        resolve([]);
        return;
      }

      const output = `${stdout || ""}`.trim();
      if(output === ""){
        resolve([]);
        return;
      }

      try{
        const json = JSON.parse(output);
        resolve(Array.isArray(json) ? json : [json]);
      }catch(parseErr){
        log.warn(`Audio output check returned invalid JSON: ${parseErr.message}`);
        resolve([]);
      }
    });
  });
}

function sendRuntimeOptions(){
  if(win === null || win.isDestroyed()){
    return;
  }

  if(startup_handler !== null){
    win.webContents.send("start-on-boot-status", startup_handler.is_enabled);
  }
  win.webContents.send("adaptive-volume-toggle", adaptive_volume.is_enabled);
  win.webContents.send("audio-output-update", audio_output_state);
}

async function updateAudioOutputState(){
  const outputs = await getWindowsActiveAudioOutputs();
  const outputNames = outputs.map((output) => output.name).filter((name) => !!name);
  const nextState = {
    headphonesConnected: outputs.some((output) => isHeadphoneOutput(output, outputs)),
    outputNames
  };

  if(JSON.stringify(audio_output_state) !== JSON.stringify(nextState)){
    audio_output_state = nextState;
    if(win !== null && !win.isDestroyed()){
      win.webContents.send("audio-output-update", audio_output_state);
    }
  }
}

function createWindow(show = false) {
  // Create the browser window.
  win = new BrowserWindow({
    name: "app", // used by logger to differentiate messages sent by different windows.
    width: 480,
    height: 720,
    // resizable: false,
    // fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'app.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
    show: false,
  });

  // remove menu bar
  win.removeMenu();

  // and load the index.html of the app.
  win.loadFile('./src/app.html');

  // Open the DevTools.
  // win.openDevTools();
  // win.webContents.openDevTools();

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("ava-toggle", active_volume.is_enabled);
    win.webContents.send("mechvibes-mute-status", mute.is_enabled);
    sendRuntimeOptions();
  })

  // Emitted when the window is closed.
  win.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  win.on('close', function (event) {
    if (!app.isQuiting) {
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
      event.preventDefault();
      win.hide();
    }
    return false;
  });

  win.on("unresponsive", () => {
    log.warn("Window has entered unresponsive state");
    console.log("unresponsive");
  })

  // condition for start_minimized
  if (show) {
    win.show();
  } else {
    win.close();
  }

  return win;
}

let installer = null;
function openInstallWindow(packId){
  // Create the browser window.
  installer = new BrowserWindow({
    width: 300,
    height: 200,
    useContentSize: false,
    // resizable: false,
    // fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'install.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    parent: win,
  });

  // remove menu bar
  installer.removeMenu();

  // and load the index.html of the app.
  installer.loadFile('./src/install.html');

  installer.webContents.on("did-finish-load", () => {
    installer.webContents.send("install-pack", packId);
  })

  installer.on("ready-to-show", () => {
    installer.show();
  })

  // Emitted when the window is closed.
  installer.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    installer = null;
  });
}

const gotTheLock = app.requestSingleInstanceLock();
const protocolCommands = {
  install(packId){
    if(installer === null){
      log.debug(`Processing request to install ${packId}...`);
      openInstallWindow(packId);
    }else{
      installer.focus();
      installer.webContents.send("install-pack", packId);
    }
  }
}
function callProtocolCommand(command, ...args){
  protocolCommands[command](...args);
}

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
      if (process.platform === 'darwin') {
        app.dock.show();
      }else{
        // when we reach this code, we're hitting open-url on win or linux
        // Note, this doesn't occur on macos, we have to use open-url below.
        const url = commandLine.pop();
        const command = decodeURI(url.slice("mechvibes://".length)).split(" ");
        if(protocolCommands[command[0]]){
          callProtocolCommand(...command);
        }
      }
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    }
  });

  app.on("open-url", (event, url) => {
    const command = decodeURI(url.slice("mechvibes://".length)).split(" ");
    if(protocolCommands[command[0]]){
      callProtocolCommand(...command);
    }
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Don't show the window and create a tray instead
  // create and get window instance
  app.on('ready', () => {
    log.silly("Ready event has fired.");
    app.setAsDefaultProtocolClient('mechvibes');
    startup_handler = new StartupHandler(app);

    log.silly("Creating main window for the first time...");
    if(startup_handler.was_started_at_login && start_minimized.is_enabled){
      win = createWindow(false);
    }else{
      win = createWindow(true);
    }

    if(!mute.is_enabled){
      uIOhook.start();
    }

    let volume = -1; // set to an out-of-bound value to force an update on first run
    let system_mute = false;
    let system_volume_error = false;

    const wakeRuntime = () => {
      if(win !== null && !win.isDestroyed()){
        win.webContents.send("resume-runtime");
      }
      updateAudioOutputState();
    };

    powerMonitor.on("unlock-screen", wakeRuntime);
    powerMonitor.on("resume", wakeRuntime);

    updateAudioOutputState();
    let audio_output_check_interval = setInterval(updateAudioOutputState, 3000);
    let sys_check_interval = setInterval(() => {
      if(!mute.is_enabled){
        getVolume().then((v) => {
          if(v !== volume){
            volume = v;
            win.webContents.send("system-volume-update", volume);
          }
        }).catch((err) => {
          clearInterval(sys_check_interval);
          if(err == "" && !system_volume_error){
            // this condition appears to only be hit when using ctrl+c to kill the app during development or on windows
            system_volume_error = true;
          }
          log.error(`Volume Error: ${err}`);
        });

        getMute().then((m) => {
          if(m !== system_mute){
            system_mute = m;
            win.webContents.send("system-mute-status", system_mute);
          }
        }).catch((err) => {
          clearInterval(sys_check_interval);
          if(err == "" && !system_volume_error){
            // this condition appears to only be hit when using ctrl+c to kill the app during development.
            system_volume_error = true;
            OnBeforeQuit();
            app.exit(1);
          }
          log.error(`Mute Error: ${err}`);
        });
      }
    }, 3000);
    // NOTE: we could go lower than 3 seconds, but the problem is, the system volume check is slow,
    // so it's not a good idea to spam the system with requests.

    uIOhook.on('keydown', (event) => {
      win.webContents.send("keydown", event);
    });

    uIOhook.on('keyup', (event) => {
      win.webContents.send("keyup", event);
    });

    function createTrayIcon(){
      // prevent dupe tray icons
      if(tray !== null) return;

      // start tray icon
      tray = new Tray(SYSTRAY_ICON);

      // tray icon tooltip
      tray.setToolTip('Mechvibes Ada');

      // context menu when hover on tray icon
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Mechvibes Ada',
          click: function () {
            // show app on click
            if (process.platform === 'darwin') {
              app.dock.show();
            }
            win.show();
            win.focus();
          },
        },
        {
          label: 'Editor',
          click: function () {
            openEditorWindow();
          },
        },
        {
          label: 'Folders',
          submenu: [
            {
              label: 'Custom Soundpacks',
              click: function () {
                shell.openPath(custom_dir).then((err) => {
                  if(err){
                    log.error(err);
                  }
                });
              },
            },
            {
              label: 'Application Data',
              click: function () {
                shell.openPath(user_dir).then((err) => {
                  if(err){
                    log.error(err);
                  }
                });
              },
            },
          ],
        },
        {
          label: 'Mute',
          type: 'checkbox',
          checked: mute.is_enabled,
          click: function () {
            mute.toggle();
            if(!mute.is_enabled){
              uIOhook.start();
            }else{
              uIOhook.stop();
            }
            win.webContents.send("mechvibes-mute-status", mute.is_enabled);
          },
        },
        {
          label: 'Extras',
          submenu: [
            {
              label: 'Enable at Startup',
              type: 'checkbox',
              checked: startup_handler.is_enabled,
              click: function () {
                startup_handler.toggle();
                sendRuntimeOptions();
              },
            },
            {
              label: 'Start Minimized',
              type: 'checkbox',
              checked: start_minimized.is_enabled,
              click: function () {
                start_minimized.toggle();
              },
            },
            {
              label: 'Adaptive Volume',
              type: 'checkbox',
              checked: adaptive_volume.is_enabled,
              click: function () {
                adaptive_volume.toggle();
                sendRuntimeOptions();
              },
            },
            {
              label: 'Active Volume Adjustment',
              type: 'checkbox',
              checked: active_volume.is_enabled,
              click: function () {
                active_volume.toggle();
                win.webContents.send("ava-toggle", active_volume.is_enabled);
              },
            },
          ],
        },
        {
          label: 'Quit',
          click: function () {
            // stop system check interval, because it's an external program, and
            // it doesn't know how to handle shutdowns.
            clearInterval(sys_check_interval);
            clearInterval(audio_output_check_interval);
            // quit
            app.isQuiting = true;
            app.quit();
          },
        },
      ]);

      // On macOS double click doesn't work if we use tray.setContextMenu(), so we'll do it manually.
      if(process.platform == "darwin"){
        // click on tray icon, show context menu
        tray.on('click', () => {
          tray.popUpContextMenu(contextMenu);
        });

        // right click on tray icon, show the app
        tray.on("right-click", () => {
          app.dock.show();
          win.show();
          win.focus();
        })
      }else{
        tray.setContextMenu(contextMenu);
        // double click on tray icon, show the app
        tray.on("double-click", () => {
          win.show();
          win.focus();
        })
      }
    }

    ipcMain.on("show_tray_icon", (event, show) => {
      if(show && tray === null){
        createTrayIcon();
      }else if(!show && tray !== null){
        tray.destroy()
        tray = null;
      }
    })

    ipcMain.on("electron-log", (event, message, level) => {
      const allowedLevels = new Set(["error", "warn", "info", "debug", "verbose", "silly"]);
      if(!isTrustedLocalSender(event) || !allowedLevels.has(level)){
        return;
      }
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      log.variables.sender = senderWindow === win ? "app" : "window";
      log[level](`${message}`.slice(0, 5000));
      log.variables.sender = "main"; // reset sender
    })

    ipcMain.on("request_runtime_options", () => {
      sendRuntimeOptions();
    })

    ipcMain.on("set_adaptive_volume", (event, enabled) => {
      if(!isTrustedLocalSender(event, ["app.html"])){
        return;
      }
      setStoreToggle(adaptive_volume, enabled === true);
      sendRuntimeOptions();
    })

    ipcMain.on("set_start_on_boot", (event, enabled) => {
      if(!isTrustedLocalSender(event, ["app.html"])){
        return;
      }
      if(startup_handler !== null){
        if(enabled === true){
          startup_handler.enable();
        }else{
          startup_handler.disable();
        }
      }
      sendRuntimeOptions();
    })

    // allow the installer to set its size using the height of the body so that when content changes,
    // the installer can only be as big or as small as it needs to be.
    ipcMain.on("resize-installer", (event, size) => {
      if(
        !isTrustedLocalSender(event, ["install.html"]) ||
        installer === null ||
        !Number.isFinite(size)
      ){
        return;
      }
      size = Math.max(100, Math.min(Math.round(size), 700));
      const diff = installer.getSize()[1] - installer.getContentSize()[1];
      log.silly(`Installer requested ${size}, offset is ${diff}, so size is ${(size + diff)}`);
      installer.setSize(300, size + diff, true);
    })
    ipcMain.on("installed", (event, packFolder) => {
      if(!isTrustedLocalSender(event, ["install.html"])){
        return;
      }
      try{
        validateFolderName(packFolder);
      }catch(error){
        log.warn(`Rejected invalid sound pack folder: ${error.message}`);
        return;
      }
      log.silly(`Installed ${packFolder}`);
      store.set(current_pack_store_id, "custom-" + packFolder);
      win.reload();
      installer.close();
      installer = null;
    })

    log.debug(`Platform: ${process.platform}`);
    log.info("App is ready and has been initialized");

    // prevent Electron app from interrupting macOS system shutdown
    if (process.platform == 'darwin') {
      powerMonitor.on('shutdown', () => {
        app.quit();
      });
    }

    if(!storage_prompted.is_enabled){
      // check if old custom directory exists
      const home_dir = app.getPath('home');
      const old_custom_dir = path.join(home_dir, "/mechvibes_custom");
      if(fs.existsSync(old_custom_dir)){
        log.debug("Old custom directory exists, prompting user for migration...");
        const { dialog } = require('electron');
        const response = dialog.showMessageBoxSync({
          type: 'question',
          buttons: ['Yes', 'Not right now', "Don't ask again"],
          title: 'Mechvibes Ada',
          message: "Soundpacks have moved to a new location, do you want to migrate your old soundpacks to the new location? We'll only ask you this once.",
          defaultId: 0,
          cancelId: 1,
        });
  
        if (response === 0) {
          log.debug("User requested migration, migrating...");
          const oldCustomFiles = fs.readdirSync(old_custom_dir);
          oldCustomFiles.forEach((file) => {
            const sourcePath = path.join(old_custom_dir, file);
            const destinationPath = path.join(custom_dir, file);
            log.silly(`Moving ${sourcePath.replace(home_dir, "~")} to ${destinationPath.replace(home_dir, "~")}`);
            fs.moveSync(sourcePath, destinationPath, { overwrite: true });
          });
          log.silly("Removing old custom directory...");
          fs.removeSync(old_custom_dir);
          log.debug("Migration complete.");
          storage_prompted.enable();
          win.reload();
        }else if(response === 2){
          storage_prompted.enable();
        }
      }else{
        storage_prompted.enable();
      }
    }
  });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  log.silly("All windows were closed.");
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  log.silly("App has been activated")
  if (win === null){
    createWindow(true);
  }else{
    // on macOS clicking the app icon in the launcher or in finder, triggers activate instead of second-instance for some reason.
    if (process.platform === 'darwin') {
      app.dock.show();
    }
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  }
});

// ensure app gets unregistered
function OnBeforeQuit(){
  log.silly("Shutting down...");
  try{
    uIOhook.stop();
  }catch(error){
    log.warn(`Failed to stop keyboard hook cleanly: ${error.message}`);
  }
  app.removeAsDefaultProtocolClient("mechvibes");
}
app.on("before-quit", OnBeforeQuit);

// always be sure that your application handles the 'quit' event in your main process
app.on('quit', () => {
  log.silly("Goodbye.");
});

var editor_window = null;

function openEditorWindow() {
  if (editor_window) {
    editor_window.focus();
    return;
  }

  editor_window = new BrowserWindow({
    width: 1200,
    height: 600,
    // resizable: false,
    // minimizable: false,
    // fullscreenable: false,
    // modal: true,
    // parent: win,
    webPreferences: {
      preload: path.join(__dirname, 'editor.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // editor_window.openDevTools();

  editor_window.loadFile('./src/editor.html');

  editor_window.on('closed', function () {
    editor_window = null;
  });
}
