import json
from typing import Any, Dict, List, Optional
from uuid import uuid4
from websocket_server import WebsocketServer


pending_inspections: Dict[str, Any] = {}
client_registry: Dict[int, Dict[str, str]] = {}


def get_client_summary(client):
    metadata = client_registry.get(client["id"], {})
    return {
        "clientId": client["id"],
        "address": client["address"][0],
        "identity": metadata.get("identity", f"client-{client['id']}"),
        "role": metadata.get("role", "unknown"),
    }


def list_clients(server, role_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    summaries = []
    for client in server.clients:
        summary = get_client_summary(client)
        if role_filter and summary["role"] != role_filter:
            continue
        summaries.append(summary)
    return summaries


def broadcast_client_list(server):
    clients = list(list_clients(server))
    payload = {"type": "client-list", "clients": clients}
    server.send_message_to_all(json.dumps(payload))


def cleanup_pending_inspections(client):
    client_registry.pop(client["id"], None)
    keys = [request_id for request_id, source in pending_inspections.items() if source["id"] == client["id"]]
    for request_id in keys:
        pending_inspections.pop(request_id, None)


def handle_command(command: str, payload, client, server):
    if command == "register":
        identity = None
        role = None
        if isinstance(payload, dict):
            identity = payload.get("identity")
            role = payload.get("role")
        if not identity or not role:
            return {"status": "error", "message": "identity and role required"}, None
        client_registry[client["id"]] = {"identity": identity, "role": role}
        broadcast_client_list(server)
        return {"status": "ok", "message": "Registered"}, None
    if command == "ping":
        return {"status": "ok", "data": "pong"}, None
    if command == "echo":
        return {"status": "ok", "data": payload}, None
    if command == "client-command":
        return (
            {"status": "ok", "message": "Forwarded to connected clients"},
            {"target": None, "payload": {"type": "client-command", "payload": payload}},
        )
    if command == "list-clients":
        return {"status": "ok", "clients": list_clients(server, role_filter="agent")}, None

    if command == "inspect":
        data = payload or {}
        target_id = data.get("targetId")
        selector = data.get("selector", "body")
        if target_id is None:
            return {"status": "error", "message": "targetId required"}, None
        target_client = next((c for c in server.clients if c["id"] == target_id), None)
        if not target_client:
            return {"status": "error", "message": f"Client {target_id} not connected"}, None
        request_id = data.get("requestId") or uuid4().hex
        pending_inspections[request_id] = client
        return (
            {"status": "ok", "requestId": request_id, "message": "Inspect request sent"},
            {
                "target": target_client,
                "payload": {
                    "type": "client-command",
                    "payload": {
                        "type": "inspect-request",
                        "selector": selector,
                        "requestId": request_id,
                    },
                },
            },
        )

    if command == "inspect-response":
        data = payload or {}
        request_id = data.get("requestId")
        source = pending_inspections.pop(request_id, None)
        if source is None:
            return {"status": "error", "message": "Unknown inspection request"}, None
        return (
            {"status": "ok", "message": "Inspect response forwarded"},
            {
                "target": source,
                "payload": {
                    "type": "inspect-result",
                    "requestId": request_id,
                    "details": data.get("details"),
                },
            },
        )

    return (
        {"status": "error", "message": f"Unknown command '{command}'"},
        None,
    )


def send_json(client, server, payload):
    """Serialize payload to JSON so JS clients get structured replies."""
    server.send_message(client, json.dumps(payload))


def dispatch_outbound(server, outbound):
    if outbound is None:
        return
    payload = outbound["payload"]
    if isinstance(payload, (dict, list)):
        payload = json.dumps(payload)
    if outbound["target"] is None:
        server.send_message_to_all(payload)
    else:
        server.send_message(outbound["target"], payload)


# Called when a new client connects
def on_new_client(client, server):
    print(f"New client connected: {client['id']}")
    send_json(client, server, {"type": "welcome", "message": "Connected to Python 3 WebSocket server"})
    broadcast_client_list(server)


# Called when a client sends a message
def on_message(client, server, message):
    print(f"Received raw message from client {client['id']}: {message}")

    try:
        payload = json.loads(message)
    except json.JSONDecodeError:
        send_json(client, server, {"type": "error", "message": "Expected JSON payload"})
        return

    command = payload.get("command")
    data = payload.get("data")
    if not command:
        send_json(client, server, {"type": "error", "message": "Payload missing 'command'"})
        return

    result, outbound = handle_command(command, data, client, server)
    send_json(client, server, {"type": "command-result", "command": command, **result})
    dispatch_outbound(server, outbound)


# Called when a client disconnects
def on_client_left(client, server):
    print(f"Client disconnected: {client['id']}")
    cleanup_pending_inspections(client)
    broadcast_client_list(server)


def main():
    server = WebsocketServer(port=65432, host="0.0.0.0")
    server.set_fn_new_client(on_new_client)
    server.set_fn_client_left(on_client_left)
    server.set_fn_message_received(on_message)

    print("WebSocket Server running on ws://0.0.0.0:65432 ...")
    server.run_forever()


if __name__ == "__main__":
    main()
