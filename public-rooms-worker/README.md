# Dice Online — public rooms (initial backend)

Cloudflare Worker + Durable Object registry for discovery. Existing MQTT gameplay remains unchanged.

## Deploy
1. Install Wrangler: `npm install -g wrangler`
2. Log into Cloudflare: `wrangler login`
3. From this folder run `wrangler deploy`.
4. Copy the Worker URL into the game's Public rooms API field and save.

## API
- `GET /health` — health check
- `GET /api/rooms` — list live rooms (expire after 2 minutes)
- `POST /api/rooms` — publish/update (code, host, players, maxPlayers, mode, status)

## Limitations
- Client publishes on game state changes and a 25-second heartbeat.
- Expired listings are cleaned during directory reads and capacity checks.
- Registry is discovery only; MQTT gameplay remains separate and this is not an authoritative anti-cheat server.
- API is unauthenticated; CORS is not security. Clients can submit misleading listings.
- POSTs are limited to 60 per IP per minute and payloads are capped at 2 KB as basic abuse controls; these are not authentication or anti-cheat.\n- Deploy and test before sharing widely.
- Listing and Quick Match require a deployed API configured in the client.
