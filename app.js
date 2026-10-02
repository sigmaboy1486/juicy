const $ = (id) => document.getElementById(id);

const wifiName = $("wifiName");
const wifiPassword = $("wifiPassword");
const backendUrl = $("backendUrl");
const arduinoIp = $("arduinoIp");
const apiKey = $("apiKey");
const connectBtn = $("connectBtn");
const statusText = $("statusText");
const statusDot = $("statusDot");

let connected = false;
let activeCommand = null;

function setStatus(message, state = "offline") {
  statusText.textContent = message;
  statusDot.className = `status-dot ${state}`;
}

function normalizeBackendUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function saveSettings() {
  localStorage.setItem("robocar_wifi_name", wifiName.value);
  localStorage.setItem("robocar_wifi_password", wifiPassword.value);
  localStorage.setItem("robocar_backend_url", backendUrl.value);
  localStorage.setItem("robocar_arduino_ip", arduinoIp.value);
  localStorage.setItem("robocar_api_key", apiKey.value);
}

function loadSettings() {
  wifiName.value = localStorage.getItem("robocar_wifi_name") || "Bluebirds";
  wifiPassword.value = localStorage.getItem("robocar_wifi_password") || "";
  backendUrl.value = localStorage.getItem("robocar_backend_url") || "";
  arduinoIp.value = localStorage.getItem("robocar_arduino_ip") || "";
  apiKey.value = localStorage.getItem("robocar_api_key") || "robocar123";
}

async function apiFetch(path, options = {}) {
  const base = normalizeBackendUrl(backendUrl.value);
  if (!base) throw new Error("Enter the backend URL first.");

  const headers = {
    ...(options.headers || {}),
    "X-RoboCar-Key": apiKey.value.trim(),
  };

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

async function connectBackend() {
  saveSettings();

  const ip = arduinoIp.value.trim();
  if (!ip) {
    setStatus("Enter the Arduino IP address.", "pending");
    return;
  }

  setStatus("Connecting...", "pending");
  connectBtn.disabled = true;

  try {
    await apiFetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arduinoIp: ip }),
    });

    connected = true;
    setStatus(`Connected • ${ip}`, "online");
  } catch (error) {
    connected = false;
    setStatus(error.message, "offline");
  } finally {
    connectBtn.disabled = false;
  }
}

async function sendCommand(command) {
  if (!connected && command !== "stop") {
    setStatus("Connect first.", "pending");
    return;
  }

  try {
    await apiFetch(`/api/command/${command}`, { method: "POST" });
    setStatus(`Command: ${command.toUpperCase()}`, "online");
  } catch (error) {
    connected = false;
    setStatus(error.message, "offline");
  }
}

function pressButton(button, command) {
  if (command === "stop") {
    stopCar();
    return;
  }

  if (!connected) {
    setStatus("Connect first.", "pending");
    return;
  }

  if (activeCommand && activeCommand !== command) {
    const old = document.querySelector(`[data-command="${activeCommand}"]`);
    old?.classList.remove("pressed");
  }

  activeCommand = command;
  button.classList.add("pressed");
  sendCommand(command);
}

function releaseButton(command) {
  if (activeCommand !== command) return;

  activeCommand = null;
  const button = document.querySelector(`[data-command="${command}"]`);
  button?.classList.remove("pressed");
  sendCommand("stop");
}

function stopCar() {
  if (activeCommand) {
    const button = document.querySelector(`[data-command="${activeCommand}"]`);
    button?.classList.remove("pressed");
  }
  activeCommand = null;
  sendCommand("stop");
}

document.querySelectorAll(".drive-btn[data-command]").forEach((button) => {
  const command = button.dataset.command;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    pressButton(button, command);
  });

  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    if (command !== "stop") releaseButton(command);
  });

  button.addEventListener("pointercancel", () => {
    if (command !== "stop") releaseButton(command);
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && activeCommand) stopCar();
});

window.addEventListener("pagehide", () => {
  if (activeCommand) stopCar();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;

  const map = {
    w: "forward",
    a: "left",
    s: "backward",
    d: "right",
    ArrowUp: "forward",
    ArrowLeft: "left",
    ArrowDown: "backward",
    ArrowRight: "right",
  };

  const command = map[event.key];
  if (!command) return;

  event.preventDefault();
  const button = document.querySelector(`[data-command="${command}"]`);
  if (button) pressButton(button, command);
});

window.addEventListener("keyup", (event) => {
  const map = {
    w: "forward",
    a: "left",
    s: "backward",
    d: "right",
    ArrowUp: "forward",
    ArrowLeft: "left",
    ArrowDown: "backward",
    ArrowRight: "right",
  };

  const command = map[event.key];
  if (!command) return;

  event.preventDefault();
  releaseButton(command);
});

connectBtn.addEventListener("click", connectBackend);

loadSettings();
