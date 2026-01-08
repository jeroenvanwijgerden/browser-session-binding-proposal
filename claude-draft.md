Here's a complete first draft. You'll want to review, adjust tone to your voice, and fill in the one placeholder at the end.

---

# Secure Out-of-Band Credential Delegation for Web Browsers

**A Protocol Proposal**

**Author:** [Your full name]
**Date:** January 2026
**Version:** 0.1 (Draft for public comment)

---

## Abstract

Cross-device authentication on the web currently requires platform-specific integrations that give operating system vendors gatekeeping power over which authenticators may participate. This proposal describes a browser-native protocol for secure out-of-band credential delegation that is agnostic to authentication method, ceremony type, and authenticator application. The protocol enables a user to initiate a capability request in one context (a browser session) and authorize it from another context (a mobile application), with cryptographic binding and human verification that prevent phishing and session confusion attacks. Beyond authentication, the protocol generalizes to payments, document signing, and access delegation. The design is simple enough for broad implementation while providing security properties comparable to or exceeding current platform-coupled solutions. This document is intended as a foundation for formal standardization and invites further development by the standards community.

---

## 1. Introduction

When a user wishes to authenticate a web browser session using a credential held on another device—typically a mobile phone—they currently have limited options. Platform-coupled solutions such as FIDO2 hybrid transport require the authenticator application to be blessed by the browser vendor or operating system. Independent authenticator applications cannot participate without platform cooperation.

This coupling has consequences. Users are locked into platform ecosystems. Small services cannot offer the same seamless authentication experience as large platform vendors. Privacy-focused or government-issued authenticator applications face barriers to adoption. The browser, historically a neutral user agent, becomes a gatekeeper.

This proposal describes a protocol that restores neutrality. Any compliant browser can work with any compliant authenticator application to delegate credentials from any compliant service. The browser mediates a secure ceremony without needing to understand or trust the specific authentication method used.

The protocol is simple: four HTTP endpoints, three tokens, one human-verified binding. It requires no novel cryptography. A competent developer can implement the server component in a day. Yet it provides strong security guarantees: phishing becomes structurally impossible, and session confusion attacks are detected and prevented.

While the motivating use case is cross-device authentication, the protocol generalizes. Any ceremony in which a user wishes to authorize a capability request from an out-of-band context—payments, document signing, access grants, device provisioning—fits the same model. This proposal describes the general protocol and treats authentication as the primary example.

---

## 2. Design Goals

The protocol is designed to satisfy the following goals:

**Phishing resistance.** A user following the protocol correctly cannot be tricked into authorizing a session controlled by an attacker, even if the attacker controls the web page that initiates the ceremony.

**Authentication-method agnosticism.** The protocol does not specify how the user authenticates to the service. Passkeys, passwords, OAuth, government eID schemes, biometrics, hardware tokens—any method works. The protocol concerns itself only with securely routing the result of authentication to the correct browser session.

**Platform neutrality.** No party requires permission from browser vendors or operating system vendors to participate. A compliant authenticator application needs only the ability to make HTTP requests and display a user interface.

**Ceremony agnosticism.** The same protocol structure supports login, payment authorization, document signing, access delegation, and other ceremonies. The browser and authenticator application display appropriate UI for the ceremony type, but the underlying protocol is identical.

**Simplicity.** The protocol should be easy to understand, implement, and analyze. Complexity is a source of bugs and vulnerabilities.

**User experience parity.** The number of manual steps required should be comparable to existing cross-device authentication flows that have demonstrated broad usability, such as the DigiD application used in the Netherlands since 2017.

---

## 3. Participants and Terminology

The protocol involves four participants:

**Client.** The service's in-browser application, typically JavaScript running in a web page. The client initiates the ceremony by invoking a browser API. The client is untrusted: it may be malicious, compromised, or simply buggy. The protocol does not rely on the client behaving correctly.

