importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "gen-lang-client-0207804941",
  appId: "1:310900608830:web:80ba96b3910a618d5ca66f",
  apiKey: "AIzaSyB1xZZKjhGfohGUqZpiqMFOo6pOfwRoE3k",
  authDomain: "gen-lang-client-0207804941.web.app",
  messagingSenderId: "310900608830",
  storageBucket: "gen-lang-client-0207804941.firebasestorage.app"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/Circle_invite.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
