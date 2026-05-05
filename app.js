const UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_TX      = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

let device       = null;
let uartTX       = null;
let pollInterval = null;
let lastRaw      = '';
let overlayTimer = null;

const MOVEMENT_MAP = {
  'corsa':             { icon: '🏃', label: 'Corsa',           cls: 'corsa'    },
  'fermo':             { icon: '⏸️', label: 'Fermo',           cls: 'fermo'    },
  'sinistra e destra': { icon: '↔️', label: 'Sinistra/Destra', cls: 'laterale' },
};

const dot             = document.getElementById('dot');
const statusText      = document.getElementById('statusText');
const movementCard    = document.getElementById('movementCard');
const movementIcon    = document.getElementById('movementIcon');
const movementDisplay = document.getElementById('movementDisplay');
const rawData         = document.getElementById('rawData');
const connectBtn      = document.getElementById('connectBtn');
const disconnectBtn   = document.getElementById('disconnectBtn');
const overlay         = document.getElementById('overlay');
const overlayIcon     = document.getElementById('overlayIcon');
const overlayText     = document.getElementById('overlayText');

// ─── CONNESSIONE ─────────────────────────────────────────────────────────────

async function connectMicrobit() {
  try {
    connectBtn.disabled = true;
    setStatus('Ricerca dispositivo…', 'connecting');

    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [UART_SERVICE]
    });

    device.addEventListener('gattserverdisconnected', onDisconnected);

    setStatus('Connessione in corso…', 'connecting');
    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService(UART_SERVICE);
    uartTX        = await service.getCharacteristic(UART_TX);

    try {
      await uartTX.startNotifications();
      uartTX.addEventListener('characteristicvaluechanged', handleData);
      setStatus('Connesso (notifiche) ✔', 'connected');
    } catch (e) {
      setStatus('Connesso (polling) ✔', 'connected');
      pollInterval = setInterval(pollData, 500);
    }

    disconnectBtn.disabled = false;

  } catch (err) {
    console.error(err);
    setStatus('Errore: ' + err.message, 'disconnected');
    connectBtn.disabled = false;
  }
}

// ─── POLLING ─────────────────────────────────────────────────────────────────

async function pollData() {
  if (!uartTX) return;
  try {
    const value = await uartTX.readValue();
    const raw   = new TextDecoder().decode(value).trim().toLowerCase();
    if (raw && raw !== lastRaw) {
      lastRaw = raw;
      processRaw(raw);
    }
  } catch (e) {}
}

// ─── RICEZIONE DATI ───────────────────────────────────────────────────────────

function handleData(event) {
  const raw = new TextDecoder().decode(event.target.value).trim().toLowerCase();
  processRaw(raw);
}

function processRaw(raw) {
  rawData.textContent = raw;
  const match = Object.keys(MOVEMENT_MAP).find(key => raw.includes(key));
  if (match) updateMovement(MOVEMENT_MAP[match]);
}

// ─── DISCONNESSIONE ───────────────────────────────────────────────────────────

function disconnectMicrobit() {
  if (device && device.gatt.connected) device.gatt.disconnect();
}

function onDisconnected() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  uartTX = null;
  lastRaw = '';
  setStatus('Disconnesso', 'disconnected');
  connectBtn.disabled    = false;
  disconnectBtn.disabled = true;
  resetMovement();
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function updateMovement({ icon, label, cls }) {
  // Aggiorna card
  movementDisplay.className   = cls;
  movementDisplay.textContent = label;
  movementCard.classList.add('active');
  movementIcon.classList.remove('animate');
  void movementIcon.offsetWidth;
  movementIcon.textContent = icon;
  movementIcon.classList.add('animate');

  // Mostra overlay a schermo intero
  showOverlay(icon, label, cls);
}

function showOverlay(icon, label, cls) {
  // Reset animazione
  overlayIcon.textContent  = icon;
  overlayText.textContent  = label;
  overlayText.className    = cls;

  // Forza reanimate
  overlayIcon.style.animation = 'none';
  overlayText.style.animation = 'none';
  void overlay.offsetWidth;
  overlayIcon.style.animation = '';
  overlayText.style.animation = '';

  overlay.classList.add('show');

  // Nascondi dopo 2 secondi
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => {
    overlay.classList.remove('show');
  }, 2000);
}

function resetMovement() {
  movementDisplay.className   = 'fermo';
  movementDisplay.textContent = '—';
  movementIcon.textContent    = '⏸️';
  movementCard.classList.remove('active');
  rawData.textContent = '—';
  overlay.classList.remove('show');
}

function setStatus(text, state) {
  statusText.textContent = text;
  statusText.className   = state === 'connected'    ? 'connected'
                         : state === 'disconnected' ? 'disconnected'
                         : '';
  dot.className = 'dot';
  if (state === 'connected')    dot.classList.add('connected');
  if (state === 'disconnected') dot.classList.add('disconnected');
}
