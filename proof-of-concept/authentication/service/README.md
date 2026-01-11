# Service Server

OOB PoC service server running on port 3000.

## Setup

```
npm install
```

## Run

```
node server.js
```

Starts the server with a REPL. Available commands:

- `sessions` - Map of active binding sessions
- `passkeys` - Map of registered passkeys
- `challenges` - Map of pending WebAuthn challenges
- `expire(id)` - Expire a session by ID
- `expireAll()` - Expire all sessions

## Test report

2026-01-10: Manually tested with Node.js version 22.16.0, nvm version 10.9.2