**Browser.** The user's web browser, specifically a native, sandboxed user interface that the client cannot manipulate. The browser displays trusted UI, generates cryptographic tokens, communicates with the server, and either sets cookies or returns data to the client upon completion.

**App.** The authenticator application running on another device (or potentially the same device). The app receives ceremony parameters out-of-band (for example, by scanning a QR code), authenticates the user to the server, and approves the credential delegation.

**Server.** The service's HTTP server. The server implements four endpoints and maintains short-lived state mapping sessions to authenticated identities.

Additional terminology:

**Ceremony.** A complete protocol run, from initiation to completion.

**Capability.** The credential or authorization that the browser receives upon successful completion. This may be a session cookie, an access token, a cryptographic signature, or other data.

**Session ID.** A cryptographically random identifier generated by the browser that uniquely identifies a ceremony instance.

**Confirmation code.** A short code (for example, two digits) displayed by the browser and entered by the user into the app, providing human-verified binding between browser and app.

---

## 4. Protocol Overview

The protocol proceeds in four phases: initiation, authentication, claiming, and finalization.

### 4.1 Initiation

The client invokes the browser's secure delegation API, providing:

- Endpoint paths for the four server endpoints (authorize, claim, approve, finalize)
- A ceremony type and human-readable description
- A finalization mode (cookie, object, bytes, or redirect)
- Optionally, an opaque payload for the app

The browser constructs full URLs by combining the endpoint paths with the client's origin. The browser generates a cryptographically random session ID. The browser displays a trusted UI showing the ceremony description and a machine-readable transfer payload (for example, a QR code) containing the endpoint URLs, session ID, and any client-provided payload.

### 4.2 Authentication

The user transfers the payload to the app via an out-of-band mechanism (scanning a QR code, NFC tap, manual entry, or other means). The app parses the payload, displays the ceremony details to the user, and requests confirmation.

Upon user confirmation, the app authenticates the user to the server via the authorize endpoint. The authentication method is outside the scope of this protocol; it may be a passkey assertion, a password, an OAuth token exchange, or any other mechanism the server supports.

Upon successful authentication, the server:

- Generates a cryptographically random approve token
- Stores a record associating the session ID with the authenticated identity and the approve token
- Returns the approve token to the app

The app stores the approve token and awaits the confirmation code.

### 4.3 Claiming

The browser polls the claim endpoint, providing the session ID. When the server has a record of successful authentication for that session ID, it:

- Generates a cryptographically random finalize token
- Generates a confirmation code (for example, two random digits)
- Stores a record associating the finalize token with the authenticated identity and confirmation code
- Returns the finalize token and confirmation code to the browser

The browser stores the finalize token and displays the confirmation code to the user with instructions to enter it into the app.

The user enters the confirmation code into the app. The app submits the approve token and confirmation code to the approve endpoint. The server verifies:

- The approve token is valid
- The confirmation code matches
- Exactly one claim exists for this authenticated session

If multiple claims exist, the server rejects the approval and informs the app that the ceremony has been aborted due to a suspected attack. If no claims exist, the server informs the app that the user should wait for the browser to claim. If exactly one claim exists with matching confirmation code, the server:

- Stores a record associating the finalize token with approval
- Returns success to the app

The app displays confirmation that the ceremony can now be finalized.

### 4.4 Finalization

The browser polls the finalize endpoint, providing the finalize token. When the server has a record of approval for that finalize token, it returns the capability according to the requested finalization mode.

The browser processes the capability:

- **Cookie mode:** The browser sets cookies as specified by the server and navigates to a completion URL.
- **Object mode:** The browser resolves the API promise with a JavaScript object.
- **Bytes mode:** The browser resolves the API promise with binary data.
- **Redirect mode:** The browser navigates to a server-specified URL.

The ceremony is complete.

---

## 5. Security Properties

### 5.1 Phishing Resistance

An attacker who controls a malicious website cannot use this protocol to gain access to a user's account on a legitimate service.

