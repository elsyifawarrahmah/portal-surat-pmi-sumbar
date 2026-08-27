self.addEventListener('push', function (event) {
  let data = { title: 'Surat Baru Masuk', body: 'Ada surat baru yang perlu diperiksa.' }
  try { data = event.data.json() } catch (e) {}

  const options = {
    body: data.body,
    icon: '/logo-pmi.svg',
    badge: '/logo-pmi.svg',
    data: { url: data.url || '/surat-masuk' },
    vibrate: [200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || '/surat-masuk'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
