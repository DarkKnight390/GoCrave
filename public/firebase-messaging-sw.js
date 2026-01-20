/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCKJvvi8xjTRNO7QRopryZ73-XKjEMJj_c",
  authDomain: "gocrave-app.firebaseapp.com",
  projectId: "gocrave-app",
  storageBucket: "gocrave-app.firebasestorage.app",
  messagingSenderId: "140339778121",
  appId: "1:140339778121:web:3cb64c584e3b1987abe598",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "GoCrave";
  const options = {
    body: payload?.notification?.body || payload?.data?.body || "You have an update.",
    icon: payload?.notification?.icon || "/vite.svg",
    data: {
      url: payload?.data?.url || "/",
    },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});
