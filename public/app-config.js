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

const BACKEND_LOCAL_IP = '10.0.2.2'; // Specijalni IP za Android emulator → pristupa MacBook localhost-u
const BACKEND_LOCAL_PORT = '8080';
const BACKEND_PROD_URL = ''; // npr. 'https://money-track-api.railway.app'

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
})();
