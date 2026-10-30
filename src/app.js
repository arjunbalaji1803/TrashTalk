import { BIN_LABELS, classifyWaste } from "./classifier.js";

const connectButton = document.querySelector("#connect-button");
const micTestButton = document.querySelector("#mic-test-button");
const manualForm = document.querySelector("#manual-form");
const manualItem = document.querySelector("#manual-item");
const connectionPill = document.querySelector("#connection-pill");
const connectionLabel = document.querySelector("#connection-label");
const statusMessage = document.querySelector("#status-message");
const spokenItem = document.querySelector("#spoken-item");
const resultDetail = document.querySelector("#result-detail");
const binBadge = document.querySelector("#bin-badge");

let port = null;
let serialReader = null;
let serialReadTask = null;
let sensorReady = false;
let voicePurpose = "preview";
let recognition = null;
let currentLineBuffer = "";

function setStatus(message, kind = "default") {
  statusMessage.textContent = message;
  statusMessage.dataset.kind = kind;
}

function setConnection(connected) {
  connectionPill.classList.toggle("is-connected", connected);
  connectionLabel.textContent = connected ? "Arduino connected" : "Arduino disconnected";
  connectButton.textContent = connected ? "Disconnect Arduino" : "Connect Arduino ↗";
}

function showResult(item, result, note = "") {
  spokenItem.textContent = item || "Nothing sorted yet";
  resultDetail.textContent = [result.reason, note].filter(Boolean).join(" ");
  binBadge.hidden = false;
  binBadge.dataset.bin = result.category;
  binBadge.textContent = result.label;
}

function getSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return null;
  const instance = new Recognition();
  instance.lang = "en-US";
  instance.interimResults = false;
  instance.maxAlternatives = 1;
  return instance;
}

function listenForItem(purpose) {
  const nextRecognition = getSpeechRecognition();
  if (!nextRecognition) {
    setStatus("Speech recognition is unavailable in this browser. Use the text box below to classify an item.", "warning");
    return;
  }

  recognition = nextRecognition;
  voicePurpose = purpose;
  recognition.onstart = () => setStatus("Listening… say one item, like “banana peel” or “plastic bottle”.", "listening");
  recognition.onresult = async (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
    await processItem(transcript, purpose);
  };
  recognition.onerror = (event) => {
    sensorReady = false;
    const details = event.error === "not-allowed" ? "Allow microphone access in your browser and try again." : `Speech input failed (${event.error}).`;
    setStatus(`${details} You can also type an item below.`, "warning");
  };
  recognition.onend = () => {
    if (purpose === "sensor" && sensorReady) {
      sensorReady = false;
      setStatus("I didn’t catch that. Move your hand away and try again, or type the item below.", "warning");
    }
  };

  try {
    recognition.start();
  } catch (error) {
    sensorReady = false;
    setStatus(`Could not start speech recognition: ${error.message}`, "warning");
  }
}

async function processItem(item, purpose = "preview") {
  const cleanItem = String(item ?? "").trim();
  const result = classifyWaste(cleanItem);
  const previewNote = purpose === "preview" ? "Preview only; no servo command was sent." : "";
  showResult(cleanItem, result, previewNote);

  if (purpose !== "sensor") {
    setStatus("Preview complete. This did not open a bin.");
    return;
  }

  if (!sensorReady || !port) {
    setStatus("The sensor is no longer waiting. Move your hand away and try again.", "warning");
    return;
  }

  if (!["COMPOST", "RECYCLE", "GENERAL"].includes(result.category)) {
    const sent = await writeSerial("UNKNOWN");
    sensorReady = false;
    setStatus(sent ? result.reason : "Could not tell the Arduino to keep the lids closed.", "warning");
    return;
  }

  const sent = await writeSerial(`OPEN:${result.category}`);
  sensorReady = false;
  if (sent) setStatus(`Opening the ${BIN_LABELS[result.category].toLowerCase()} lid.`, "success");
}

async function writeSerial(command) {
  if (!port?.writable) {
    setStatus("Arduino serial connection is unavailable.", "warning");
    return false;
  }
  let writer;
  try {
    writer = port.writable.getWriter();
    await writer.write(new TextEncoder().encode(`${command}\n`));
    return true;
  } catch (error) {
    setStatus(`Could not send a command to the Arduino: ${error.message}`, "warning");
    return false;
  } finally {
    writer?.releaseLock();
  }
}

function handleSerialLine(line) {
  const message = line.trim().toUpperCase();
  if (!message) return;

  if (message === "READY") {
    sensorReady = true;
    setStatus("Hand detected. Say one item.", "listening");
    listenForItem("sensor");
  } else if (message.startsWith("OPENED:")) {
    const bin = message.slice("OPENED:".length);
    setStatus(`${BIN_LABELS[bin] ?? bin} lid opened and closed.`, "success");
  } else if (message === "UNKNOWN") {
    sensorReady = false;
    setStatus("Item not recognized. No lid opened. Try saying one item more clearly.", "warning");
  } else if (message === "TIMEOUT") {
    sensorReady = false;
    setStatus("The Arduino timed out. Move your hand away and try again.", "warning");
  } else if (message === "REARMED") {
    setStatus("Ready for the next item.");
  }
}

async function readSerial() {
  if (!port?.readable) return;
  const decoder = new TextDecoder();
  serialReader = port.readable.getReader();
  try {
    while (true) {
      const { value, done } = await serialReader.read();
      if (done) break;
      currentLineBuffer += decoder.decode(value, { stream: true });
      const lines = currentLineBuffer.split(/\r?\n/);
      currentLineBuffer = lines.pop() ?? "";
      for (const line of lines) handleSerialLine(line);
    }
  } catch (error) {
    if (port) setStatus(`Serial connection stopped: ${error.message}`, "warning");
  } finally {
    serialReader?.releaseLock();
    serialReader = null;
  }
}

async function connectSerial() {
  if (!("serial" in navigator)) {
    setStatus("Web Serial is unavailable. Use Chrome or Edge on localhost, then reconnect.", "warning");
    return;
  }
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    setConnection(true);
    setStatus("Arduino connected. Test the microphone, then put a hand near the sensor.", "success");
    serialReadTask = readSerial();
  } catch (error) {
    port = null;
    setConnection(false);
    if (error.name !== "NotFoundError") setStatus(`Could not connect to the Arduino: ${error.message}`, "warning");
  }
}

async function disconnectSerial() {
  sensorReady = false;
  if (recognition) {
    recognition.abort();
    recognition = null;
  }
  try {
    if (serialReader) await serialReader.cancel();
    if (serialReadTask) await serialReadTask;
    if (port) await port.close();
  } catch (error) {
    setStatus(`Could not close the serial connection cleanly: ${error.message}`, "warning");
  }
  port = null;
  setConnection(false);
  setStatus("Arduino disconnected.");
}

connectButton.addEventListener("click", () => {
  if (port) void disconnectSerial();
  else void connectSerial();
});

micTestButton.addEventListener("click", () => listenForItem("preview"));

manualForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void processItem(manualItem.value, "preview");
});

if (!("serial" in navigator)) {
  setStatus("Connect an Arduino with Chrome or Edge on localhost. You can still try the text classifier below.");
}