The browser constructs endpoint URLs from its own knowledge of the page's origin. The attacker cannot cause the browser to display a QR code pointing to a legitimate service while the page is served from a malicious origin.

If the attacker creates a lookalike page on their own origin, the app will display the attacker's origin during the authentication phase. A user who checks the origin will notice the mismatch.

Even if the user does not check the origin and authenticates to the attacker's service, the attacker gains only access to their own service—not to any legitimate service the user intended to access.

### 5.2 Session Confusion Resistance

An attacker who observes a ceremony in progress (for example, by shoulder-surfing the QR code) cannot hijack the session.

If the attacker scans the QR code and attempts to authenticate, their authentication creates a separate record associated with the same session ID. When the legitimate browser claims, and the user approves, the server detects multiple claims and aborts the ceremony.

The attacker cannot approve before the user because the attacker does not know the confirmation code, which is displayed only on the legitimate browser after claiming.

The attacker cannot claim first and obtain the confirmation code because claiming requires only the session ID (which the attacker has), but approval requires the approve token (which only the legitimate app has, from its own authentication).

In detail: if the attacker claims first, they obtain a finalize token and confirmation code. But they cannot approve, because they lack the approve token. The legitimate user's app has the approve token but has not yet seen a confirmation code. When the legitimate browser claims, the server generates a second finalize token and confirmation code for the same session. At approval time, the server detects multiple claims and aborts.

### 5.3 Confirmation Code Purpose

The confirmation code serves two functions:

1. It provides human-verified evidence that the browser and app are participating in the same ceremony, preventing approval of the wrong session due to user error.

2. It acts as a barrier against reflexive or muscle-memory approval. A user who is conditioned to approve login requests without attention will be interrupted by the requirement to enter a code.

The confirmation code is not a primary security mechanism; the claim-counting check provides the cryptographic guarantee. The confirmation code is a usability and error-prevention mechanism that complements the cryptographic protocol.

### 5.4 Trust Assumptions

The protocol assumes:

- The browser is not compromised. A compromised browser can steal any credential regardless of protocol.
- The app is not compromised. A compromised app can impersonate the user regardless of protocol.
- The server implements the protocol correctly. An incorrect implementation may have vulnerabilities.
- Communication occurs over HTTPS. The protocol does not protect against network attackers who can break TLS.
- Tokens are cryptographically random and of sufficient length (at least 128 bits of entropy).

The protocol does not assume the client is trustworthy. A malicious client can initiate unwanted ceremonies but cannot cause the user to authorize them without the user's participation in the app.

---

## 6. Generalization Beyond Authentication

The protocol structure is not specific to login. Any ceremony in which:

- A capability request originates in one context
- Authorization occurs in a separate, more trusted context
- The two contexts must be bound with user verification

...fits this model.

### 6.1 Payments

A browser session wishes to authorize a payment. The client initiates a ceremony with `type: "payment"` and a payload containing the amount and merchant. The app displays the payment details and requests user confirmation. Upon completion, the browser receives a payment token that the client submits to complete the transaction.

The user sees the true merchant and amount in the trusted app UI, not in the potentially-compromised browser page. Phishing attacks that display a low price while charging a higher amount are prevented.

### 6.2 Document Signing

A browser session presents a document for signing. The client initiates a ceremony with `type: "signature"` and a payload containing a document hash. The app displays the document identifier and hash, requests confirmation, and produces a signature using a key held on the device. Upon completion, the browser receives the signature bytes.

The signing key never exists in the browser context. A compromised page cannot sign documents without the user's explicit participation in the app.

### 6.3 Access Delegation

A browser session requests access to a protected resource. The client initiates a ceremony with `type: "access"` and a payload describing the requested permissions. The app displays the permission request, the user approves, and the browser receives a scoped access token.

This pattern applies to OAuth-style consent flows, sharing permissions, or capability-based access control systems.

### 6.4 Device Provisioning

