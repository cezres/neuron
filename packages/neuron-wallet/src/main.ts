import { app, BrowserWindow, Menu } from 'electron'
import * as path from 'path'
import listenToChannel from './IPCChannel'
import menuTemplate from './utils/menuTemplate'

let mainWindow: Electron.BrowserWindow | null

const { NODE_ENV } = process.env

const ENTRY = {
  DEV: 'http://localhost:3000',
  PROD: `file://${path.join(__dirname, '../../neuron-ui/build/index.html')}`,
}

listenToChannel()
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      devTools: NODE_ENV === 'development',
    },
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  mainWindow.loadURL(NODE_ENV === 'development' ? ENTRY.DEV : ENTRY.PROD)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    mainWindow!.focus()
  })
}

app.on('ready', createWindow)

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})