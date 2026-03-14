const { app, BaseWindow, WebContentsView, Menu, shell, nativeTheme, ipcMain } = require('electron')
const path = require('path')

const ICLOUD_MAIL_URL = 'https://www.icloud.com/mail'

// Height of the empty strip above the web content where traffic lights live
const TOP_OFFSET = 44

let mainWindow
let mailView
let stripView

// Minimal draggable HTML for the strip — enables window drag + double-click zoom
const STRIP_HTML = 'data:text/html,<style>html,body{margin:0;height:100%;-webkit-app-region:drag;overflow:hidden;}</style>'


function createWindow() {
  mainWindow = new BaseWindow({
    width: 1280,
    height: 860,
    minWidth: 860,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: '#ffffff',
  })

  // ── Strip view (traffic lights row) ──────────────────────────────
  // A thin WebContentsView loaded with a fully-draggable page.
  // -webkit-app-region:drag in that page activates double-click zoom.
  stripView = new WebContentsView()
  stripView.setBackgroundColor('#ffffff')
  mainWindow.contentView.addChildView(stripView)
  stripView.webContents.loadURL(STRIP_HTML)

  // ── Mail view ────────────────────────────────────────────────────
  mailView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:imail',
    },
  })
  mainWindow.contentView.addChildView(mailView)

  // Keep both views sized correctly on resize
  function updateBounds() {
    const { width, height } = mainWindow.getContentBounds()
    stripView.setBounds({ x: 0, y: 0, width, height: TOP_OFFSET })
    mailView.setBounds({ x: 0, y: TOP_OFFSET, width, height: height - TOP_OFFSET })
  }
  mainWindow.on('resize', updateBounds)
  updateBounds()

  mailView.webContents.loadURL(ICLOUD_MAIL_URL)

  // Start badge polling after the page has fully loaded and the SPA has rendered
  mailView.webContents.on('did-finish-load', () => {
    setTimeout(pollBadge, 5000)       // first poll 5 s after load
    setInterval(pollBadge, 3000)      // then every 3 s
  })

  // Open external links in the default browser
  mailView.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('https://www.icloud.com') &&
        !url.startsWith('https://appleid.apple.com')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    mailView = null
    stripView = null
  })
}

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mailView && mailView.webContents.reload(),
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Developer Tools',
          accelerator: 'Alt+CmdOrCtrl+I',
          click: () => mailView && mailView.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Scan the live page for unread count and update the Dock badge
function pollBadge() {
  if (!mailView) return
  mailView.webContents.executeJavaScript(`
    (() => {
      try {
        function inboxUnreadCount(doc) {
          for (const el of doc.querySelectorAll('[aria-label="Inbox"]')) {
            const m = (el.textContent || '').match(/(\\d+)/)
            if (m && parseInt(m[1]) > 0) return true
          }
          return false
        }

        for (const f of document.querySelectorAll('iframe')) {
          try {
            const fdoc = f.contentDocument
            if (fdoc && inboxUnreadCount(fdoc)) return { hasUnread: true }
          } catch(e) {}
        }
        return { hasUnread: inboxUnreadCount(document) }
      } catch (e) { return { hasUnread: false, source: 'error:' + e.message } }
    })()
  `).then(result => {
    if (app.dock) app.dock.setBadge(result.hasUnread ? '\u2022' : '')
  }).catch(() => {})
}

// New-mail web notification fired → poll immediately so badge appears without waiting
ipcMain.on('new-mail-notification', () => setTimeout(pollBadge, 2000))

app.whenReady().then(() => {
  nativeTheme.themeSource = 'light'
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (!mainWindow) createWindow()
    else mainWindow.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