A new device displays a QR code representing a provisioning request. A user scans with a management app, confirms the device identifier, and approves provisioning. The device receives credentials to join a network or fleet.

The ceremony ensures the user intends to provision this specific device, preventing an attacker from substituting their own device's QR code.

---

## 7. Finalization Modes

The browser's action upon receiving the capability is determined by the finalization mode requested by the client.

### 7.1 Cookie Mode

The server returns cookie parameters (name, value, flags). The browser sets the cookies and navigates to a completion URL.

This mode provides maximum protection against cross-site scripting (XSS) attacks. The capability never passes through client JavaScript. Suitable for traditional server-rendered applications.

### 7.2 Object Mode

The server returns a JSON object. The browser resolves the API promise with this object, making it available to the client.

This mode is suitable for single-page applications that manage authentication state in JavaScript. The client is responsible for secure handling of the returned data.

### 7.3 Bytes Mode

The server returns binary data. The browser resolves the API promise with the data as an ArrayBuffer or Blob.

This mode is suitable for ceremonies that produce cryptographic material, such as signatures or certificates.

### 7.4 Redirect Mode

The server returns a URL. The browser navigates to that URL.

This mode is suitable for server-rendered flows where the server maintains session state and no credential needs to pass through the browser.

---

## 8. Implementation Considerations

### 8.1 Token Requirements

Session IDs, approve tokens, and finalize tokens must be cryptographically random with at least 128 bits of entropy. They must be single-use and expire promptly (recommended: 60-120 seconds).

### 8.2 Rate Limiting

Endpoints should be rate-limited to prevent enumeration attacks. Failed requests should not reveal whether a token exists.

### 8.3 Out-of-Band Transfer Mechanisms

The protocol does not mandate a specific transfer mechanism. QR codes are the expected default for cross-device use. Alternatives include NFC, Bluetooth, USB, ultrasonic audio, or manual entry. Implementations should offer accessibility alternatives for users who cannot use visual transfer mechanisms.

### 8.4 Confirmation Code Format

The confirmation code should be short enough for easy entry but long enough to prevent accidental matches. Two decimal digits (100 possibilities) are sufficient given the short validity window and rate limiting. Implementations may choose longer codes for additional assurance.

### 8.5 Server State Management

The server must maintain short-lived state for pending ceremonies. This state may reside in memory, a database, or a distributed cache. Implementations should ensure that state expiration is enforced and that the state store does not become a resource exhaustion vector.

A reference implementation of the server component as a stateless, containerized service is feasible and would simplify adoption.

---

## 9. Policy Relevance

### 9.1 EU Digital Identity Wallet

The European Union's eIDAS 2.0 regulation mandates that member states provide citizens with digital identity wallets. These wallets must be interoperable across borders and services.

For digital identity wallets to function in web browsers, they need a standard mechanism to authenticate browser sessions. Currently, no such mechanism exists that does not require browser vendor cooperation. Platform-coupled solutions (FIDO2 hybrid transport) give Apple, Google, and Microsoft gatekeeping power over EU digital identity infrastructure.

This protocol would allow EU Digital Identity Wallets to work with any compliant browser without platform blessing. The EU could mandate browser support for this protocol as a condition of market access, similar to how it has mandated USB-C connectors and third-party app store support.

### 9.2 Digital Markets Act

The Digital Markets Act (DMA) designates certain large platforms as "gatekeepers" subject to interoperability requirements. Browser vendors' control over which authenticators may participate in cross-device authentication is a form of gatekeeping.

A mandated open protocol for credential delegation would align with the DMA's goals of reducing platform lock-in and enabling competition.

### 9.3 Payment Services Directive

The Payment Services Directive (PSD2) requires Strong Customer Authentication for online payments. Banks implement this via mobile apps, but browser integration is inconsistent and often clunky.

This protocol's payment ceremony would provide a standardized, secure, user-friendly mechanism for PSD2 compliance.

---

## 10. Related Work

