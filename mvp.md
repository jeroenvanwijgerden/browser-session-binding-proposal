The MVP would exist to allow people to get a feel for the flow, and shows the feasibility of an adoption path via browser extension; some carefully audited extension could be an opening for proposal-supporting password manager vendors to decide to start supporting the proposal.

For the MVP, many parameters of the proposal can be omitted. What's important is the primary flow. Everywhere in the proposal where a choice is allowed, for the MVP just make a single choice. Also skip all bounds checks. What is mega important it to show that the proposal works _with_ passkeys, instead of against passkeys, so the auth mechanism must be passkeys.

helpful to require understanding of but a single language to understand mvp; since web page must be in javascript, have server also in javascript.

I'm thinking three softwares:
- a browser extension
- a service server (nodejs), which
  - hosts a single page
  - has the protocol's endpoints
  - no persistence; fine for demo to register a passkey each time
  - no timers; instead have a function that expires a session, use REPL, easier to test
- an app server (nodejs) 
  - could be on same server as service, but to really show they can be seperate, just run this as a second server
  - instead of phone, just another browser tab
  - instead of QR and base64 encoding, browser just shows plaintext; copy-paste into app

Before main flow:
- app has input field for username (can use to make a User and Attacker app)
- app registers passkey with service under name User
  - just 500 if passkey for user already exists

The main flow with baked-in choices would be:
- A login page requests from the browser (extension) for a ceremony with return result as promise. On promise resolve callback, just append a div with `Hello <username>` to the page body.
- browser shows only origin (no need for login page to send name/description)
- browser extension performs handshake, offers only Ed25519 as algo.
- server responds with Ed25519; no pairing code spec, is always two digits.
- browser creates key pair, sends initialize request.
- server creates a session ID (UUIDv4), sends back to browser
- browser shows plaintext session_id + negotiate url
    - TODO: update proposal, browser MUST instruct user what to do, e.g. use companion app compatible with protocol and scan QR code.
- browser adds a text input field for pairing code and a 'complete' button.
    - TODO: add to proposal that when adding pairing code UI elements, browser MUST inform user to enter pairing code only after their own companion app shows it.
- app shows input field for plaintext paste, and negotiate button
- paste stuff into app, click negotiate. App sends request to server
- negotiation involves passkey thing, staged result is username.
- For this step I do want expire and compromised checking, requires implementation on both server and app
- in case of success, app shows pairing code
- copy-paste pairing code into browser
- click 'complete' in browser
- webpage shows Hello User
