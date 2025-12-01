#!/usr/bin/env node

const WebSocket = require("ws");
const { randomBytes } = require("crypto");

const pendingInspections = new Map();
const clientRegistry = new Map();
let nextClientId = 1;

function getClientSummary(client) {
  const metadata = clientRegistry.get(client.id) || {};
  return {
    clientId: client.id,
    address: client.address || "unknown",
    identity: metadata.identity || `client-${client.id}`,
    role: metadata.role || "unknown",
  };
}

function listClients(server, roleFilter) {
  const summaries = [];
  for (const client of server.clients) {
    const summary = getClientSummary(client);
    if (roleFilter && summary.role !== roleFilter) {
      continue;
    }
    summaries.push(summary);
  }
  return summaries;
}

function broadcastClientList(server) {
  const clients = listClients(server);
  const payload = { type: "client-list", clients };
  for (const client of server.clients) {
    sendJson(client, payload);
  }
}

function cleanupPendingInspections(client) {
  clientRegistry.delete(client.id);
  for (const [requestId, source] of pendingInspections.entries()) {
    if (source && source.id === client.id) {
      pendingInspections.delete(requestId);
    }
  }
}

function generateRequestId() {
  return randomBytes(16).toString("hex");
}

function handleCommand(command, payload, client, server) {
  if (command === "register") {
    let identity;
    let role;
    if (payload && typeof payload === "object") {
      identity = payload.identity;
      role = payload.role;
    }
    if (!identity || !role) {
      return [{ status: "error", message: "identity and role required" }, null];
    }
    clientRegistry.set(client.id, { identity, role });
    broadcastClientList(server);
    return [{ status: "ok", message: "Registered" }, null];
  }

  if (command === "ping") {
    return [{ status: "ok", data: "pong" }, null];
  }

  if (command === "echo") {
    return [{ status: "ok", data: payload }, null];
  }

  if (command === "client-command") {
    return [
      { status: "ok", message: "Forwarded to connected clients" },
      {
        target: null,
        payload: { type: "client-command", payload },
      },
    ];
  }

  if (command === "list-clients") {
    return [{ status: "ok", clients: listClients(server, "agent") }, null];
  }

  if (command === "inspect") {
    const data = payload || {};
    const rawTargetId = data.targetId;
    const targetId =
      rawTargetId === undefined || rawTargetId === null
        ? null
        : Number(rawTargetId);
    if (targetId === null || Number.isNaN(targetId)) {
      return [{ status: "error", message: "targetId required" }, null];
    }
    const targetClient = Array.from(server.clients).find((c) => c.id === targetId);
    if (!targetClient) {
      return [
        { status: "error", message: `Client ${targetId} not connected` },
        null,
      ];
    }
    const requestId = data.requestId || generateRequestId();
    pendingInspections.set(requestId, client);
    const selector = data.selector || "body";
    return [
      { status: "ok", requestId, message: "Inspect request sent" },
      {
        target: targetClient,
        payload: {
          type: "client-command",
          payload: {
            type: "inspect-request",
            selector,
            requestId,
          },
        },
      },
    ];
  }

  if (command === "inspect-response") {
    const data = payload || {};
    const requestId = data.requestId;
    if (!requestId) {
      return [{ status: "error", message: "requestId required" }, null];
    }
    const source = pendingInspections.get(requestId);
    if (!source) {
      return [{ status: "error", message: "Unknown inspection request" }, null];
    }
    pendingInspections.delete(requestId);
    return [
      { status: "ok", message: "Inspect response forwarded" },
      {
        target: source,
        payload: {
          type: "inspect-result",
          requestId,
          details: data.details,
        },
      },
    ];
  }

  return [{ status: "error", message: `Unknown command '${command}'` }, null];
}

function sendJson(client, payload) {
  if (client.readyState !== WebSocket.OPEN) {
    return;
  }
  try {
    client.send(JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to send payload:", err);
  }
}

function dispatchOutbound(server, outbound) {
  if (!outbound) {
    return;
  }

  const payload =
    outbound.payload && typeof outbound.payload === "object"
      ? JSON.stringify(outbound.payload)
      : outbound.payload;

  if (outbound.target === null) {
    for (const client of server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  } else if (outbound.target.readyState === WebSocket.OPEN) {
    outbound.target.send(payload);
  }
}

function onNewClient(client, server) {
  console.log(`New client connected: ${client.id}`);
  sendJson(client, {
    type: "welcome",
    message: "Connected to Node.js WebSocket server",
  });
  broadcastClientList(server);
}

function onMessage(client, server, message) {
  const text = typeof message === "string" ? message : message.toString("utf8");
  console.log(`Received raw message from client ${client.id}: ${text}`);

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    sendJson(client, { type: "error", message: "Expected JSON payload" });
    return;
  }

  const command = payload.command;
  const data = payload.data;
  if (!command) {
    sendJson(client, { type: "error", message: "Payload missing 'command'" });
    return;
  }

  const [result, outbound] = handleCommand(command, data, client, server);
  sendJson(client, { type: "command-result", command, ...result });
  dispatchOutbound(server, outbound);
}

function onClientLeft(client, server) {
  console.log(`Client disconnected: ${client.id}`);
  cleanupPendingInspections(client);
  broadcastClientList(server);
}

function startServer() {
  const server = new WebSocket.Server({ port: 65432, host: "0.0.0.0" });

  server.on("connection", (client, req) => {
    client.id = nextClientId++;
    client.address = req.socket.remoteAddress;
    client.port = req.socket.remotePort;
    onNewClient(client, server);
    client.on("message", (message) => onMessage(client, server, message));
    client.on("close", () => onClientLeft(client, server));
  });

  console.log("WebSocket Server running on ws://0.0.0.0:65432 ...");
}

startServer();
