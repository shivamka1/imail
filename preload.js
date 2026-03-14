'use strict'

const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  interceptNotifications()
})

function interceptNotifications() {
  // Intercept window.Notification so we can trigger an immediate badge poll
  // when iCloud Mail fires a new-mail notification.
  if (!('Notification' in window)) return
  const Orig = window.Notification
  window.Notification = function(title, options) {
    ipcRenderer.send('new-mail-notification')
    return new Orig(title, options)
  }
  window.Notification.permission = Orig.permission
  window.Notification.requestPermission = Orig.requestPermission.bind(Orig)
}
