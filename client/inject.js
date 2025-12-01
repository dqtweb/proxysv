;(function () {
  if (window.__websocketInjector) {
    console.warn("inject.js already loaded");
    return;
  }
  window.__websocketInjector = true;

  const endpoint =
    window.WS_PROXY_ENDPOINT?.trim() || "ws://localhost:65432";
  let socket;
  const agentIdentity = `Agent-${Math.random().toString(36).slice(2, 8)}`;

  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.bottom = "16px";
  panel.style.right = "16px";
  panel.style.padding = "8px";
  panel.style.width = "280px";
  panel.style.border = "1px solid rgba(0,0,0,0.2)";
  panel.style.borderRadius = "8px";
  panel.style.background = "rgba(255,255,255,0.95)";
  panel.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  panel.style.zIndex = "999999";
  panel.style.fontFamily = "system-ui, sans-serif";
  panel.innerHTML = `
    <strong style="font-size:14px">WebSocket Injector</strong>
    <button id="inject-connect" style="margin-top:4px;">Connect</button>
    <button id="inject-send" style="margin-left:4px;" disabled>Send console</button>
    <p style="margin: 4px 0 0; font-size:12px;">Logs:</p>
    <pre id="inject-log" style="height:120px; overflow:auto; background:#121212; color:#f8f8f2; padding:4px; border-radius:4px; font-size:11px;"></pre>
  `;

  document.body.appendChild(panel);

  const logEl = panel.querySelector("#inject-log");
  const connectBtn = panel.querySelector("#inject-connect");
  const sendBtn = panel.querySelector("#inject-send");

  function appendLog(text) {
    logEl.textContent += text + "\n";
    logEl.scrollTop = logEl.scrollHeight;
  }

  function updateButtons(connected) {
    connectBtn.textContent = connected ? "Reconnect" : "Connect";
    sendBtn.disabled = !connected;
  }

  function collectElementDetails(selector = "body") {
    const details = {
      selector,
      found: false,
      tagName: null,
      textSnippet: null,
      rect: null,
      classes: [],
    };
    const element = document.querySelector(selector);
    if (!element) {
      return details;
    }
    details.found = true;
    details.tagName = element.tagName;
    details.textSnippet = element.textContent?.trim().slice(0, 160) || "";
    const rect = element.getBoundingClientRect();
    details.rect = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
    details.classes = Array.from(element.classList);
    return details;
  }

  function handleServerCommand(payload) {
    switch (payload.action) {
      case "console":
        console.log("Injected client:", payload.message || "");
        appendLog("Console: " + (payload.message || "(empty)"));
        break;
      case "alert":
        alert(payload.message || "Alert from WebSocket server");
        appendLog("Alert shown");
        break;
      case "inspect-request": {
        const selector = payload.selector || "body";
        const details = collectElementDetails(selector);
        sendCommand("inspect-response", {
          requestId: payload.requestId,
          details,
        });
        appendLog("Inspect response sent");
        break;
      }
      default:
        appendLog("Unknown action " + payload.action);
    }
  }

  function handleMessage(event) {
    appendLog("← " + event.data);
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      appendLog("Invalid JSON payload");
      return;
    }

    if (data.type === "client-command") {
      handleServerCommand(data.payload || {});
    }

    appendLog(`type=${data.type} cmd=${data.command || "n/a"}`);
  }

  function createSocket() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }

    socket = new WebSocket(endpoint);
    appendLog("Connecting to " + endpoint);

    socket.addEventListener("open", () => {
      appendLog("Socket opened");
      updateButtons(true);
      sendCommand("register", { identity: agentIdentity, role: "agent" });
    });

    socket.addEventListener("message", handleMessage);

    socket.addEventListener("close", () => {
      appendLog("Socket closed");
      updateButtons(false);
    });

    socket.addEventListener("error", () => {
      appendLog("Socket error");
    });
  }

  function sendCommand(command, data) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      appendLog("Socket not open");
      return;
    }
    const payload = { command };
    if (data !== undefined) payload.data = data;
    const text = JSON.stringify(payload);
    socket.send(text);
    appendLog("→ " + text);
  }

  connectBtn.addEventListener("click", createSocket);
  sendBtn.addEventListener("click", () =>
    sendCommand("client-command", {
      action: "console",
      message: "Injected command at " + new Date().toLocaleTimeString(),
    })
  );

  updateButtons(false);
})();
