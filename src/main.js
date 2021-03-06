if (process.env.NODE_ENV !== 'development') {
  process.env.NODE_ENV = 'production';
}

import path from 'path';
import BrowserWindow from 'browser-window';
import saveFile from 'electron-save-file';
import notifier from 'node-notifier';
import * as config from './config';

import {
  app,
  globalShortcut,
  Tray,
  ipcMain,
  Menu
} from 'electron';

import {
  OPEN_FILE,
  COPY_TO_CLIPBOARD,
  DELETE_FILE,
  UPLOAD,
  NEW_FILE
} from './../shared/constants';

import * as registerShortcuts from './shortcuts';
import { log, copyToClipboard, uploadFile, openFile, deleteFile, getFiles } from './utils';

export const emit = (event, body) => mainWindow.webContents.send(event, body);
export const notify = (text, err) => {
  log(text, err || '');

  if (config.getHasNotifications()) {
    notifier.notify({
      title: 'record-desktop',
      message: text + (err ? ' ' + err.message : '')
    });
  }
};

let mainWindow;

const indexProd = 'file://' + path.resolve(__dirname, '..', 'public', 'index.html');
const indexDev = 'file://' + path.resolve(__dirname, '..', 'public', 'index-dev.html');
const indexHtml = process.env.NODE_ENV === 'production' ? indexProd : indexDev;
const indexIdle = 'file://' + path.resolve(__dirname, '..', 'public', 'index-idle.html');

const getMainWindow = () => {
  const hasShortcuts = registerShortcuts.hasShortcuts();
  const initUrl = indexHtml + '#' + (hasShortcuts ? '' : 'settings');

  if (mainWindow) {
    return mainWindow;
  } else if (process.env.NODE_ENV === 'production') {
    const ret = new BrowserWindow({ width: 800, height: 900, show: !hasShortcuts });
    ret.loadURL(initUrl);

    return ret;
  } else {
    const ret = new BrowserWindow({ width: 1200, height: 400 });
    ret.loadURL(initUrl);
    ret.openDevTools();

    return ret;
  }
};
let appIcon;

const defaultIcon = path.resolve(__dirname + '/../icon.png');
const recordingIcon = path.resolve(__dirname + '/../icon-recording.png');

export const setIcon = isRecording => appIcon.setImage(isRecording ? recordingIcon : defaultIcon);

process.title = 'record-desktop';
process.on('unhandledRejection', err => {
  log(err.stack);
  notify(err.stack);
});

app.on('ready', () => {
  mainWindow = getMainWindow();

  const offloadContent = () => {
    mainWindow.loadURL(indexIdle);
  };

  mainWindow.on('minimize', () => {
    const mainWindow = getMainWindow();

    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();

    offloadContent();
    log('minimize');
  });

  mainWindow.on('restore', () => {
    const mainWindow = getMainWindow();

    mainWindow.setSkipTaskbar(false);
    log('restore');
  });

  mainWindow.on('closed', () => mainWindow = appIcon = null);

  appIcon = new Tray(defaultIcon);
  appIcon.on('click', () => {
    const mainWindow = getMainWindow();

    log('click appIcon ' + mainWindow.isVisible());

    if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.loadURL(indexHtml + '#');
    } else {
      mainWindow.hide();
      offloadContent();
    }
  });

  const updateTrayMenu = () => getFiles(config.getFolder())
    .then(files => {
      appIcon.setContextMenu(Menu.buildFromTemplate([
        {
          label: 'Latest',
          submenu: files.slice(0, 5)
            .map(file => ({
              label: file.filename,
              submenu: [
                {
                  label: 'Upload to imgur',
                  click: () => uploadFile(file.url)
                },
                {
                  label: 'Delete',
                  click: () => deleteFile(file.url)
                },
                {
                  label: 'Save as',
                  click: () => saveFile(file.url)
                }
              ]
            }))
        },
        {
          label: 'Browse Images',
          click: () => {
            mainWindow.show();
            mainWindow.loadURL(indexHtml + '#');
          }
        },
        {
          label: 'Open a folder',
          click: () => openFile(config.getFolder())
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click: () => {
            mainWindow.show();
            mainWindow.loadURL(indexHtml + '#settings')
          }
        },
        {
          label: 'Exit',
          click: () => app.quit()
        }
      ]));
    })
    .catch(err => console.log(err.stack));

  updateTrayMenu();

  config.eventEmitter.on(NEW_FILE, () => {
    updateTrayMenu();
    emit(NEW_FILE);
  });

  ipcMain.on(OPEN_FILE, (event, data) => {
    openFile(data);
  });

  ipcMain.on(COPY_TO_CLIPBOARD, (event, data) => {
    copyToClipboard(data);
  });

  ipcMain.on(DELETE_FILE, (event, data) => {
    deleteFile(data);
    updateTrayMenu();
  });

  ipcMain.on(UPLOAD, (event, data) => {
    uploadFile(data);
  });

  registerShortcuts.registerAll();
});

app.on('will-quit', function() {
  mainWindow = appIcon = null;
  globalShortcut.unregisterAll();
});
