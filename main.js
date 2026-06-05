const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const NodeID3 = require('node-id3');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // --- SETTINGS FOR A POLISHED NATIVE WINDOW ---

    // 1. Set a background color that matches your UI theme.
    // This prevents the jarring "white flash" when the window first opens.
    backgroundColor: '#0f1724',

    // 2. We keep the default frame (frame: true) to use native controls.
    //    The operating system will handle the corners for us.
    //    - On Windows 11 and macOS, the corners will be rounded automatically.
    //    - On Windows 10, they will be square, as is standard for that OS.

  });

  // Hide the top menu bar (File, Edit, etc.) for a cleaner look.
  // The user can still press 'Alt' to show it temporarily.
  mainWindow.autoHideMenuBar = true;
  
  mainWindow.loadFile('index.html');

  // The DevTools are now commented out for the final application.
  // You can uncomment this line if you need to debug something.
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  // The 'save-file' handler remains the same. It's working perfectly.
  ipcMain.handle('save-file', (event, args) => {
    return new Promise((resolve, reject) => {
      const { filePath, metadata, coverArtBase64 } = args;

      if (!filePath) {
        return reject({ success: false, error: 'File path was not provided.' });
      }

      const tags = {
        title: metadata.title,
        artist: metadata.artist,
      };

      if (coverArtBase64) {
        const imageBuffer = Buffer.from(coverArtBase64.split(',')[1], 'base64');
        tags.image = {
          mime: 'image/jpeg',
          type: { id: 3, name: 'front cover' },
          description: 'Cover Art',
          imageBuffer: imageBuffer
        };
      }
      
      NodeID3.update(tags, filePath, (err) => {
        if (err) {
          console.error("NodeID3.update FAILED:", err);
          return reject({ success: false, error: err.message });
        }
        console.log("NodeID3.update SUCCESSFULLY finished.");
        resolve({ success: true });
      });
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});