**OAuth 2.0 Device Authorization Grant (RFC 8628).** This protocol addresses a superficially similar problem: authorizing a limited device by authenticating on another device. However, the direction is inverted (the limited device polls; the browser authorizes), and the binding mechanism is weaker (no confirmation code from the polling device, no multi-claim detection). The Device Authorization Grant is vulnerable to phishing attacks that this protocol prevents.

**FIDO2 Hybrid Transport.** The FIDO Alliance's solution for cross-device authentication using phones as roaming authenticators. Provides strong security but requires platform-level integration. Authenticator applications need operating system and browser vendor blessing to participate.

**Client-Initiated Backchannel Authentication (CIBA).** An OpenID Connect extension for scenarios where the user is not at the device initiating authentication. Similar in spirit but tightly coupled to OAuth/OIDC, lacks browser-native trusted UI, and has weaker binding guarantees.

**SQRL (Secure Quick Reliable Login).** A 2013 proposal by Steve Gibson with similar goals. SQRL specifies the authentication method (a specific key derivation scheme), making it less flexible. Its binding mechanism lacks multi-claim detection. SQRL did not achieve significant adoption.

This proposal differs from all of the above by being authentication-method agnostic, ceremony agnostic, platform neutral, and by providing stronger binding guarantees through bidirectional confirmation and multi-claim detection.

---

## 11. Future Work

This document is a preliminary proposal intended to establish the core ideas and invite further development. The following work remains:

**Formal specification.** A rigorous specification suitable for implementation and standardization, including precise endpoint schemas, error codes, and timing requirements.

**Security analysis.** Formal or semi-formal security analysis, potentially including symbolic verification tools, to validate the security claims.

**Usability research.** User studies to validate that the ceremony is completable by general populations and that attack scenarios are recognized.

**Reference implementation.** Open-source implementations of the browser API (as a polyfill or extension), a sample server, and a sample authenticator application.

**Accessibility review.** Detailed analysis and recommendations for users with visual, motor, or cognitive disabilities.

**Standardization.** Submission to appropriate standards bodies (W3C, IETF, ETSI, or others) for formal standardization.

---

## 12. Conclusion

This proposal describes a simple protocol for secure out-of-band credential delegation that addresses a genuine gap in web infrastructure. The protocol is authentication-method agnostic, ceremony agnostic, and platform neutral. It provides strong security guarantees against phishing and session confusion attacks while requiring no novel cryptography and minimal implementation complexity.

The motivating problem—cross-device authentication without platform gatekeeping—is newly urgent with the rise of passkeys and government digital identity initiatives. The protocol's generalization to payments, signing, and access delegation broadens its applicability and its potential constituency for standardization.

The author invites security researchers, browser vendors, identity specialists, and policy experts to critique, refine, and build upon this proposal. The web should remain open. Authentication should not be a chokepoint for platform control.

---

## About the Author

[Your name] is a software engineer with ten years of experience building web applications. This proposal emerged from practical frustration with the state of cross-device authentication and a conviction that the open web is worth preserving. Correspondence is welcome at [your email or website].

---

## License

This document is released under the Creative Commons Attribution 4.0 International License (CC BY 4.0). You are free to share and adapt this material for any purpose, provided you give appropriate credit to the original author.

---

## References

1. IETF RFC 8628: OAuth 2.0 Device Authorization Grant
2. W3C Web Authentication (WebAuthn) Level 2
3. FIDO Alliance: Client to Authenticator Protocol (CTAP) 2.1
4. OpenID Connect Client-Initiated Backchannel Authentication (CIBA)
5. European Commission: eIDAS 2.0 Regulation
6. European Commission: Digital Markets Act
7. European Commission: Payment Services Directive 2 (PSD2)
8. Gibson, S.: SQRL (Secure Quick Reliable Login), 2013

---

*End of document.*

---

That's a complete first draft. Read it through, adjust anything that doesn't match your voice or intent, fill in your name and contact details, and it's ready to publish.