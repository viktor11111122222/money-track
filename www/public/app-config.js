/**
 * app-config.js - Backend URL configuration
 *
 * Za lokalno testiranje na telefonu (isti WiFi):
 *   Promijeni BACKEND_LOCAL_IP na IP tvog računara (npr. 192.168.1.100)
 *   Pokreni: ipconfig (Windows) ili ifconfig (Mac) da vidiš IP
 *
 * Za produkciju (App Store / Play Store):
 *   Promijeni BACKEND_PROD_URL na URL tvog hostovanog servera
 */

const BACKEND_LOCAL_IP = '172.20.10.3'; // Mac IP na lokalnoj mreži
const BACKEND_LOCAL_PORT = '8080';
const BACKEND_PROD_URL = ''; // npr. 'https://money-track-api.railway.app'

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL_AUTH_MODE = true  → Login/Register rade lokalno (bez servera)
//                           Korisnici se čuvaju u localStorage
// LOCAL_AUTH_MODE = false → Koristi pravi backend (App Store / Play Store build)
//                           Automatski se isključuje kada postaviš BACKEND_PROD_URL
// ─────────────────────────────────────────────────────────────────────────────
const LOCAL_AUTH_MODE = false; // server mode — koristi backend na BACKEND_LOCAL_IP

(function () {
  const isCapacitor = typeof window !== 'undefined' && window.Capacitor !== undefined;
  const isLiveServer = typeof window !== 'undefined' &&
    (window.location.port === '5500' || window.location.port === '5501');

  let base;

  if (isCapacitor) {
    if (BACKEND_PROD_URL) {
      base = BACKEND_PROD_URL + '/api';
    } else {
      base = `http://${BACKEND_LOCAL_IP}:${BACKEND_LOCAL_PORT}/api`;
    }
  } else if (isLiveServer) {
    base = `http://localhost:${BACKEND_LOCAL_PORT}/api`;
  } else {
    base = '/api';
  }

  window.__API_BASE__ = base;
  window.__LOCAL_AUTH__ = LOCAL_AUTH_MODE;
})();
