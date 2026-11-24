# Kości Online — Multiplayer Security Audit (initial)

Branch: `security-audit/multiplayer-hardening`

## Scope and limitations
This is an initial code-level review of the public client code. It is not a penetration test. Firebase Security Rules, broker configuration, Firebase console settings, and any backend deployment were not available for inspection.

## Findings to investigate

### High priority: room state is client-published over public MQTT brokers
The client uses public broker endpoints and publishes the room state to `kosci-mk-v2/<ROOM>/state`. Client-side checks such as host-name comparisons are not server-side authorization. Investigate broker topic permissions, retained-message behavior, and spoofed room updates.

### High priority: game state is not authoritative
The client applies game actions locally and publishes the resulting state. An untrusted client may be able to construct state payloads. A server-authoritative game service (or a trusted validation layer) should validate moves, dice results, turn ownership, scores, and game completion before accepting state.

### Medium priority: classic-mode move replay validation
The current `K.movesOk(g)` implementation returns true for classic mode (and for missing move arrays), so this function does not replay-check classic-mode history. Review and implement validation that covers classic mode, all modes, and malformed/missing history.

### Medium priority: version/state checks are client-side
State version comparisons and `stOk` checks help synchronization and reject some invalid payloads, but are not security boundaries against modified clients.

## Recommended test plan
1. Preserve the production branch and test only in a disposable room.
2. Document broker permissions and whether retained room state can be overwritten by arbitrary clients.
3. Verify that a non-host client cannot change host, player list, turn, dice, scores, game mode, or game identifier.
4. Verify that stale, malformed, oversized, and out-of-order payloads are rejected safely.
5. Review Firebase Authentication, Firestore Security Rules, and any write paths for public profile, score, history, or admin data.
6. Design a server-authoritative architecture before changing production game logic.

## Proposed next implementation
Build a separate test harness / prototype for validation first. Do not patch production game logic until broker and Firebase configuration are understood and regression tests exist.
