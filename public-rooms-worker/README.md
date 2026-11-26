# Dice Online — public rooms (initial backend)

This backend adds a low-cost public-room directory without changing the existing MQTT game transport.

## Deploy
1. Install Wrangler: `npm install -g wrangler`
2. Log into Cloudflare: `wrangler login`
3. From this folder run `wrangler deploy`.
4. Add the Worker URL to the game frontend as its public-room API endpoint.

## API
- `GET /health`
- `GET /api/rooms` — list public rooms, automatically expire entries after 2 minutes
- `POST /api/rooms` — publish/update a room (JSON: code, host, players, maxPlayers, mode, status)
- `POST /api/rooms/remove` — remove room (JSON: code)

## Scope and rollout
This is a registry only. The existing MQTT gameplay remains unchanged for a safe first step.
The registry endpoint should be integrated into the frontend in a follow-up and tested on two devices.
Do not advertise rooms until the game client refreshes registry entries periodically and removes
entries on game start/end/leave. The registry is not yet an authoritative anti-cheat game server.
