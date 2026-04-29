export const environment = {
  production: false,
  apiBaseUrl: 'https://lissenly-backend.onrender.com',
  rtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:your-turn-host:3478',
        username: 'your-turn-username',
        credential: 'your-turn-password'
      }
    ]
  }
};
