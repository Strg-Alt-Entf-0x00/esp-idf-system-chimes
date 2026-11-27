function logTerminal(text, type = "info") {
  const timestamp = `[${new Date().toLocaleTimeString()}]`;
  const box = document.getElementById("termBox");
  if (!box) return;
  const entry = document.createElement("div");
  entry.className = `log-line ${type}`;
  entry.textContent = `${timestamp} ${text}`;
  box.appendChild(entry);
  box.scrollTop = box.scrollHeight;
}

function clearTerminalLog() {
  document.getElementById("termBox").replaceChildren();
}

function getTerminalLogText() {
  const box = document.getElementById("termBox");
  return box ? Array.from(box.children, (entry) => entry.textContent).join("\n") : "";
}

async function copyTerminalLog() {
  const text = getTerminalLogText();
  if (!text) {
    logTerminal("The console log is empty.", "info");
    return;
  }
  try {
    await copyTextToClipboard(text);
    logTerminal("Console log copied to clipboard.", "info");
  } catch (error) {
    logTerminal(`Could not copy console log: ${error.message}`, "err");
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  let copied;
  try {
    textarea.select();
    copied = document.execCommand("copy");
  } finally {
    textarea.remove();
  }
  if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
}

function downloadTerminalLog() {
  const text = getTerminalLogText();
  if (!text) {
    logTerminal("The console log is empty.", "info");
    return;
  }
  let objectUrl;
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `system-chimes-serial-${timestamp}.log`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    logTerminal(`Could not download console log: ${error.message}`, "err");
  } finally {
    if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

function toggleTerminal(force) {
  const drawer = document.getElementById("terminalDrawer");
  if (!drawer) return;
  const isOpen = force !== undefined ? force : !drawer.classList.contains("open");
  drawer.classList.toggle("open", isOpen);
  drawer.setAttribute("aria-hidden", String(!isOpen));
  drawer.inert = !isOpen;
  const toggleButton = document.getElementById("btnToggleTerm");
  toggleButton.classList.toggle("active", isOpen);
  toggleButton.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) document.getElementById("cmdInput").focus();
}

document.getElementById("btnToggleTerm").addEventListener("click", () => toggleTerminal());
document.getElementById("btnClearLog").addEventListener("click", clearTerminalLog);
document.getElementById("btnCopyLog").addEventListener("click", copyTerminalLog);
document.getElementById("btnDownloadLog").addEventListener("click", downloadTerminalLog);
document.getElementById("btnCloseTerm").addEventListener("click", () => toggleTerminal(false));

const helpDialog = document.getElementById("help-dialog");
document.getElementById("btnHelp").addEventListener("click", () => helpDialog.showModal());
document.getElementById("close-help-dialog").addEventListener("click", () => helpDialog.close());

    let isFirmwareVerified = false;
    let handshakeTimeout = null;
