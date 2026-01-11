# Secure and Sovereign Out-of-Band Session Binding for Web Browsers

**A Protocol Proposal for Discussion**

**Author:** Jeroen van Wijgerden

**Date:** January 2026

**Version:** 0.6 (Draft for public comment)

**Disclosure:** The protocol design and core ideas are the author's original work. Large language models were used to identify edge cases, stress-test the security model, and create a proof of concept. Of the text in this document, the author personally wrote only this disclosure, the abstract, and the executive summary; the remainder was drafted by a large language model for a standards audience. The author reviewed all but edited only some of the generated text.

The author is a software engineer, not a security or UX expert. The protocol design reflects engineering judgment about secure system composition; specific parameter recommendations (entropy requirements, pairing code lengths, token lifetimes) are based on common practice and should be validated by domain experts.

This disclosure is provided in the interest of transparency.

---

## Abstract

This proposal enables the use of passkeys for cross-device authentication without vendor permission or lock-in. The proposed protocol is highly secure and has a similar UX to existing cross-device authentication. A proof of concept is available [here]([url redacted for now]). This proposal does not compete with passkeys; it offers infrastructure for it. In fact, the protocol is agnostic about passkeys, and even agnostic about authentication.

The infrastructure enables a browser to securely fetch a result (such as a JWT) negotiated by a companion app and a service, where a user controls both the browser and the app. Besides authentication, possible uses include live file transfer, for which a proof of concept is available [here]([url redacted for now]).

Any complying browser, app, and service can participate. For many applications requiring secure cross-device operations, this proposal eliminates the need for a proprietary app. Instead, a service would implement four moderately simple endpoints. These endpoints could be offered as a standard container.



**Note on specifics:** This proposal focuses on the security model and protocol design. The specific API names, field names, parameter bounds, and wire formats are illustrative suggestions to make the design concrete and get a discussion going.

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [1. Problem Statement](#1-problem-statement)
  - [1.1 The Current Landscape](#11-the-current-landscape)
  - [1.2 The Consequences](#12-the-consequences)
  - [1.3 What This Proposal Changes](#13-what-this-proposal-changes)
  - [1.4 What This Protocol Is](#14-what-this-protocol-is)
  - [1.5 What This Protocol Is Not](#15-what-this-protocol-is-not)
- [2. Design Goals](#2-design-goals)
- [3. Participants and Terminology](#3-participants-and-terminology)
- [4. Proposed API](#4-proposed-api)
  - [4.1 Design Rationale](#41-design-rationale)
  - [4.2 WebIDL Definition](#42-webidl-definition)
  - [4.3 Example Usage](#43-example-usage)
  - [4.4 User Agent UI Requirements](#44-user-agent-ui-requirements)
  - [4.5 Transfer Mechanisms](#45-transfer-mechanisms)
    - [4.5.1 Transfer Payload Format](#451-transfer-payload-format)
    - [4.5.2 QR Code Capacity](#452-qr-code-capacity)
  - [4.6 Safety of Service-Provided Text](#46-safety-of-service-provided-text)
- [5. Protocol Flow](#5-protocol-flow)
  - [5.1 Overview](#51-overview)
  - [5.2 Phase 1: Handshake](#52-phase-1-handshake)
  - [5.3 Phase 2: Initialization](#53-phase-2-initialization)
  - [5.4 Phase 3: Pre-negotiation (Optional)](#54-phase-3-pre-negotiation-optional)
  - [5.5 Phase 4: Out-of-Band Operation (Negotiation)](#55-phase-4-out-of-band-operation-negotiation)
  - [5.6 Phase 5: Completion](#56-phase-5-completion)
  - [5.7 State Machine (Server-side)](#57-state-machine-server-side)
  - [5.8 Multi-Negotiation Detection](#58-multi-negotiation-detection)
  - [5.9 Security Mode Variations](#59-security-mode-variations)
- [6. The Pairing Code](#6-the-pairing-code)
  - [6.1 The Attack: Session Fixation via QR Observation](#61-the-attack-session-fixation-via-qr-observation)
  - [6.2 The Solution: Pairing Code](#62-the-solution-pairing-code)
  - [6.3 Pairing Code Specification](#63-pairing-code-specification)
  - [6.4 Timing and Attack Detection](#64-timing-and-attack-detection)
  - [6.5 Boundary Condition: Attacker Keyboard Access](#65-boundary-condition-attacker-keyboard-access)
  - [6.6 When to Disable the Pairing Code](#66-when-to-disable-the-pairing-code)
- [7. Security Analysis](#7-security-analysis)
  - [7.1 Threat Model](#71-threat-model)
  - [7.2 Binding Integrity](#72-binding-integrity)
  - [7.3 Phishing Resistance](#73-phishing-resistance)
  - [7.4 Session Hijacking Prevention](#74-session-hijacking-prevention)
  - [7.5 Session Fixation Prevention](#75-session-fixation-prevention)
  - [7.6 Trust Assumptions](#76-trust-assumptions)
  - [7.7 Implementation Correctness and the Existing Trust Model](#77-implementation-correctness-and-the-existing-trust-model)
- [8. Alternative Design Considered](#8-alternative-design-considered)
- [9. Privacy Considerations](#9-privacy-considerations)
  - [9.1 Information Disclosed](#91-information-disclosed)
  - [9.2 Tracking Prevention](#92-tracking-prevention)
  - [9.3 Transfer Mechanism Privacy](#93-transfer-mechanism-privacy)
- [10. Use Cases](#10-use-cases)
  - [10.1 Authentication](#101-authentication)
  - [10.2 Document Signing](#102-document-signing)
  - [10.3 Payment Authorization](#103-payment-authorization)
  - [10.4 Device Provisioning](#104-device-provisioning)
  - [10.5 Session Transfer](#105-session-transfer)
  - [10.6 File Transfer](#106-file-transfer)
  - [10.7 Implementation Considerations for Use Cases](#107-implementation-considerations-for-use-cases)
- [11. Implementation Considerations](#11-implementation-considerations)
  - [11.1 Service Endpoint Specifications](#111-service-endpoint-specifications)
  - [11.2 Cryptographic Requirements](#112-cryptographic-requirements)
  - [11.3 Accessibility](#113-accessibility)
  - [11.4 Ceremony Length](#114-ceremony-length)
  - [11.5 Browser-Server Communication](#115-browser-server-communication)
  - [11.6 State Management](#116-state-management)
- [12. Implementation Complexity by Party](#12-implementation-complexity-by-party)
  - [12.1 What Services Implement (And What They Don't)](#121-what-services-implement-and-what-they-dont)
  - [12.2 Web Page (Service's JavaScript)](#122-web-page-services-javascript)
  - [12.3 User Agent (Browser)](#123-user-agent-browser)
  - [12.4 Companion Application](#124-companion-application)
  - [12.5 Service (Server)](#125-service-server)
  - [12.6 State Cleanup](#126-state-cleanup)
  - [12.7 Deployment Considerations](#127-deployment-considerations)
- [13. Extensibility Points](#13-extensibility-points)
- [14. Relationship to Existing Standards](#14-relationship-to-existing-standards)
- [15. Anticipated Questions](#15-anticipated-questions)
- [16. Future Work](#16-future-work)
- [17. Adoption](#17-adoption)
  - [17.1 The Passkey Landscape](#171-the-passkey-landscape)
  - [17.2 Incentive Structures](#172-incentive-structures)
  - [17.3 Ecosystem-Driven Adoption](#173-ecosystem-driven-adoption)
  - [17.4 Regulatory Support](#174-regulatory-support)
  - [17.5 Independent Browser Vendors](#175-independent-browser-vendors)
  - [17.6 The Chicken-and-Egg Problem](#176-the-chicken-and-egg-problem)
  - [17.7 Why Native Browser Implementation Matters](#177-why-native-browser-implementation-matters)
  - [17.8 Polyfill Limitations](#178-polyfill-limitations)
- [18. Conclusion](#18-conclusion)
- [License](#license)
- [References](#references)
- [Appendix A: HTTP Endpoint Specifications](#appendix-a-http-endpoint-specifications)
  - [A.1 Handshake Endpoint](#a1-handshake-endpoint)
  - [A.2 Initialize Endpoint](#a2-initialize-endpoint)
  - [A.3 Negotiate Endpoint](#a3-negotiate-endpoint)
  - [A.4 Complete Endpoint](#a4-complete-endpoint)
- [Appendix B: WebSocket Protocol (Optional)](#appendix-b-websocket-protocol-optional)
  - [B.1 Connection](#b1-connection)
  - [B.2 Server Messages](#b2-server-messages)
  - [B.3 Client Messages](#b3-client-messages)
- [Appendix C: Server-Sent Events Protocol (Optional)](#appendix-c-server-sent-events-protocol-optional)
  - [C.1 Connection](#c1-connection)
  - [C.2 Event Stream](#c2-event-stream)
- [Appendix D: Alternative Design Analysis](#appendix-d-alternative-design-analysis)
  - [D.1 The Detection-Based Approach](#d1-the-detection-based-approach)
  - [D.2 Why The Current Design Is Better](#d2-why-the-current-design-is-better)
  - [D.3 The Tradeoff: Earlier State Creation](#d3-the-tradeoff-earlier-state-creation)
- [Appendix E: File Transfer Protocol](#appendix-e-file-transfer-protocol)
  - [E.1 Overview](#e1-overview)
  - [E.2 Protocol Flow](#e2-protocol-flow)
  - [E.3 Pre-negotiation Phase](#e3-pre-negotiation-phase)
  - [E.4 Negotiation Phase](#e4-negotiation-phase)
  - [E.5 Download Authentication](#e5-download-authentication)
  - [E.6 Security Considerations](#e6-security-considerations)
  - [E.7 Memory Efficiency](#e7-memory-efficiency)
  - [E.8 Proof of Concept](#e8-proof-of-concept)
- [Appendix F: QR Code Capacity Analysis](#appendix-f-qr-code-capacity-analysis)
  - [F.1 Question](#f1-question)
  - [F.2 Transfer Payload Components](#f2-transfer-payload-components)
  - [F.3 Realistic Transfer Payload Sizes](#f3-realistic-transfer-payload-sizes)
  - [F.4 QR Code Capacity](#f4-qr-code-capacity)
  - [F.5 Display Considerations](#f5-display-considerations)
  - [F.6 Conclusion](#f6-conclusion)

---

## Executive Summary

**Problem.** Security breaches for users interacting with web services via a browser remain commonplace. One contributing factor: secure cross-device authentication is artificially scarce. Today, only two types of organizations can offer it:

- **Browser/platform vendors** control the most secure option (FIDO2 hybrid transport, passkeys). They decide who may participate. Independent developers are excluded without vendor approval.

- **Large corporations** (banks, governments) can afford the alternative: building dedicated companion apps. The Dutch government's DigiD, for example, provides secure cross-device login—but only because the Netherlands can fund development, distribution, security audits, and ongoing maintenance of a dedicated app.

The vast majority of services do not have the influence to sway vendors or the resources to build and maintain a companion app.

**Solution.** This protocol decouples secure cross-device binding from dedicated apps. Services implement four server endpoints instead of building companion applications. Users could use a single general-purpose companion app (e.g., a password manager, authenticator) for multiple services.

The flow: A web page requests a browser-native UI. The browser starts a session with the server. The browser offers a QR code (or other means of data transfer). Operated by the user, a companion app scans the QR code and negotiates with the server. Upon successful negotiation, the server stages some result (e.g., a JWT) and sends the app a pairing code. The user enters the pairing code into the browser. The browser completes the session by retrieving the staged result. Optionally, the server can decide to skip the pairing code (trading UX for security).

**Beyond authentication.** While authentication is the primary use case, the protocol is general-purpose infrastructure. A second proof of concept demonstrates live file transfer: a user sends a file from their phone to any browser, with the relay service acting as a cross-origin bridge. This demonstrates two key capabilities: (1) the server-controlled origin policy allows legitimate cross-origin services like file relays, and (2) the optional pre-negotiation phase lets pages establish state with the server before the app connects—enabling streaming protocols built on top of OOB binding.

**What this changes:**
- Services no longer need to build, distribute, or maintain dedicated apps—just server endpoints
- Users no longer need a different app per service
- Secure cross-device authentication becomes accessible to any service, not just well-resourced ones

**Key mechanisms.** Browser-native UI is sandboxed from web page. The browser reports the page's origin to the server; the server decides whether to accept (enabling server-controlled phishing resistance). Session hijacking is prevented by public key sharing upon initialization. The QR code can be stolen by design; in case of multiple negotiations, the user is informed of a compromised environment, and the session is voided. The combination of multi-negotiation detection (can only continue in case of a single negotiation) and the pairing code (can only continue after the user's app has negotiated) prevents session fixation.

**Adoption.** Major browser vendors have structural incentives to resist this proposal—it commoditizes their platform lock-in. However, adoption does not require their initial cooperation. Browser extensions can provide the full security guarantees of native implementation. An ecosystem-driven path is viable: a trusted open-web organization publishes audited extensions for major browsers, credential managers (password managers, authenticators) add companion app support, and services implement the four endpoints. Once a working ecosystem demonstrates viability and user demand, browser vendors face pressure to implement natively—or regulatory bodies (such as the EU under eIDAS 2.0, or similar initiatives elsewhere) may mandate it. This creates an opportunity for any pro-open-web organization to become a lynchpin in breaking platform lock-in. The protocol complements passkeys rather than competing with them; the proof of concept uses passkeys for authentication.

**Properties:**
- **Phishing-resistant (server-controlled).** Browser reports the requesting origin; servers decide whether to accept. For same-origin services, attackers can only bind to their own origin.
- **Session hijacking prevention.** Public key cryptography ensures only the browser that initialized can complete—the private key never leaves the browser.
- **Over-the-shoulder protection (optional).** When the pairing code is enabled, an attacker who can see the user's screen can only void the ceremony, never hijack it or bind their own session to the user's browser.
- **Platform-neutral.** Any compliant browser, app, and service can participate. No vendor permission required.
- **Semantically agnostic.** Works for login, document signing, payments, device provisioning, file transfer, etc.
- **Flexible Security/UX tradeoff.** Optional user-entered code. Shape of code is specified by the service.
- **Same trust model.** Users already trust their browser, their authenticator app, and the services they use. This protocol extends those existing relationships rather than introducing new ones.

**Implementation.** Minimal for web pages (one API call). Moderate for browsers and companion apps. Server-side: four endpoints, short-lived state, single expiration deadline. Two proof-of-concept implementations are available: (1) authentication using passkeys, and (2) cross-origin file transfer with streaming. Both use the same browser extensions (Firefox and Chrome).

**Call to action.** This proposal seeks feedback on the protocol design, security model, and API shape. The author invites critique from security researchers, browser engineers, and identity specialists.

---

## 1. Problem Statement

Security breaches for users interacting with web services via a browser remain commonplace. Passwords remain weak. Phishing remains effective. Secure alternatives exist but are not universally available. This proposal addresses one piece of the puzzle: cross-device authentication.

Cross-device flows—logging in via a mobile app, signing a document with a key on your phone, authorizing a payment in a banking app—offer strong security because the authenticating device is separate from the potentially compromised browser. But deploying them securely today requires resources most organizations don't have.

### 1.1 The Current Landscape

Two paths exist for secure cross-device authentication, both with high barriers:

**Path 1: Platform vendor integration.** Solutions like FIDO2 hybrid transport and passkeys are secure and standardized. But they require the companion application to be sanctioned by browser vendors or operating systems. Apple, Google, and Microsoft control who may participate. Independent developers are excluded without explicit approval. This creates a gatekept ecosystem where only organizations with existing platform relationships can offer the most secure options.

**Path 2: Dedicated companion apps.** Large organizations (governments, enterprises) can bypass platform gatekeeping by building their own companion apps. The Dutch government's DigiD provides secure cross-device login for government services. These work well, but the cost is substantial:

- **Development:** Secure protocol design requires cryptographic expertise. Getting it wrong means session hijacking, credential theft, or worse.
- **Distribution:** The app must reach users through app stores, with all the approval processes and platform fees that entails.
- **Maintenance:** Ongoing security updates, OS compatibility, vulnerability response.
- **User support:** Help desks, documentation, troubleshooting.

Only large, well-resourced organizations can afford this. Smaller services cannot.

### 1.2 The Consequences

**For services:** Most cannot offer secure cross-device authentication. They either use insecure alternatives (manual code copy-paste, polling without binding) or offer no cross-device option at all.

**For users:** Those who use well-resourced services get strong security—but at the cost of installing, storing, learning, and maintaining a separate app for each service. Those who use smaller services get weaker security through no fault of their own.

The landscape is fragmented and uneven. Security depends on which services you use and how much they can spend.

### 1.3 What This Proposal Changes

This proposal decouples secure cross-device binding from dedicated apps. It provides standardized infrastructure that:

- **Removes gatekeeping.** Any service can participate. No platform vendor approval required.
- **Removes the app burden.** Services implement server endpoints, not apps. Users use one general-purpose companion app (a password manager, authenticator, or similar) for all services.
- **Solves the hard problems once.** The browser handles trusted UI, session binding, and cryptographic secret establishment. Services don't need cryptographic expertise—just four HTTPS endpoints.

The result: secure cross-device authentication becomes accessible to any service, and users get a consistent experience with a single companion app instead of app-per-service fragmentation.

This proposal is additive. Services that have invested in dedicated companion apps can continue using them. But services that implement the protocol's backend endpoints gain a new option: any compliant third-party app—a password manager, authenticator, or general-purpose companion app—will work.

### 1.4 What This Protocol Is

This protocol is a **secure binding layer**. It answers the question: "How can a browser session securely receive the result of an operation performed elsewhere?"

The protocol guarantees:

1. **Correct delivery.** The result reaches the browser session that initiated the request, not an attacker's session.
2. **User intent.** The user explicitly approved binding the result to this specific session.
3. **Attack prevention.** An attacker who observes the session identifier cannot hijack the ceremony.

### 1.5 What This Protocol Is Not

This protocol does **not** specify:

- How the user authenticates (if authentication is involved)
- What credentials or tokens look like
- What the companion application does internally
- The semantics of the operation being performed

Those are determined by the service and companion application. This protocol only provides the secure channel for delivering the result to the browser.

---

## 2. Design Goals

**Configurable security.** The protocol provides layered protection. At maximum security, a user following the protocol cannot have results misdirected to an attacker's session, even if the attacker controls the web page that initiates the request or observes the session initiation. Services may disable optional protections to reduce ceremony friction, accepting a well-defined reduction in security.

**Semantic agnosticism.** The protocol works identically regardless of what is being bound--login tokens, signatures, payment authorizations, or arbitrary data.

**Platform neutrality.** No party requires permission from browser vendors or operating system vendors. A compliant companion application needs only HTTPS and a user interface.

**Implementation accessibility.** The protocol should be implementable by any competent development team, not just organizations with dedicated security specialists. The hard cryptographic and protocol design problems are solved once (in the browser and protocol specification), leaving services with straightforward integration work.

**Simplicity.** The protocol should be easy to understand, implement, and analyze.

**Acceptable user experience.** The manual steps required should be comparable to existing cross-device flows that have demonstrated broad usability (e.g., DigiD in the Netherlands, WhatsApp Web linking). Services that need even smoother UX can disable optional protections.

---

## 3. Participants and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119].

**Web Page.** The service's in-browser code. Initiates the binding request. Untrusted--the protocol does not rely on the web page behaving correctly.

**User Agent.** The user's browser, specifically a native, sandboxed UI that the web page cannot manipulate. Generates ephemeral key pairs, initializes the ceremony with the service, displays trusted UI, and receives the bound result.

**Companion Application.** A native application on another device (or the same device). Receives session parameters out-of-band, facilitates whatever operation the user performs, and provides a pairing code for the user to enter. This may be a service-specific app (e.g., a bank's app) or a general-purpose third-party app (e.g., a password manager or authenticator). The companion application's internal behavior is outside the scope of this protocol.

**Service.** The backend that the companion application communicates with. Implements four endpoints, maintains short-lived binding state, and provides the result to the user agent upon successful binding.

Additional terminology:

**Binding.** The association between a browser session and the result of an out-of-band operation.

**Result.** Whatever the service provides upon successful binding--a token, a signature, binary data, or instructions to set cookies. The protocol is agnostic to the result's semantics.

**Session ID.** A cryptographically random identifier generated by the service that uniquely identifies a binding request. Generated during initialization and returned to the browser. Transmitted as base64url; the encoded form must not exceed 64 characters. UUIDv4 (22 characters when base64url encoded) is recommended.

**Ephemeral Key Pair.** A public/private key pair generated by the user agent for each ceremony. The public key is sent to the service during initialization; the private key never leaves the browser. At completion, the browser signs a message with the private key to prove ownership of the ceremony.

**Pairing Code.** A short code provided by the service after negotiation, displayed by the companion application, and entered by the user into the browser before completing. Optional; when enabled, protects against session fixation attacks by observation-only attackers. See Section 6 for detailed analysis.

---

## 4. Proposed API

### 4.1 Design Rationale

This API is intentionally minimal. It provides the binding mechanism; it does not interpret what is being bound. The API returns opaque data to the web page (or sets cookies), and the web page decides what that data means.

The API allows the web page to provide descriptive text for the trusted UI. This is safe--see Section 4.6.

### 4.2 WebIDL Definition

```webidl
partial interface Navigator {
  [SecureContext] readonly attribute OutOfBandBinding outOfBandBinding;
};

[Exposed=Window, SecureContext]
interface OutOfBandBinding {
  Promise<BindingResult> request(BindingRequest request, optional BindingOptions options = {});
};

dictionary BindingRequest {
  // Endpoint URLs: either relative paths (resolved against page origin) or full URLs
  // Each endpoint MUST NOT exceed 2048 characters
  required USVString handshakeEndpoint;   // Browser calls this to negotiate algorithm
  required USVString initializeEndpoint;  // Browser calls this to initialize ceremony
  required USVString negotiateEndpoint;   // App calls this to negotiate
  required USVString completeEndpoint;    // Browser calls this to retrieve result

  // Display information for trusted UI
  required DOMString displayName;           // Service name (max 64 characters)
  DOMString title;                          // Action title (max 128 characters)
  DOMString description;                    // Detailed instructions (max 1024 characters)

  // Completion handling
  BindingCompletionMode completionMode = "object";
  unsigned long timeoutSeconds = 120;       // 10-600 seconds inclusive
};

dictionary BindingOptions {
  // Optional callback for pre-negotiation (see Section 5.4)
  PreNegotiateCallback preNegotiate;
};

callback PreNegotiateCallback = Promise<undefined> (PreNegotiateSession session);

dictionary PreNegotiateSession {
  required DOMString sessionId;       // The session ID from initialization
  required USVString negotiateUrl;    // The resolved negotiate endpoint URL
};

enum BindingCompletionMode {
  "cookie",    // User agent sets cookies from response, then resolves
  "object",    // Promise resolves with JSON object
  "bytes",     // Promise resolves with ArrayBuffer
  "redirect"   // User agent navigates to service-specified URL
};

dictionary BindingResult {
  required BindingResultStatus status;
  any result;                               // Present for "object" mode on success
  ArrayBuffer bytes;                        // Present for "bytes" mode on success
  DOMString errorCode;                      // Machine-readable error code
  DOMString errorMessage;                   // Human-readable error description
};

enum BindingResultStatus {
  "success",
  "aborted",      // User cancelled, or fixation attack detected
  "timeout",      // Binding timed out
  "error"         // Other error (see errorCode)
};
```

**Endpoint URL handling.** Endpoints can be specified as either:
- **Relative paths** (e.g., `/bind/handshake`): The user agent resolves these against the page's origin
- **Full URLs** (e.g., `https://api.example.com/bind/handshake`): Used as-is

The user agent always includes the `requesting_origin` (the page's origin) in the handshake request. The server decides whether to accept the request based on its own policy. This allows:
- **Same-origin services**: Accept only when `requesting_origin` matches the service origin (phishing-resistant)
- **Subdomain services**: Accept requests from `*.example.com` for a service at `api.example.com`
- **Cross-origin services**: Accept requests from any origin (e.g., a generic file relay service)

Phishing resistance is server-controlled, not browser-enforced. A bank's authentication service can require exact origin match; a file transfer relay can accept any origin. The browser's job is to honestly report the requesting origin; the server makes all policy decisions.

**Cookie mode restriction.** When `completionMode` is `"cookie"`, all endpoints MUST resolve to the same origin as the page. The user agent MUST reject requests where cookie mode is specified but endpoints point to a different origin. Cookies cannot be set cross-origin. For cross-origin scenarios, use `"object"` or `"bytes"` mode instead

**Field limits.** The following limits apply to `BindingRequest` fields:

| Field | Limit |
|-------|-------|
| `handshakeEndpoint`, `initializeEndpoint`, `negotiateEndpoint`, `completeEndpoint` | Max 2048 characters each |
| `displayName` | Max 64 characters |
| `title` | Max 128 characters |
| `description` | Max 1024 characters |
| `timeoutSeconds` | 10-600 inclusive |

User agents MUST reject requests that exceed these limits.

### 4.3 Example Usage

```javascript
// Login example - server enables pairing code via handshake response
const result = await navigator.outOfBandBinding.request({
  handshakeEndpoint: '/bind/handshake',
  initializeEndpoint: '/bind/initialize',
  negotiateEndpoint: '/bind/negotiate',
  completeEndpoint: '/bind/complete',

  displayName: 'Acme Corp',
  title: 'Sign in to Acme Corp',
  description: 'Open the Acme app on your phone and scan this code. ' +
               'Enter the code shown in the app to complete sign-in.',

  completionMode: 'cookie',
  timeoutSeconds: 90
});

if (result.status === 'success') {
  window.location.href = '/dashboard';
}
```

```javascript
// Streamlined UX example - server disables pairing code (reduced security)
// Use when: session fixation is detectable/low-impact (e.g., identity-binding where
// users see their name), or when the service accepts the risk of fixation attacks.
// The server's handshake response includes: pairing_code_specification: {type: "disabled"}
const result = await navigator.outOfBandBinding.request({
  handshakeEndpoint: '/bind/handshake',
  initializeEndpoint: '/bind/initialize',
  negotiateEndpoint: '/bind/negotiate',
  completeEndpoint: '/bind/complete',

  displayName: 'QuickService',
  title: 'Sign in to QuickService',
  description: 'Scan this code with the QuickService app to sign in.',

  completionMode: 'cookie',
  timeoutSeconds: 60
});
```

```javascript
// Pre-negotiation example - page establishes state before pairing UI appears
// Use when: the page needs to negotiate with the server before the app can proceed.
// Example: file transfer where the receiver must register a download key.
const result = await navigator.outOfBandBinding.request({
  handshakeEndpoint: `${RELAY_URL}/bind/handshake`,
  initializeEndpoint: `${RELAY_URL}/bind/initialize`,
  negotiateEndpoint: `${RELAY_URL}/bind/negotiate`,
  completeEndpoint: `${RELAY_URL}/bind/complete`,

  displayName: 'File Transfer',
  title: 'Receive file',
  description: 'Enter the code shown in the app to receive the file.',

  completionMode: 'object',
  timeoutSeconds: 120
}, {
  preNegotiate: async (session) => {
    // Step 1: Negotiate algorithm with server
    const offerRes = await fetch(`${RELAY_URL}/pre-negotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.sessionId,
        step: 'offer',
        algorithms: ['Ed25519']
      })
    });
    const { algorithm } = await offerRes.json();

    // Step 2: Generate keypair and register public key
    const keyPair = await crypto.subtle.generateKey(
      { name: algorithm }, false, ['sign', 'verify']
    );
    const publicKeyB64 = btoa(String.fromCharCode(
      ...new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
    ));

    await fetch(`${RELAY_URL}/pre-negotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.sessionId,
        step: 'register',
        algorithm: algorithm,
        publicKey: publicKeyB64
      })
    });

    // Store keypair for later use (download authentication)
    downloadKeyPair = keyPair;
  }
});
```

### 4.4 User Agent UI Requirements

When `request()` is called, the user agent MUST first perform the handshake (see Section 5.2) and initialize the ceremony with the service (see Section 5.3). If a `preNegotiate` callback is provided, the user agent MUST invoke it and wait for completion before proceeding (see Section 5.4). The user agent then displays a trusted, modal UI containing:

1. **Origin** (mandatory, user agent-verified): The full origin of the requesting page, prominently displayed. This is the only information the user agent can verify.

2. **Display name** (service-provided): Shown with clear indication it is unverified, e.g., displayed as a claim: `"Acme Corp" (claimed by https://acme.example.com)`

3. **Title** (service-provided, optional): A brief description of the action.

4. **Description** (service-provided, optional): Instructional text explaining what the user should do.

5. **Transfer mechanism**: A means to transfer session parameters to the companion application (see Section 4.5).

6. **Status indicator**: Current phase of the binding process.

7. **Pairing code input** (conditional): If the service enabled the pairing code, displays an input field. The user enters the code shown by the companion app.

8. **Cancel button**: Always available.

The user agent MUST clearly distinguish between verified information (origin) and unverified information (display name, title, description).

### 4.5 Transfer Mechanisms

The user agent must provide a way for the user to transfer session parameters (endpoint URL, session ID, display name) to the companion application. This proposal does not mandate a specific mechanism; implementations should support multiple options for flexibility and accessibility.

**QR Code** is expected to be the primary mechanism for cross-device binding. The user agent displays a QR code; the companion application scans it with a camera. This is familiar, requires no pairing, and works across platforms.

Other mechanisms user agents MAY support:

| Mechanism | Characteristics |
|-----------|-----------------|
| **NFC** | Requires physical proximity. User taps phone to NFC-enabled device. Good for kiosk scenarios. |
| **Bluetooth** | Requires proximity and discovery. More complex setup but enables hands-free scenarios. |
| **USB** | Wired connection. Useful when devices are physically connected (e.g., phone tethered to computer). |
| **Ultrasonic audio** | Acoustic data transfer. Works without camera or physical contact; may have reliability issues. |
| **Manual code entry** | User reads a short code from the browser and types it into the companion app. Essential for accessibility (screen readers, users who cannot use cameras). |
| **Copy-paste / Deep links** | For same-device scenarios. User copies a link or the browser invokes a registered URL handler. |

User agents SHOULD provide at least one visual mechanism (QR code) and one non-visual mechanism (manual code entry) to ensure accessibility.

#### 4.5.1 Transfer Payload Format

To ensure interoperability between any compliant companion application and any compliant service, this specification mandates a baseline JSON format for transfer payloads:

```json
{
  "version": 1,
  "url": "https://example.com/bind/negotiate",
  "session_id": "vK9xQ2mN7pR4wY6zA3bC8dE",
  "name": "Example Service"
}
```

**Field definitions and bounds:**

| Field | Required | Max Length | Description |
|-------|----------|------------|-------------|
| `version` | Yes | N/A | Protocol version. MUST be `1` for this specification. |
| `url` | Yes | 512 chars | Full negotiate endpoint URL (origin + path). |
| `session_id` | Yes | 64 chars | The session identifier from initialization (base64url encoded). |
| `name` | Yes | 64 chars | Service display name. If the companion app does not recognize the URL, it MUST display this name along with an indication that the service is unknown. |

**Total payload limit:** The entire JSON transfer payload (including all field names, values, and JSON syntax) MUST NOT exceed 300 bytes when encoded as UTF-8. This ensures reliable scanning with QR code Version 10-12 at error correction level M.

#### 4.5.2 QR Code Capacity

Typical transfer payloads (110-150 bytes) fit comfortably in Version 5-10 QR codes. Even enterprise-scale URLs with maximum-length session IDs (~200 bytes) fit within Version 10. A Version 10 QR code (57×57 modules) displayed at 4 pixels per module requires only 228×228 pixels—easily accommodated in browser UI and scannable by modern smartphone cameras.

**Conclusion:** QR capacity is not a practical constraint for this protocol. See Appendix F for detailed capacity analysis.

### 4.6 Safety of Service-Provided Text

The web page provides the `displayName`, `title`, and `description` shown in the trusted UI. This might seem dangerous--what if a malicious page provides misleading text?

**This is safe because of server-controlled phishing resistance.**

Consider a malicious page at `https://evil.com` that displays:

- displayName: "Your Bank"
- title: "Sign in to Your Bank"
- description: "Scan with Your Bank app to sign in."

The user agent displays this text, but also prominently shows the verified origin: `https://evil.com`. When the browser sends the handshake request, it includes `requesting_origin: "https://evil.com"`.

**If evil.com tries to use the bank's endpoints:** The bank's server receives the handshake with `requesting_origin: "https://evil.com"`. If the bank implements origin checking (which any phishing-sensitive service should), it rejects the request. The ceremony fails.

**If evil.com uses its own endpoints:** The companion app shows `https://evil.com` as the requesting origin. Any operations happen against evil.com's service. Evil.com receives only what it provides itself—not bank credentials.

**The blast radius of deceptive text is confined to what the server allows.** For phishing-sensitive services (banks, authentication providers), origin checking rejects cross-origin requests. For cross-origin services (file relays), the requesting origin is displayed but not restricted—phishing protection is not relevant for these use cases.

This is the same trust model as existing web content: a page can display any text it wants, including fake bank logos. The browser doesn't prevent this because it can't know what's a legitimate cross-origin service vs. a phishing attempt. The server makes that determination based on its origin policy.

---

## 5. Protocol Flow

### 5.1 Overview

The diagram below shows the full ceremony with the pairing code enabled. When the code is disabled, the corresponding steps are skipped (see Section 5.9 for variations).

```
┌──────────┐   ┌────────────┐   ┌─────────────┐   ┌─────────┐
│ Web Page │   │ User Agent │   │ Companion   │   │ Service │
│          │   │            │   │ Application │   │         │
└────┬─────┘   └─────┬──────┘   └──────┬──────┘   └────┬────┘
     │               │                 │               │
     │ request()     │                 │               │
     ├──────────────>│                 │               │
     │               │                 │               │
     │               │   Handshake (algorithms)        │
     │               ├────────────────────────────────>│
     │               │   algorithm, pairing_code_spec   │
     │               │<────────────────────────────────┤
     │               │                 │               │
     │               │ [Generate ephemeral key pair    │
     │               │  using agreed algorithm]        │
     │               │                 │               │
     │               │   Initialize (public_key)       │
     │               ├────────────────────────────────>│
     │               │      session_id                 │
     │               │<────────────────────────────────┤
     │               │                 │               │
     │               │ ─ ─ Display trusted UI ─ ─ ─ ─ ─│
     │               │   (QR + pairing code input*)
     │               │                 │               │
     │               │   Transfer      │               │
     │               │ · · · · · · · · >               │
     │               │  (QR, NFC, etc.)│               │
     │               │                 │               │
     │               │                 │   Negotiate   │
     │               │                 ├──────────────>│
     │               │                 │               │
     │               │                 │  [Operation   │
     │               │                 │   happens]    │
     │               │                 │               │
     │               │                 │  pairing_code*│
     │               │                 │<──────────────┤
     │               │                 │               │
     │               │ ─ App shows pairing code*─ ─│
     │               │                 │               │
     │               │   User enters pairing code* │
     │               │                 │               │
     │               │   Complete (session_id,         │
     │               │    signature, pairing_code*)    │
     │               ├────────────────────────────────>│
     │               │         result                  │
     │               │<────────────────────────────────┤
     │               │                 │               │
     │   result      │                 │               │
     │<──────────────┤                 │               │

* = optional, service-configurable

Note: Pre-negotiation (Phase 3), if used, occurs between Initialize and Display trusted UI.
The page's preNegotiate callback runs during this window; the browser waits for it to complete.
```

### 5.2 Phase 1: Handshake

Before generating keys or initializing a session, the browser and server must agree on a signature algorithm and the server must accept the requesting origin. The web page calls `navigator.outOfBandBinding.request()`. The user agent:

1. Resolves the handshake endpoint URL (relative paths are resolved against the page's origin; full URLs are used as-is)
2. Sends a handshake request containing:
   - The `requesting_origin`: the page's origin (e.g., `https://example.com`)
   - The algorithms the browser supports (up to 16 algorithm names, each at most 16 characters)
3. Receives either:
   - **Accepted:** The server accepts the requesting origin and chose an algorithm from the browser's list, along with the pairing code configuration
   - **Rejected:** The server does not accept the requesting origin, or does not support any of the browser's offered algorithms

If rejected, the user agent MUST display an error to the user. The ceremony terminates.

If accepted, the user agent proceeds to initialization using the agreed algorithm.

**Origin policy is server-controlled.** The server decides whether to accept requests from the given `requesting_origin`. A same-origin authentication service might require exact match. A service on `api.example.com` might accept requests from `*.example.com`. A cross-origin file relay service might accept any origin. The browser honestly reports the origin; the server makes the policy decision.

**Handshake request/response:**

The service, upon receiving a handshake request:

1. Examines the `requesting_origin` and applies its origin policy (reject if not acceptable)
2. Examines the list of algorithms offered by the browser
3. Selects an algorithm it supports (server's choice)
4. Returns the selected algorithm and pairing code configuration

**Algorithm recommendations:** Implementations SHOULD support `ES256` (ECDSA P-256) and `Ed25519` to maximize interoperability. These algorithms are widely supported by WebCrypto implementations and provide strong security with reasonable performance.

### 5.3 Phase 2: Initialization

The user agent, having completed the handshake:

1. Generates an ephemeral key pair using the algorithm agreed during handshake
2. Resolves the initialize endpoint URL (relative paths resolved against page origin; full URLs used as-is)
3. Sends an initialization request to the initialize endpoint with the public key
4. Receives the session ID from the service
5. Only after successful initialization, displays trusted UI with:
   - Transfer mechanism(s) providing the negotiate endpoint URL, session ID, and display name
   - **Pairing code input field** (if the service enabled the pairing code during handshake; otherwise skipped)

**Initialization request/response:**

The service, upon receiving an initialization request:

1. Generates a cryptographically random session ID (UUIDv4 recommended; see Section 11.2)
2. Stores `{session_id, public_key, algorithm, expires_at}`
3. Returns the session ID to the browser

**Critical:** The private key never leaves the browser. At completion, the browser will sign a message with the private key to prove it is the same browser that initialized the ceremony. An attacker who observes the session ID (e.g., via the QR code) cannot complete the ceremony—they lack the private key.

### 5.4 Phase 3: Pre-negotiation (Optional)

After initialization but before displaying the trusted UI, the page may perform arbitrary protocol exchanges with the service. This is the pre-negotiation phase. It mirrors the negotiation phase but operates between the page and the server (rather than between the app and the server).

**Purpose:** Some use cases require the page to establish state with the service before the app can negotiate. For example, in a live file transfer protocol built on top of OOB binding, the receiver page may need to:
1. Negotiate which cryptographic algorithms are available for the download
2. Register a download public key with the service

The pre-negotiation phase enables these multi-round-trip protocols without requiring the browser to understand them. The browser simply waits for the page to signal completion before showing the pairing UI.

**Symmetry with negotiation:** Pre-negotiation allows arbitrary page↔server exchanges; negotiation allows arbitrary app↔server exchanges. Together, they provide full flexibility for protocols built on top of OOB binding:

| Phase | Parties | Purpose |
|-------|---------|---------|
| Pre-negotiation | Page ↔ Server | Page establishes state before pairing UI appears |
| Negotiation | App ↔ Server | App performs the out-of-band operation |

**Why no browser→app channel?** The protocol provides page↔server exchanges (pre-negotiation) and app↔server exchanges (negotiation), but no direct browser→app communication channel. Real-world use-case exploration hasn't revealed a need for this. If such a need arose, data would have to be included in the QR code (e.g., as a "clientData" field). This approach is severely limited: QR data is visible to observation-only attackers, so it cannot carry secrets or sensitive information that the app shouldn't share with potential attackers. Any browser→app data would need to be treated as potentially attacker-controlled by the app.

**How it works:**

1. The page calls `navigator.outOfBandBinding.request()` with a `preNegotiate` callback in the options
2. The browser performs handshake and initialization as normal
3. Before displaying the trusted UI, the browser invokes the page's `preNegotiate` callback with the session info
4. The page performs its protocol with the service (any number of HTTP requests)
5. The callback completes (or throws an error)
6. If successful, the browser displays the trusted UI and the ceremony proceeds normally
7. If the callback throws, the ceremony is aborted

**Service state transition:** The service MAY track a `PRE-NEGOTIATED` state to enforce that pre-negotiation occurred before accepting a negotiate request. This is optional—services that don't require pre-negotiation simply ignore this state.

**Security considerations:**

- The page's pre-negotiation code runs in the page context, not the extension. It has access to the session ID but not the private key—the security binding established at initialization cannot be altered by pre-negotiation.
- The page can make arbitrary HTTP requests to the service during pre-negotiation. The browser does not interpret these—it simply waits for completion.

**Server requirements during pre-negotiation:**

- The server SHOULD validate that pre-negotiation requests are appropriate for the current session state.
- The server SHOULD NOT allow pre-negotiation to modify the public key binding established at initialization.
- The server SHOULD enforce state transitions (e.g., require `initialized` state before accepting pre-negotiation requests, transition to `pre-negotiated` upon completion).
- The server SHOULD NOT expose sensitive ceremony information beyond what the page legitimately requires for its protocol.

A proof-of-concept demonstrating pre-negotiation for live file transfer is available; see Section 10.6 and Appendix E for details.

### 5.5 Phase 4: Out-of-Band Operation (Negotiation)

The user transfers the session parameters to the companion application via their chosen mechanism.

The companion application:

1. Displays the origin and operation details
2. Requests user confirmation to proceed
3. Contacts the service's negotiate endpoint with the session ID
4. Performs whatever operation is appropriate--this is outside the protocol's scope
5. Upon completion, receives from the service:
   - A **pairing code** (if enabled by service; user must enter this into the browser)

The service, upon receiving a negotiate request:

1. Checks whether a successful negotiation has already occurred for this session (see Section 5.7)
2. **If this is the first successful negotiation:**
   - Performs the requested operation
   - If pairing code is enabled: generates a pairing code using the configured characters and length
   - Stages the result: stores `{session_id, result_data, [pairing_code], negotiated: true}`
   - Marks the session as `COMPROMISED` if any prior negotiation attempts occurred
   - Returns success with the pairing code (if enabled)
3. **If a successful negotiation already exists:**
   - Marks the session as `COMPROMISED`
   - Returns a "compromised" response with no pairing code
   - The companion application MUST inform the user their environment is compromised and they cannot complete the flow

Failed operations (e.g., authentication failure) do not change ceremony state or trigger compromise detection. An attacker who races to call the negotiate endpoint with invalid credentials simply fails; the ceremony is unaffected.

If pairing code is enabled and negotiation succeeded, the companion application displays it for the user to enter into the browser.

### 5.6 Phase 5: Completion

**If pairing code is enabled:** The user reads the pairing code from the companion application and enters it into the browser's trusted UI. The browser then sends a complete request to the complete endpoint with:

- The session ID
- A signature over `session_id || pairing_code || timestamp` using the private key
- The pairing code
- The timestamp

**If pairing code is disabled:** The browser polls the complete endpoint, signing `session_id || timestamp` with each request.

The service validates:

1. The session ID exists and has not expired
2. The signature is valid for the stored public key
3. A negotiation has occurred (result is staged)
4. If pairing code is enabled: the pairing code matches

**Outcomes:**

- **Signature invalid:** Respond with error—this browser does not hold the private key
- **No negotiation yet:** Respond with "pending"
- **Pairing code invalid:** Respond with "invalid_code" error
- **All valid:** Return the staged result

**Why public key cryptography prevents session hijacking:**

An attacker who observes the QR code learns the session ID and negotiate endpoint, but cannot forge a valid signature. The private key exists only in the browser that initialized the ceremony—it was never transmitted, not even to the server. Without the private key, the attacker cannot complete the ceremony.

This is unconditional protection with defense-in-depth properties:
- **No shared secret:** The private key never travels over any network
- **TLS compromise resistant:** Even if TLS is broken during initialization, only the public key is exposed (useless to attacker)
- **Server breach resistant:** The server stores only public keys; a database breach reveals nothing useful for completing ceremonies

### 5.7 State Machine (Server-side)

The server maintains the following states for each session:

**Note on handshake:** The handshake phase (Phase 1) is stateless—it does not create server-side session state. The browser sends its supported algorithms, and the server responds with its selection and pairing code configuration. No session_id exists yet; no state is persisted. The server remembers nothing from the handshake. Session state is created only when the browser calls the initialize endpoint, which includes the public key (implicitly specifying the agreed algorithm). The server stores the algorithm alongside the public key at initialization time.

```
                         ┌───────────────────────────────────────────────────────────┐
                         │                    (all states)                           │
                         │                        │                                  │
                         │              timeout/expiration                           │
                         │                        │                                  │
                         │                        ▼                                  │
                         │                  ┌──────────┐                             │
                         │                  │ EXPIRED  │                             │
                         │                  └──────────┘                             │
                         └───────────────────────────────────────────────────────────┘

                                        pre-negotiate                negotiate
┌─────────┐  initialize  ┌─────────────┐  (optional)  ┌────────────────┐ (success) ┌────────────┐
│  EMPTY  │────────────>│ INITIALIZED │─────────────>│ PRE-NEGOTIATED │──────────>│ NEGOTIATED │
└─────────┘  (success)  └─────────────┘   (success)  └────────────────┘           └─────┬──────┘
                               │                                                        │
                               │ negotiate (if no pre-negotiation required)             │ complete
                               └───────────────────────────────────────────────────────>│ (valid signature
                                                                                        │  + code*)
                                                                                        ▼
                                                                                  ┌───────────┐
                                                                                  │ COMPLETED │
                                                                                  └───────────┘

* pairing code validation only if enabled
```

**State descriptions:**

| State | Meaning |
|-------|---------|
| EMPTY | No session exists for this session_id |
| INITIALIZED | Browser initialized with public_key; session_id issued; awaiting pre-negotiation or app negotiation |
| PRE-NEGOTIATED | Page completed pre-negotiation with server; awaiting app negotiation (optional state) |
| NEGOTIATED | App completed operation; result staged (and pairing_code if enabled); awaiting browser completion |
| COMPLETED | Browser retrieved result with valid signature (and pairing_code if enabled); cleanup performed |
| EXPIRED | Timeout reached; state discarded |

**Note on PRE-NEGOTIATED:** This state is optional. Services that don't require pre-negotiation may transition directly from INITIALIZED to NEGOTIATED. Services that require pre-negotiation (e.g., file transfer services that need to register a download key) enforce that the session must be in PRE-NEGOTIATED state before accepting a negotiate request.

**Compromise detection state machine:**

Independent of the ceremony state, each session tracks whether the environment has been detected as compromised:

```
┌───────────────┐   second negotiate    ┌──────────────┐
│ UNCOMPROMISED │─────────────────────>│  COMPROMISED │
└───────────────┘       attempt         └──────────────┘
```

A session transitions to `COMPROMISED` when:
- A negotiate request arrives after a successful negotiation already exists, OR
- A negotiate request succeeds but prior (failed or successful) negotiate attempts were detected

Once `COMPROMISED`, the session remains compromised. The compromise flag is included in:
- The negotiate response (for subsequent negotiators who cannot complete)
- The complete response (for the first negotiator who can complete but should be warned)

### 5.8 Multi-Negotiation Detection

The server MUST detect when multiple negotiations are attempted for the same session. This detection serves two purposes:

1. **Prevent DoS attacks:** If a user negotiates first, an attacker's subsequent negotiation attempt cannot disrupt the user's flow.
2. **Warn of compromised environments:** When multiple negotiations are detected, all parties are informed that the session identifier was likely observed by an attacker.

**Behavior specification:**

- **First successful negotiation:** Proceeds normally. The app receives success and a pairing code (if enabled). The flow can complete.
- **Subsequent negotiation attempts:** The server returns a "compromised" response with no pairing code. The app MUST inform the user that their environment is compromised and they cannot complete the flow—they should close the browser-native UI.
- **First negotiator's completion:** If the session was marked `COMPROMISED` (due to subsequent negotiation attempts), the complete response includes a `compromised` field. The browser MUST inform the user that the flow completed successfully and safely, but their environment appears to be compromised.

**Why this is safe:**

The flow remains secure regardless of who negotiates first:

- **If user negotiates first:** User completes safely. Attacker's subsequent attempt fails (no code). If attacker tried, user sees "compromised" warning on completion.
- **If attacker negotiates first:** Attacker gets a code but cannot type it (observation-only). User's subsequent attempt gets "compromised" response and is told to abort. Attacker's code becomes useless.

The server cannot distinguish attacker from user—it simply enforces "first negotiator proceeds, others are blocked and warned."

### 5.9 Security Mode Variations

Services choose their position on the security/UX spectrum by enabling or disabling the pairing code:

| Mode | Pairing code | User steps | Protection                              |
|------|---------------------|------------|-----------------------------------------|
| **Full** | Enabled | QR scan, enter code | hijacking, fixation                     |
| **Minimal** | Disabled | QR scan only | hijacking only                          |

**When to use each mode:**

- **Full:** High-value operations (admin access, sensitive account changes), environments that may be compromised (public terminals, screen-sharing), or any scenario where session fixation must be prevented rather than merely detected.
- **Minimal:** Low-value operations, controlled environments where screen observation is unlikely, or when other mitigations exist (e.g., explicit "you are now logged in as X" confirmation screens that make fixation immediately detectable).

Both modes retain unconditional session hijacking protection via the signature mechanism. The pairing code adds protection against session fixation by observation-only attackers.

---

## 6. The Pairing Code

The pairing code is an optional security feature that prevents session fixation attacks. When enabled, it provides strong protection against attackers who can observe the user's browser screen. When disabled, the ceremony is shorter but vulnerable to session fixation. This section explains the attack it prevents, how it works, and when services might choose to disable it.

### 6.1 The Attack: Session Fixation via QR Observation

Consider an attacker who can observe the user's browser screen (shoulder-surfing, screen-sharing, camera observation). The attacker sees the QR code. Without the pairing code, this attack succeeds:

1. User's browser initializes ceremony, displays QR code (attacker observes it)
2. Attacker's app scans the QR code and **negotiates as the attacker** (e.g., logs in with attacker's credentials)
3. User hasn't scanned yet—attacker is first
4. User's browser (polling or waiting) sees negotiation complete
5. User's browser completes the ceremony with a valid signature
6. User's browser receives **the attacker's session/result**

The user is now logged in as the attacker. This is a session fixation / login CSRF attack. The attacker didn't steal the user's session—they *gave* the user their own session. Depending on the service, this enables:
- The attacker sees everything the user does (if the attacker can monitor their own account)
- The user's sensitive actions are attributed to the attacker's account
- Financial transfers go to the attacker's account

**Why the signature doesn't prevent this:**

The signature prevents session *hijacking* (attacker trying to receive the user's result). But in session *fixation*, the attacker doesn't try to receive anything—they provide a result (their own session) for the user to receive. The user's browser has the valid private key, so it successfully signs and completes—but receives the attacker's result.

### 6.2 The Solution: Pairing Code

The pairing code binds the user's app to the completion. Only the app that negotiated can provide the code that allows completion.

**The flow with pairing code:**

1. User's browser initializes ceremony, displays QR code **and a pairing code input field**
2. User's app scans QR code, negotiates with service
3. Service returns `pairing_code` to the app (e.g., "K7M2")
4. User reads pairing code from app, enters it into browser
5. Browser sends complete request **including the pairing code**
6. Service validates: does the pairing code match the negotiated session?
7. If valid, browser receives result

**Why this defeats the attack:**

If the attacker negotiates first:
- Attacker's app receives pairing code "ABC"
- User's app attempts to negotiate—receives "compromised" response with no pairing code
- User's app MUST warn the user: environment is compromised, cannot complete this flow
- User does not have a pairing code to enter; the ceremony cannot proceed
- The attacker has "ABC" but cannot type it into the user's browser (keyboard access required)

If the attacker negotiates and user hasn't scanned yet:
- Attacker's app receives pairing code "ABC"
- User's browser is waiting for pairing code input
- For the attack to succeed, the attacker must enter "ABC" into the user's browser
- But if the attacker can type into the user's browser, all security is already lost

**The critical insight:** An attacker who can only *observe* the user's screen cannot enter the pairing code. They'd need to type on the user's keyboard. If they can do that, they can directly manipulate any authentication mechanism.

**Security guarantee:** If the user enters a pairing code *after* their app has received one, the protocol is unconditionally safe—regardless of what attackers have done. This holds even if the user mistypes the code; an incorrect entry simply fails validation and the user can retry. The browser MAY send multiple complete requests to allow for typos; incorrect codes do not invalidate the ceremony.

**Two-barrier defense model:** The pairing code provides two independent barriers against attack:

1. **Friction barrier (primary):** Users do not enter codes before their app displays one—there's nothing to enter. The code input field requires deliberate action, and a multi-character code creates sufficient friction that speculative typing is unnatural. This behavioral barrier should be validated by UX research, but it represents the expected user flow.

2. **Probability barrier (secondary):** Even if the friction barrier fails—the user somehow enters a code before their app negotiates—they would need to guess the attacker's code by chance. With a 4-character alphanumeric code (36^4 ≈ 1.7 million possibilities), this probability is negligible. This serves as a fail-safe; its adequacy should be validated by security analysis based on the service's risk tolerance.

The security argument does *not* depend on timing analysis of the "attack window." Timing varies unpredictably by user and context. Instead, security rests on the friction barrier making premature entry unlikely, with the probability barrier providing defense-in-depth for the rare case where friction fails.

### 6.3 Pairing Code Specification

The service controls the pairing code format via the handshake endpoint response. The `pairing_code_specification` field is **required** and uses a tagged union to make the choice explicit:

**Enabled:**
```json
{
  "type": "accepted",
  "algorithm": "ES256",
  "pairing_code_specification": {
    "type": "enabled",
    "characters": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    "length": 4
  }
}
```

**Disabled:**
```json
{
  "type": "accepted",
  "algorithm": "ES256",
  "pairing_code_specification": {
    "type": "disabled"
  }
}
```

If the `pairing_code_specification` field is missing from an accepted handshake response, the browser rejects the response as malformed. This explicit design prevents accidental security degradation from forgetting to include the field.

**Specification fields (when `type` is `"enabled"`):**

- **characters:** Array of allowed characters. MUST contain 1-256 elements. Each element MUST be a single Unicode code point (not a multi-character string). Works with any script (Latin, Cyrillic, CJK, etc.).
- **length:** Number of characters. MUST be 1-6 inclusive.

**Choosing appropriate characters:**

The server should choose characters that the user can comfortably type. Two sources of information are available:

1. **`Accept-Language` header:** Per RFC 7231, browsers send this header with every HTTP request, indicating the user's language preferences. The handshake request includes it.

2. **`input_hints` field:** The browser MAY include an `input_hints` object in the handshake request body, containing a `keyboard_layout` field if the browser can determine the active keyboard layout.

Servers should consider these hints when selecting characters. For example, a Japanese user (`Accept-Language: ja`) might be better served with digits or hiragana rather than Latin letters. Western Arabic numerals (`0-9`) are widely accessible across keyboards but not truly universal—Arabic, Persian, Hindi, Thai, and other scripts have their own numeral systems. Servers should use `Accept-Language` and `input_hints` to make informed choices.

**Recommendations:**
- Use alphanumeric characters for higher entropy per character
- Use 3-4 characters for typical operations
- Longer codes for higher-value operations
- Consider `Accept-Language` and `input_hints` for character selection

### 6.4 Timing and Attack Detection

The attack can be detected at different points depending on timing:

**Scenario 1: User negotiates first, attacker negotiates second**
- User's app negotiates → success, receives pairing code
- Attacker's app negotiates → multi-negotiation detected
- Attacker's app receives warning or different code
- User's ceremony continues with their own code

**Scenario 2: Attacker negotiates first, user negotiates second**
- Attacker's app negotiates → success, receives pairing code
- User's app negotiates → multi-negotiation detected
- User's app receives warning: "Another device attempted this operation. Your environment may be compromised."
- User can abort and investigate

**Scenario 3: Attacker negotiates, user never scans**
- Attacker's app negotiates → success
- User's browser waits for pairing code input
- Attacker cannot proceed without typing into user's browser
- Eventually: timeout

In all scenarios, the attack either fails or is detected. The user or attacker learns something went wrong; the attacker cannot successfully bind their session to the user's browser.

### 6.5 Boundary Condition: Attacker Keyboard Access

If an attacker can enter the pairing code into the user's browser (physical keyboard access, remote desktop, malware with input injection), then the pairing code provides no protection. The attacker can:

1. Observe QR code
2. Negotiate as attacker
3. Enter their pairing code into user's browser
4. Complete the attack

However, **if an attacker can type into the user's browser, all security guarantees collapse regardless of this protocol.** Such an attacker can:
- Fill in password fields
- Click "approve" buttons
- Navigate to any page
- Intercept any authentication mechanism

The pairing code protects against *observation-only* attackers (shoulder-surfing, screen capture, camera surveillance). Attackers with input access require physical security measures, not protocol defenses.

### 6.6 When to Disable the Pairing Code

The pairing code is optional. Services may disable it to reduce ceremony friction, but should understand the security implications:

**Why the signature alone doesn't prevent session fixation:**

The signature proves the browser initialized the ceremony, but doesn't prove which app negotiated. Without pairing code, when an attacker negotiates first:
1. Browser initializes, displays QR
2. Attacker scans, negotiates as attacker → result staged (attacker's session)
3. User hasn't scanned yet
4. Browser polls/waits for negotiation to complete → sees it's done
5. Browser completes with valid signature
6. Server returns staged result (attacker's session) to browser
7. User is logged in as attacker → session fixation succeeds

**Without the pairing code, session fixation attacks are possible.** An attacker who observes the QR code can negotiate first (as themselves), and the user's browser will receive the attacker's result.

Disabling the pairing code may be acceptable when:

1. **The operation is low-value.** For operations where session fixation risk is tolerable (e.g., linking a low-privilege device, anonymous sessions), the UX benefit may outweigh the security cost.

2. **Session fixation is mitigated by other means.** Some services may have account-level protections (e.g., new device notifications, session anomaly detection, explicit "you are now logged in as X" confirmation screens) that limit the impact or detectability of session fixation.

3. **The environment is controlled.** If users only access the service from trusted environments where screen observation is unlikely (e.g., private offices, controlled enterprise settings), the risk is reduced.

**Trade-off summary:** Disabling the pairing code removes one user step but makes the protocol vulnerable to session fixation attacks by observation-only attackers. Services must evaluate this trade-off based on their threat model and the value of the operations being bound.

---

## 7. Security Analysis

### 7.1 Threat Model

**Threats addressed:**

- **Malicious web page:** Attacker controls the initiating page and can execute arbitrary JavaScript
- **Session observer:** Attacker can observe the transfer payload (shoulder-surfing the QR code, intercepting NFC, etc.)
- **Racing attacker:** Attacker attempts to negotiate before the legitimate user
- **Deceptive content:** Attacker provides misleading display text
- **Session fixation:** Attacker negotiates as themselves before the user scans

**Threats NOT addressed:**

- Compromised user agent or companion application
- Compromised service
- Network attacker who can break TLS
- Physical compromise of user's devices
- Attacker with keyboard access to user's browser

### 7.2 Binding Integrity

The user agent always includes the true `requesting_origin` (the page's origin) in the handshake request. For relative endpoint paths, the browser resolves them against the page origin. For full URLs, the browser uses them as-is but still reports the requesting origin. The server sees both the requesting origin and the endpoint origin, and can make policy decisions accordingly.

### 7.3 Phishing Resistance

Phishing resistance is server-controlled. The server decides whether to accept requests based on the `requesting_origin` reported by the browser:

1. **Same-origin services** (e.g., bank login): Require `requesting_origin` to match the service origin. A phishing page at `evil.com` cannot use `bank.com`'s endpoints because the bank's server will reject the mismatched origin.

2. **Subdomain services** (e.g., `api.example.com`): Accept requests where `requesting_origin` is within an allowed domain pattern (e.g., `*.example.com`).

3. **Cross-origin services** (e.g., file relay): Accept any `requesting_origin`. Phishing resistance is not relevant for these use cases.

The browser's job is to honestly report the requesting origin. The server makes all policy decisions. This model allows the same protocol to serve both phishing-sensitive use cases (authentication) and phishing-irrelevant use cases (file transfer) without compromising either.

For same-origin services, a phishing page can only "phish" itself—the attacker receives only results from their own origin. This is the same security model as the web itself.

### 7.4 Session Hijacking Prevention

**Scenario:** Attacker observes the transfer payload and attempts to receive the result intended for the user.

The attacker learns the session ID from the QR code, but **does not have the private key**. The private key was generated in the browser and never transmitted—not even to the server. The server only has the public key from initialization.

When the attacker's browser attempts to complete the ceremony:
- It must provide a valid signature
- The attacker cannot produce a valid signature without the private key
- The server rejects the completion request

This is unconditional protection with defense-in-depth properties:

- **No shared secret:** The private key never travels over any network, not even encrypted by TLS
- **TLS compromise resistant:** Even if an attacker breaks TLS during initialization, they only see the public key (useless for forging signatures)
- **Server breach resistant:** The server stores only public keys; a database breach reveals nothing useful for completing active or future ceremonies
- **No race condition:** The attacker can never complete—they lack the private key regardless of timing

**Why this is stronger than detection-based approaches:**

Some protocols detect hijacking by counting how many parties attempt to claim a result (multi-claim detection). If multiple parties claim, the ceremony aborts. This works but has edge cases:
- What if the attacker claims first and the user never claims?
- What if the user claims before checking their own screen (premature action)?

The public key approach eliminates these concerns. There's no race because the attacker can never complete—they cannot forge a signature. The security guarantee is cryptographic, not procedural.

### 7.5 Session Fixation Prevention

**Scenario:** Attacker observes the transfer payload and negotiates as *themselves* before the user scans.

This is the "login CSRF" or session fixation attack. The attacker doesn't try to steal the user's session—they try to bind their *own* session to the user's browser.

**When pairing code is enabled:** The pairing code prevents this attack. When the companion app negotiates, it receives a pairing code unique to that negotiation. The user must enter this code into the browser before completion. An attacker who only observes the QR code cannot enter their pairing code into the user's browser—they'd need keyboard access.

**When pairing code is disabled:** The protection is reduced. If the attacker negotiates first and the user never scans (or scans late), the user's browser may receive the attacker's result. Services disabling the pairing code should understand this reduced protection.

**Detection as a security feature.** Multi-negotiation detection (Section 5.8) can reveal attacks. If both the user and attacker negotiate, the user's app can be warned. This doesn't prevent the attack (the pairing code does that) but provides valuable intelligence about compromised environments.

See Section 6 for detailed attack analysis and the boundary condition (keyboard access defeats all authentication).

### 7.6 Trust Assumptions

- User agent and companion application are not compromised
- Service correctly implements the protocol
- All communication uses HTTPS
- Session IDs are cryptographically random (UUIDv4 or equivalent)
- Cryptographic signatures use secure algorithms (e.g., ECDSA P-256, Ed25519)
- Ceremonies expire within the configured timeout

### 7.7 Implementation Correctness and the Existing Trust Model

**What if implementations are incorrect?**

Each party has responsibilities. Incorrect implementations degrade security:

| Party | Responsibility | If implemented incorrectly |
|-------|----------------|---------------------------|
| **Browser** | Generate secure ephemeral key pairs; render trusted UI that pages cannot manipulate; honestly report requesting origin; initialize before displaying QR; never expose private key | Weak key generation enables forgery; manipulable UI enables phishing; false origin reporting defeats server-side phishing protection; early QR display defeats hijacking protection; leaked private key defeats all protection |
| **Companion App** | Display origin clearly; validate TLS | Hidden origin enables phishing; broken TLS enables MITM |
| **Service** | Generate cryptographically random session IDs; store public keys correctly; verify signatures correctly; enforce expiration; enforce origin policy (for phishing-sensitive use cases) | Weak session IDs enable collision attacks; broken signature verification defeats hijacking protection; missing origin validation enables phishing attacks |

**This is the same trust model users already have.**

Users already trust their browser to correctly implement security-critical features: same-origin policy, TLS certificate validation, secure random number generation, and accurate URL display. A browser that fails at any of these is already a security catastrophe, regardless of this protocol.

Users already trust their authenticator apps and password managers to protect secrets, validate TLS, and correctly implement cryptographic operations. A TOTP app with weak random number generation or a password manager that doesn't verify server certificates is already a security catastrophe.

Users already trust services to correctly implement authentication: to hash passwords properly, to generate unpredictable session tokens, to enforce expiration. A service that fails at these is already vulnerable.

**This protocol does not introduce new trust relationships.** It extends existing responsibilities to cover new operations. The browser already must generate secure randomness and key pairs (for various web platform features like WebCrypto); now it also generates ephemeral key pairs for session binding. The service already must implement secure session management; now it implements four more endpoints following the same principles.

The security of this protocol degrades gracefully with implementation quality—just like existing web security. A poorly implemented browser is dangerous with or without this protocol. A poorly implemented service is dangerous with or without this protocol. This protocol adds surface area, but not new categories of trust.

---

## 8. Alternative Design Considered

An alternative detection-based approach was explored that creates server state only after successful negotiation (rather than at initialization), reducing denial-of-service surface area. However, this approach requires two user-entered codes for full security instead of one—the UX cost was deemed not worth the tradeoff, especially since DoS can be mitigated with standard techniques (rate limiting, CAPTCHA, short expiration). See Appendix D for detailed analysis.

---

## 9. Privacy Considerations

### 9.1 Information Disclosed

The companion application learns which origin the user is binding to. This is inherent and visible to the user.

### 9.2 Tracking Prevention

Session IDs are generated fresh per request and cannot be used for cross-site tracking.

### 9.3 Transfer Mechanism Privacy

Different transfer mechanisms have different privacy properties:

- **QR codes** can be observed visually
- **NFC/Bluetooth** may be detectable by nearby devices
- **Manual codes** are visible on screen

Services and users should choose mechanisms appropriate for their environment.

---

## 10. Use Cases

The protocol is agnostic to what is being bound. Any operation where a companion app negotiates with a service and a browser needs to receive the result is a candidate use case.

### 10.1 Authentication

A user logs into a service via their phone. The companion application authenticates the user (by any method) and the service provides a session token. The token is bound to the browser session.

### 10.2 Document Signing

A user signs a document using a key held on their phone. The companion app receives the document (or hash) from the service, displays it for user confirmation, signs it, and returns the signature. The signature is bound to the browser session.

### 10.3 Payment Authorization

A user authorizes a payment via their banking app. The companion app receives payment details from the service, displays them for user confirmation, coordinates with the bank's infrastructure, and returns an authorization token. The token is bound to the browser session.

### 10.4 Device Provisioning

A new device displays a binding request. A management app (already authenticated) approves provisioning. Credentials are bound to the new device's session.

### 10.5 Session Transfer

A user is logged in on their phone and wants to continue on a desktop browser. The companion app authorizes the session transfer. The existing session is bound to the browser.

### 10.6 File Transfer

A user wants to send a file from their phone to a browser. This use case differs fundamentally from the others: the bound result is not static data but connection info for a live streaming session. The relay service forwards chunks as they arrive rather than storing the entire file.

File transfer also demonstrates the pre-negotiation phase (Section 5.4). Before the pairing UI appears, the receiver page negotiates download authentication parameters with the relay:

1. The receiver page registers a download public key during pre-negotiation
2. The app uploads through the relay, which holds the upload request open
3. Upon OOB completion, the receiver connects to download with a signed request
4. The relay pipes data from the upload to the download in real-time

This demonstrates the symmetry between pre-negotiation (page↔server) and negotiation (app↔server), each enabling arbitrary protocol exchanges within their respective channel.

A proof-of-concept is available. For detailed protocol design, security considerations, and implementation guidance, see **Appendix E: File Transfer Protocol**.

### 10.7 Implementation Considerations for Use Cases

The protocol handles secure binding—it does not dictate what happens during negotiation. For each use case, implementers must consider:

1. **Can the app do something meaningful during negotiation?** For authentication, the app authenticates the user. For payments, the app may need to coordinate with external infrastructure (e.g., the bank's API) during negotiation before returning a result to the service.

2. **Does the user have enough information to consent?** The protocol delivers a result to the browser, but the user's informed consent happens in the companion app. For document signing, the app should display the document (not just a hash). For payments, the app should display the amount and recipient. This is UX design, not protocol design, but it's critical for the use case to be trustworthy.

These considerations are outside the protocol's scope but essential for building trustworthy applications on top of it.

---

## 11. Implementation Considerations

### 11.1 Service Endpoint Specifications

The service implements four HTTP endpoints. A summary:

| Endpoint | Caller | Purpose |
|----------|--------|---------|
| handshake | Browser | Report requesting_origin, negotiate signature algorithm, receive pairing_code_specification |
| initialize | Browser | Send public_key, receive session_id |
| negotiate | App | Perform operation, stage result, receive pairing_code (if enabled) |
| complete | Browser | Retrieve result with signature (+ pairing_code if enabled) |

Detailed request/response formats are in **Appendix A**.

**Wrong code handling.** When the user enters an incorrect pairing code, the browser SHOULD allow retry. The complete endpoint MAY be called multiple times for the same session; wrong code attempts do not affect ceremony state—the user can keep trying until the session expires. This is safe because the cryptographic signature, not the pairing code, provides the primary security against hijacking.

Services MAY implement retry limits as defense-in-depth. A limit of 5-10 attempts is reasonable; short expiration times (60-120 seconds) make brute-force impractical regardless.

### 11.2 Cryptographic Requirements

- **Session ID:** MUST be transmitted as base64url. The encoded form MUST NOT exceed 64 characters. RECOMMENDED: UUIDv4, which produces 22 characters when base64url encoded. Services generate session IDs; the browser and companion app treat them as opaque strings.

  *Warning:* Do not implement custom random ID generation. Use your platform's standard UUID library. Weak randomness enables session prediction attacks; if you get this wrong, attackers can hijack ceremonies by guessing session IDs.

- **Key pairs:** ECDSA P-256, Ed25519, or equivalent security level
- **Signatures:** Include timestamp for auditing and defense-in-depth
- **All cryptographic operations:** Use well-tested libraries (e.g., WebCrypto API)

**Replay prevention.** Replay attacks are primarily prevented by the session state machine: sessions are single-use and deleted upon completion. An attacker who captures a valid `complete` request cannot replay it—the session no longer exists. Timestamps in signatures provide additional defense-in-depth and support audit logging.

**Session-level expiration.** The entire binding ceremony has a single expiration time, set by `timeoutSeconds` in the API request. All tokens and state associated with a session share this deadline. After the deadline, all operations on the session fail and all state is discarded.

This design deliberately avoids per-token or per-stage expiration. A single ceremony-wide deadline is simpler to reason about and implement, with far fewer edge cases. The security properties are identical, and the user experience is adequate—users simply see "session expired" rather than confusing partial-failure states.

### 11.3 Accessibility

User agents MUST provide transfer mechanisms usable by people with disabilities:

- Screen reader compatible manual code entry
- Keyboard-only operation
- Sufficient time for completion (configurable timeout)

**Open questions for UX and accessibility experts:**

- How does manual pairing code entry work with screen readers in practice? What ARIA patterns are appropriate?
- What timing accommodations are needed for users who require more time? How should the timeout interact with assistive technology?
- What alternative transfer mechanisms should be specified for users who cannot use cameras (for QR codes) or who rely on specific input methods?
- How should the trusted UI communicate ceremony state to users with cognitive disabilities?

These questions require expert evaluation and user testing beyond the scope of this initial proposal. See Future Work (Section 16).

### 11.4 Ceremony Length

With the pairing code enabled, this protocol requires one user-entered code. Without it, no codes are required.

**Comparison with existing systems:**

| System | User steps after QR scan |
|--------|--------------------------|
| DigiD (Netherlands) | Enter 1 code (browser → app), then approve in app |
| WhatsApp Web | Biometric confirmation in app only (no code entry) |
| This protocol (full) | Enter 1 code (app → browser) |
| This protocol (minimal) | None (comparable to WhatsApp Web) |

**Service flexibility:**

Services choose their security/UX tradeoff by enabling or disabling the pairing code (see Section 5.9). A service that:

- **Wants maximum security** enables the pairing code
- **Wants WhatsApp-like UX** disables the code, relying on signature verification for hijacking protection and accepting fixation risk

### 11.5 Browser-Server Communication

**Polling is adequate.** The browser polls the complete endpoint to check whether negotiation has occurred. For ceremonies under two minutes, polling at 1-2 second intervals adds negligible server load and provides adequate responsiveness.

**Push transports are optional.** Services MAY additionally support WebSocket or Server-Sent Events (SSE) for lower-latency notification of negotiation completion. These are specified in Appendix B (WebSocket) and Appendix C (SSE). Services that already have push infrastructure may prefer these for a slightly snappier user experience, but they are not required for conformance.

### 11.6 State Management

Service state can be in-memory, database, or cache. Expiration must be enforced. Abandoned sessions must not cause resource exhaustion.

**State created at initialization:**
- session_id (server-generated)
- public_key (from browser)
- expires_at

**State added at negotiation:**
- result_data
- pairing_code (if enabled)
- negotiated: true

The entire ceremony's state is small (hundreds of bytes—public keys are typically 32-65 bytes depending on algorithm) and short-lived (60-120 seconds).

---

## 12. Implementation Complexity by Party

A key goal of this protocol is lowering the barrier to secure cross-device binding. Currently, implementing such a system securely requires specialized cryptographic expertise that most development teams don't have. This protocol shifts that burden: the hard problems (trusted UI, key pair generation, signature verification) are solved once in the browser and protocol specification. Services are left with straightforward integration work.

This section provides a concrete assessment of what each party must implement, to help potential adopters understand the effort involved.

### 12.1 What Services Implement (And What They Don't)

For service developers evaluating this protocol, here is a clear breakdown:

**What you implement:**
- **Four HTTPS endpoints** (handshake, initialize, negotiate, complete) — see Appendix A for specifications
- **Short-lived state storage** — session data that expires in 60-120 seconds
- **Your operation logic** — whatever happens when the user performs the operation (authentication, signing, payment authorization, etc.)
- **One JavaScript API call** — to invoke the browser's trusted UI

**What you don't implement:**
- **No companion app.** Any protocol-compliant app works with your service. Password managers, authenticators, or dedicated apps—if they speak the protocol, they work.
- **No trusted UI.** The browser renders the QR code, displays the origin, handles code input. You provide display text; the browser handles presentation.
- **No client-side binding state.** Your web page JavaScript doesn't generate or track session IDs—the server generates them, and the browser manages the ceremony lifecycle.
- **No QR code rendering.** The browser handles this.
- **No cryptographic protocol design.** The security model is specified. You follow the endpoint contracts.

**If you use a reference container:**

The state management and endpoint logic can be deployed as an off-the-shelf container. In this scenario, your service provides just two simple hooks:

1. **Validate** — A stateless check: "Is this operation request valid?" For authentication: "Are these credentials correct?" No side effects. Your server probably already has this logic.

2. **Flush** — Called only when the entire ceremony succeeds: "Apply the result." For authentication: create a session. For signing: store the signature. For payments: record the authorization. This is work your server would do anyway.

The container handles everything in between: the four endpoints, session state, token generation, expiration. Your service never sees the protocol complexity.

### 12.2 Web Page (Service's JavaScript)

**Complexity: Minimal.**

The web page makes a single API call and handles the result. No state management, no polling logic, no cryptographic operations.

```javascript
// Complete implementation
const result = await navigator.outOfBandBinding.request({
  handshakeEndpoint: '/bind/handshake',
  initializeEndpoint: '/bind/initialize',
  negotiateEndpoint: '/bind/negotiate',
  completeEndpoint: '/bind/complete',
  displayName: 'My Service',
  title: 'Sign in'
});
if (result.status === 'success') { /* proceed */ }
```

### 12.3 User Agent (Browser)

**Complexity: Moderate, but well-defined.**

The user agent implements:

1. **API surface:** One method (`request()`) with straightforward parameters and optional callbacks
2. **Handshake:** HTTP request to handshake endpoint with requesting origin and supported algorithms, receive agreed algorithm and pairing code configuration
3. **Key generation:** Ephemeral key pair using agreed algorithm via WebCrypto API
4. **Initialization:** HTTP request to initialize endpoint with public key, receive session_id
5. **Pre-negotiation callback:** If provided, invoke the page's `preNegotiate` callback and wait for completion
6. **Trusted UI:** Modal display showing origin, service text, QR code, status, code input
7. **QR code encoding:** Standard library operation
8. **Signing:** Sign completion requests with private key
9. **Status monitoring:** Polling (or WebSocket/SSE) for negotiation completion
10. **Result delivery:** Set cookies or return data to promise
11. **Compromise notification:** If the complete response contains a `compromised` field set to `true`, the user agent MUST inform the user that their environment may be compromised—even though the session completed successfully, another device also scanned the QR code and attempted to negotiate. The user SHOULD be advised to review their security and consider whether the session should be trusted.

**State held during a ceremony:**
- Agreed algorithm (from handshake)
- Session ID (from server)
- Private key (never transmitted)
- Endpoint URLs
- Current phase indicator

All state is local to the ceremony and discarded on completion or cancellation. The private key exists only in memory during the ceremony. No persistent storage. No cross-session state.

### 12.4 Companion Application

**Complexity: Moderate, straightforward.**

The companion application implements:

1. **QR code scanning:** Standard library operation
2. **Transfer data parsing:** JSON decode
3. **Origin display:** Show the service origin to user
4. **Negotiate request:** Single HTTP POST
5. **Pairing code display:** Show code to user (if enabled)
6. **Result display:** Show success/failure
7. **Compromise handling:** If the negotiate response indicates `compromised`, the application MUST warn the user that the environment is compromised (another device also scanned the QR code) and that they cannot complete this flow. The user should be advised to start a new session from a secure browser.

**State held during a ceremony:**
- Endpoint URL (from QR)
- Session ID (from QR)
- Pairing code (from negotiate response)

All state is local to the ceremony. The app needs no persistent state related to this protocol (authentication credentials are separate and existing).

### 12.5 Service (Server)

The server implements four endpoints and retains short-lived information.

**What the server must retain during a ceremony:**

For each active ceremony (identified by session_id):
- The algorithm (from handshake, needed for signature verification)
- The public_key (from initialization)
- Whether negotiation has occurred
- The result data to deliver (from negotiation)
- The pairing_code (if enabled, from negotiation)
- Expiration deadline

The entire ceremony shares a single expiration deadline. When the deadline passes, all information for that ceremony can be discarded.

**Endpoint logic summary:**

| Endpoint | Receives | Does | Returns |
|----------|----------|------|---------|
| handshake | requesting_origin, algorithms[] | Validate origin policy, select supported algorithm | algorithm, pairing_code_specification |
| initialize | public_key | Generate session_id, store public_key | session_id |
| negotiate | session_id, operation data | Validate operation, stage result, generate pairing_code if enabled | pairing_code (if enabled) |
| complete | session_id, signature, timestamp, [pairing_code] | Verify signature against stored public_key, validate code if enabled, return result | result_data |

**Key properties:**

- **Short-lived:** Ceremonies expire in 60-120 seconds. State is self-cleaning.
- **Bounded:** One ceremony's worth of data per active session. Cannot grow unbounded.
- **Isolated:** Binding state is independent of application logic. Services can implement these endpoints without modifying existing systems.
- **Containerizable:** The logic can be extracted into a standalone service, deployed as a container or sidecar, with integration via internal API.

### 12.6 State Cleanup

All state expires with the ceremony. Successful completion allows eager cleanup, but it's optional—expiration handles abandoned ceremonies automatically.

### 12.7 Deployment Considerations

**Stateless web tier compatibility:** The server state can reside in Redis, memcached, or any shared cache. Multiple server instances can handle the endpoints without sticky sessions.

**Horizontal scaling:** State is keyed by session_id. No cross-key coordination required. Standard cache sharding works.

**Reference implementation potential:** The binding protocol is sufficiently isolated that a reference implementation could be published as:
- A library (Node.js, Python, Go, etc.)
- A Docker container exposing the four endpoints
- A cloud function template

Services would integrate by proxying the four endpoints to this component and providing two hooks: a validate function (stateless operation check) and a flush function (apply result on success). See Section 12.1 for details.

---

## 13. Extensibility Points

This proposal defines the core protocol. Several aspects are intentionally flexible to allow evolution and adaptation:

| Aspect | Flexibility | Notes |
|--------|-------------|-------|
| Transfer mechanism | User agent choice | QR, NFC, Bluetooth, USB, audio, manual entry, deep links |
| Transfer payload format | Standardized (JSON v1) | Baseline format mandated in Section 4.5.1; future versions via `version` field |
| Pairing code | Service-configured | Explicit enable/disable; any characters; length 1-6 |
| Completion mode | Service choice | cookie, object, bytes, redirect |
| Timeout | Service choice | Per-operation configuration |
| Operation semantics | Service/app choice | Protocol is agnostic to what is being bound |

Future extensions might include:
- Additional completion modes
- Bidirectional communication during the operation phase
- Multi-step approval flows

---

## 14. Relationship to Existing Standards

This protocol operates at a different layer than authentication protocols.

| | This Protocol | FIDO2/WebAuthn | OAuth | CIBA |
|---|---|---|---|---|
| **Purpose** | Secure binding | Authentication | Authorization | Authentication |
| **Scope** | Transport layer | Full auth protocol | Full authz protocol | Full auth protocol |
| **What it specifies** | How to deliver results | How to authenticate | How to authorize | How to authenticate |
| **Agnostic to auth method** | Yes | No (FIDO only) | Partially | No (OIDC) |
| **Platform neutral** | Yes | No | Yes | Yes |

This protocol can work **alongside** these protocols:

- A companion app authenticates via FIDO2, then this protocol delivers the session token
- A companion app performs OAuth authorization, then this protocol delivers the access token

The protocol doesn't replace authentication standards; it provides secure delivery infrastructure.

---

## 15. Anticipated Questions

### Q1: Why not extend WebAuthn or FIDO2 instead of creating a new protocol?

WebAuthn specifies *how to authenticate* using public-key cryptography. This protocol specifies *how to deliver results* to a browser session. They operate at different layers and are complementary.

More practically: WebAuthn's hybrid transport requires platform integration (the authenticator must be recognized by the OS or browser). This protocol is platform-neutral--any app can participate without vendor permission. A companion app could use WebAuthn internally and then use this protocol to deliver the resulting session token.

### Q2: Why not use CIBA (Client-Initiated Backchannel Authentication)?

CIBA is tightly coupled to OpenID Connect and specifies authentication semantics. This protocol is agnostic--it works for authentication, signing, payments, or any operation where a companion app negotiates with a service. CIBA also lacks browser-native trusted UI; it relies on out-of-band notification mechanisms that vary by implementation.

### Q3: Why not use OAuth Device Authorization Grant (RFC 8628)?

The Device Grant solves the opposite problem: authorizing a *limited-input device* (like a TV) by having the user authenticate on a *full browser*. This protocol delivers results *to* a browser from a companion device. The direction is reversed.

Additionally, the Device Grant doesn't have the session hijacking protections this protocol provides.

### Q4: Why does the server generate the session ID, not the browser?

The server generates the session ID during initialization, after receiving the browser's public key. This design:

1. **Eliminates clash handling.** With browser-generated IDs, a collision (however unlikely) requires retry logic. Server-generated IDs are guaranteed unique.
2. **Keeps the session ID unexposed until initialization completes.** The browser generates a key pair, sends the public key, and only then receives the session ID. The session ID is never exposed before the cryptographic binding is established.
3. **Simplifies the protocol.** The browser only generates one thing (the key pair), and the server only generates one thing (the session ID).

### Q5: What about same-device scenarios (app and browser on the same phone)?

The protocol supports this via alternative transfer mechanisms: copy-paste, deep links, or local communication. The security properties remain identical.

### Q6: What prevents replay attacks?

The session state machine is the primary defense: sessions are single-use and deleted upon successful completion. An attacker who captures a valid `complete` request cannot replay it—the session no longer exists. Timestamps in signatures provide defense-in-depth and support audit logging.

### Q7: Why four endpoints instead of fewer?

Each endpoint has a distinct caller and purpose:

- **handshake**: Called by browser → server. Reports requesting origin, negotiates signature algorithm, receives pairing code configuration.
- **initialize**: Called by browser → server. Sends public key, receives session ID.
- **negotiate**: Called by app → server. Performs the operation, stages result.
- **complete**: Called by browser → server. Retrieves the result with signed proof of ownership.

Combining them would conflate responsibilities and complicate the security analysis.

### Q8: What if the user closes the browser mid-ceremony?

The ceremony times out. No state persists beyond the configured timeout. The user simply starts over.

### Q9: How does this interact with existing authentication systems?

The protocol is a transport layer that sits alongside existing authentication. A service continues using whatever authentication it has (passwords, passkeys, OAuth, SAML). This protocol just provides a new way to deliver the authentication result to a browser session.

Services can adopt it incrementally—add the four endpoints (or deploy a reference container) and offer it as an additional login method. No dedicated companion app is required; any protocol-compliant third-party app (password managers, authenticators) will work.

### Q10: Does a service need to build its own companion app?

No. Any protocol-compliant companion app works with any protocol-compliant service. A user with a general-purpose authenticator or password manager that supports this protocol can use it for all services that implement the protocol's endpoints. Services that already have dedicated apps can continue using them, but new services can rely entirely on third-party companion apps—they only need to implement the server-side endpoints.

### Q11: Why is the pairing code optional? Doesn't disabling it compromise security?

Security always trades off against usability. The pairing code protects against session fixation by observation-only attackers. Disabling it makes the ceremony simpler (no code entry) but vulnerable to this attack.

Session hijacking is *always* protected by the signature mechanism—that's not optional.

Services should enable the pairing code for high-value operations. They may disable it for low-value operations, when fixation attacks are immediately detectable (e.g., identity-binding scenarios where users see "Welcome, [Name]"), or when other mitigations exist.

### Q12: What if an attacker can type into my browser?

If an attacker can type into your browser (physical keyboard access, remote desktop, input injection malware), the pairing code provides no protection—nor does any other authentication mechanism. Such an attacker can fill in password fields, click approve buttons, and navigate to any page. This protocol protects against *observation-only* attackers (shoulder-surfing, screen capture, camera surveillance). Physical security threats require physical security measures.

---

## 16. Future Work

- **Formal specification:** Complete JSON schemas and state machine formalization
- **Formal security verification:** The security reasoning in this proposal appears sound but has not been formally verified. Tools such as ProVerif, Tamarin, or Protocol Composition Logic (PCL) could provide rigorous proof of the claimed security properties. This would significantly strengthen the case for standardization.
- **Usability studies:** Real-world testing with diverse user populations
- **Reference implementations:** Production-quality server libraries and browser components
- **Accessibility review:** Expert evaluation of the pairing code mechanism for users with disabilities (see Section 11.3)
- **W3C standardization:** Formal standards track process

---

## 17. Adoption

### 17.1 The Passkey Landscape

Passkeys are experiencing significant momentum. Browser vendors and platform providers have invested heavily in building passkey infrastructure, and adoption is growing. This is positive for web security.

However, the current passkey ecosystem is largely contained within platform-controlled boundaries. Apple's passkeys sync through iCloud Keychain. Google's sync through Google Password Manager. Microsoft's through Microsoft Account.

Cross-platform passkey usage exists but is significantly more strenuous than within-platform passkey usage. For example, using an iPhone to authenticate to Chrome on Windows requires: enabling Bluetooth on both devices, scanning a QR code, waiting for the Bluetooth handshake, approving platform-specific permission dialogs, and repeating this entire process for every authentication—the cross-device link does not persist. Compare this to using a passkey within Apple's ecosystem: tap the password field, glance at Face ID, done.

Third-party passkey providers face even steeper barriers. A password manager like 1Password or Bitwarden can store passkeys, but cannot offer the same seamless cross-device experience as platform-integrated solutions. They lack access to the low-level transport mechanisms that make hybrid authentication smooth. Users who choose independent providers over platform lock-in are punished with worse UX.

This proposal would benefit passkey adoption by providing infrastructure that any passkey provider—including independent ones—could use for secure cross-device ceremonies. A password manager like Bitwarden or 1Password could offer the same seamless cross-device experience currently available only to platform-integrated solutions.

### 17.2 Incentive Structures

The major browser vendors—Google (Chrome), Apple (Safari), Microsoft (Edge)—are also the major passkey platform providers. This creates a structural misalignment: implementing this proposal would enable independent competitors to offer equivalent cross-device authentication experiences, reducing the lock-in value of their integrated ecosystems.

This is an observation about incentive structures. Organizations rationally prioritize work that strengthens their competitive position. A proposal that commoditizes a differentiating feature is unlikely to receive enthusiastic support from those who benefit from the current structure—regardless of its technical merits or benefits to users.

### 17.3 Ecosystem-Driven Adoption

Adoption does not require browser vendor cooperation initially. Browser extensions can provide the full security guarantees of native implementation:

- The extension's background script holds the private key, completely isolated from page JavaScript
- The extension provides trusted UI (popup or sidebar) that the page cannot manipulate
- The extension injects `navigator.outOfBandBinding` into page context, making the API available

Crucially, **services and companion apps do not need to know whether the browser API is provided by an extension or natively**. The protocol endpoints are identical. A service that implements the four endpoints works with both. A companion app that speaks the protocol works with both. The ecosystem can develop today.

This creates a viable adoption path that bypasses browser vendors entirely:

1. **A trusted organization publishes audited extensions.** A pro-open-web organization (Mozilla Foundation, EFF, a new consortium, or similar) creates audited, open-source browser extensions for Chrome, Firefox, and other major browsers. Published through official extension stores with security review, these extensions provide the full protocol capability to any user who installs them.

2. **Credential managers add companion app support.** Password managers and authenticators (Bitwarden, 1Password, Proton Pass, etc.) already have users, security expertise, and motivation to differentiate from platform-locked solutions. Supporting this protocol gives them a compelling feature: "use your existing password manager to securely log into any supporting website, on any device."

3. **Services implement the four endpoints.** The barrier is low—four HTTPS endpoints, short-lived state, reference implementations available. Early-adopter services gain a marketing story and serve security-conscious users.

4. **Critical mass creates pressure.** Once a working ecosystem demonstrates viability and user demand, browser vendors face a choice: implement natively (removing friction for users) or look obstructionist. The extension proves demand; native implementation just improves UX.

This path creates an opportunity for pro-open-web organizations to provide the ecosystem's trusted foundation—a credible, audited, maintained extension backed by a recognized name.

Websites can detect and offer the capability regardless of whether it's provided by extension or native implementation:

```javascript
if (navigator.outOfBandBinding) {
  showOOBLoginButton();
}
```

A proof of concept extension demonstrating this approach exists: [redacted for now]

Notably, the proof of concept uses passkeys (WebAuthn) for the companion app's authentication to the service—demonstrating that this protocol complements rather than competes with passkeys. The protocol provides the secure cross-device binding layer; passkeys provide the authentication. Together, they enable passkey-based authentication through any compliant app, not just platform-integrated ones.

### 17.4 Regulatory Support

The ecosystem-driven path can succeed independently, but regulatory pressure would accelerate adoption.

The European Union's eIDAS 2.0 regulation is creating requirements for interoperable digital identity infrastructure. Member states must provide citizens with European Digital Identity Wallets that work across borders and services. This regulatory push aligns naturally with this proposal:

- **Complementary, not competing.** eIDAS 2.0 defines *what* digital identity infrastructure must accomplish. This proposal defines *how* browsers can securely bind cross-device operations. The two address different layers of the stack.

- **Infrastructure for compliance.** Services required to accept EU Digital Identity Wallets need secure mechanisms for cross-device binding. This proposal provides that infrastructure without requiring platform vendor permission.

- **Sovereignty alignment.** The EU's emphasis on digital sovereignty—reducing dependence on non-EU platform providers—aligns with a protocol that enables any compliant implementation to participate.

Similar regulatory interest may emerge in other jurisdictions pursuing digital identity infrastructure or seeking to reduce platform dependence.

A regulatory mandate requiring browsers to implement secure, open cross-device binding infrastructure would create adoption regardless of individual vendor incentives. But unlike a pure regulatory strategy, the ecosystem-driven path means regulation isn't *required*—it's a tailwind, not a prerequisite.

### 17.5 Independent Browser Vendors

Firefox (Mozilla) and Brave have different incentive structures than platform-integrated browsers (Chrome, Safari, Edge). They don't have passkey ecosystems to protect, and they've positioned themselves as alternatives to platform lock-in.

Native implementation by even one independent browser would be significant—it validates the protocol, provides a better UX than extensions for that browser's users, and increases pressure on other vendors.

### 17.6 The Chicken-and-Egg Problem

Adoption requires both services implementing endpoints and companion apps supporting the protocol. This classic chicken-and-egg problem can be addressed:

**For companion apps:** Password managers and authenticators already have users, security expertise, and motivation to differentiate. A popular password manager that supports this protocol gains a compelling feature: "use your existing password manager to securely log into any supporting website." First-mover advantage is significant.

**For services:** The reference container approach (Section 12.1) dramatically lowers the barrier. A service can deploy the protocol with minimal integration work—two hooks (validate and flush) plus endpoint proxying. Early-adopter services gain a marketing story: "more secure than passwords, no app to download."

**Bootstrap strategy:**
1. Publish reference implementations (containers, libraries) so services can adopt cheaply
2. Work with one or two major password managers to commit to companion app support
3. Launch with a small set of services and apps that have coordinated
4. Browser implementation follows demonstrated ecosystem viability

The protocol is designed so that partial adoption still provides value. Even a single companion app supporting the protocol makes it useful for all services that implement the endpoints.

### 17.7 Why Native Browser Implementation Matters

A well-designed browser extension can provide the same security properties as a native implementation (see Section 17.3). However, native browser implementation remains the goal for several reasons:

1. **Reach.** Extensions require explicit installation. Native support reaches all users by default. Security features that require opt-in installation remain niche; those built into the platform become ubiquitous.

2. **Trust.** Users must evaluate whether to trust an extension—who authored it, whether it's been audited, whether updates might introduce vulnerabilities. Native browser features inherit the trust users already place in their browser. The extension approach shifts security evaluation burden to users who are poorly equipped for it.

3. **Maintenance.** Extensions can be abandoned, sold to malicious actors, or fall out of sync with browser updates. Native implementations are maintained as part of the browser's security surface.

4. **Discoverability.** Services cannot reliably detect whether users have the capability. With native support, feature detection is straightforward and services can confidently offer the authentication method.

5. **Legitimacy.** A standardized browser API signals that the capability is sanctioned and stable. Services and companion apps are more likely to invest in supporting a W3C standard than a third-party extension.

The extension serves as a proving ground—demonstrating viability, building ecosystem momentum, and providing immediate value to security-conscious users. But the end goal remains native browser support, where the security benefits become available to everyone without requiring individual action.

### 17.8 Polyfill Limitations

A JavaScript library could implement most of the flow: generate key pairs, render QR codes, poll endpoints. However, a polyfill cannot provide the key security property: a trusted UI that the web page cannot manipulate, and crucially, keeping the private key isolated from the page context.

In a polyfill, a malicious page could observe the session ID before initialization completes, or manipulate the "trusted" UI. The security guarantees require either a browser extension or native browser implementation.

A polyfill would still be valuable for:
- Demonstrating the UX to users and stakeholders
- Allowing services to implement endpoints before browser support
- Testing companion app implementations
- Building ecosystem momentum

But for production security, either an extension or native implementation is required.

---

## 18. Conclusion

This proposal describes infrastructure for secure out-of-band session binding. When a user performs an operation on a companion device, the result is delivered to the correct browser session with cryptographic guarantees against interception and misdirection.

The protocol is deliberately minimal and agnostic. It doesn't specify what is being bound—that's between the service and companion application. It only ensures the binding is secure.

The key innovation is establishing a cryptographic binding (via public key initialization) between browser and server *before* exposing the session identifier. This provides unconditional protection against session hijacking—no race conditions, no probabilistic defenses, no reliance on user behavior. The private key never leaves the browser; only the browser that initialized can complete the ceremony. An optional pairing code extends protection to session fixation attacks.

Currently, secure cross-device result delivery requires either platform gatekeeping (limiting who may participate) or specialized expertise (limiting who can participate). Users of smaller services have fewer secure options as a result.

This protocol addresses both barriers. It is platform-neutral—any service can participate without vendor permission. It is implementation-accessible—the hard problems are solved once in the browser, leaving services with straightforward integration work.

---

## License

This document is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

---

## References

1. IETF RFC 2119: Key words for use in RFCs to Indicate Requirement Levels
2. IETF RFC 4122: A Universally Unique IDentifier (UUID) URN Namespace
3. IETF RFC 7231: Hypertext Transfer Protocol (HTTP/1.1): Semantics and Content
4. IETF RFC 8259: The JavaScript Object Notation (JSON) Data Interchange Format
5. IETF RFC 8628: OAuth 2.0 Device Authorization Grant
6. W3C Web Authentication (WebAuthn) Level 2
7. FIDO Alliance: Client to Authenticator Protocol (CTAP) 2.1
8. OpenID Connect Client-Initiated Backchannel Authentication (CIBA)

---

## Appendix A: HTTP Endpoint Specifications

This appendix provides detailed request/response formats for the four HTTP endpoints.

**Encoding:** All JSON payloads MUST be UTF-8 encoded per RFC 8259. The `Content-Type` header SHOULD be `application/json; charset=utf-8`.

**Timestamps:** All timestamps MUST use ISO 8601 format with UTC timezone (e.g., `2026-01-09T12:34:56Z`).

**Signature computation:** Signatures are computed over field values concatenated as UTF-8 strings with no delimiter. For example, with pairing code enabled, the signature input is `session_id || pairing_code || timestamp` where `||` denotes string concatenation. If session_id is `"abc123"`, pairing_code is `"K7M2"`, and timestamp is `"2026-01-09T12:34:56Z"`, the signature is computed over the UTF-8 encoding of `"abc123K7M22026-01-09T12:34:56Z"`.

**Common field limits:**

| Field | Limit |
|-------|-------|
| `session_id` | Max 64 characters (base64url encoded) |
| `error` | Max 64 characters |
| `error_description` / `message` | Max 256 characters |
| `status_url` | Max 2048 characters |
| `algorithm` (in handshake) | Max 16 characters |

**HTTP headers:**

| Header | Direction | Required | Description |
|--------|-----------|----------|-------------|
| `Content-Type: application/json` | Request | MUST | All requests with a body |
| `Content-Type: application/json` | Response | MUST | All responses |
| `Accept-Language` | Request | SHOULD | Browser sends automatically; used for pairing code character selection |

Servers MAY require additional headers (e.g., `Authorization`, `X-CSRF-Token`) as part of their orthogonal security measures. Such requirements are outside this specification's scope.

### A.1 Handshake Endpoint

Called by the browser before initialization to negotiate the signature algorithm, report the requesting origin, and receive pairing code configuration.

**Request:**
```
POST {handshakeEndpoint}
Accept-Language: ja, en-US;q=0.9
Content-Type: application/json
```

```json
{
  "requesting_origin": "https://example.com",
  "algorithms": ["ES256", "Ed25519"],
  "input_hints": {
    "keyboard_layout": "us"
  }
}
```

The `requesting_origin` field contains the origin of the web page that initiated the binding request. The server uses this to apply its origin policy—rejecting requests from unacceptable origins (see Section 7.3).

The `algorithms` array contains the signature algorithms the browser supports, in order of preference. The array MUST contain at least 1 and at most 16 algorithm identifiers. Each identifier MUST NOT exceed 16 characters.

The `Accept-Language` header is sent automatically by browsers per RFC 7231. The `input_hints` field is optional; the browser includes `keyboard_layout` if it can determine the active keyboard layout. Servers should use these hints to choose appropriate characters for the pairing code (see Section 6.3).

**Response (accepted):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "type": "accepted",
  "algorithm": "ES256",
  "pairing_code_specification": {
    "type": "enabled",
    "characters": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
    "length": 4
  }
}
```

The server selects one algorithm from the browser's list that it supports. The `pairing_code_specification` object specifies whether the pairing code is enabled and, if so, the allowed characters and length.

**Response (accepted, pairing code disabled):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "type": "accepted",
  "algorithm": "Ed25519",
  "pairing_code_specification": {
    "type": "disabled"
  }
}
```

**Response (rejected):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "type": "rejected",
  "reasons": ["origin_not_allowed"]
}
```

The server returns a rejected response if:
- The `requesting_origin` is not acceptable per the server's origin policy, and/or
- The server does not support any of the browser's offered algorithms

The `reasons` array contains one or more of:
- `"origin_not_allowed"` — the requesting origin is not acceptable
- `"no_compatible_algorithm"` — no offered algorithm is supported

The array allows the server to report multiple rejection reasons (e.g., both origin and algorithm issues). The browser MUST display an error to the user; the specific message may vary based on the reasons.

**Algorithm identifiers:** The following table lists well-known algorithm identifiers. This list is non-exhaustive; implementations MAY support additional algorithms.

| Identifier | Algorithm | Curve/Parameters | Notes |
|------------|-----------|------------------|-------|
| `ES256` | ECDSA | P-256 + SHA-256 | RECOMMENDED. Widely supported. |
| `ES384` | ECDSA | P-384 + SHA-384 | |
| `ES512` | ECDSA | P-521 + SHA-512 | |
| `Ed25519` | EdDSA | Curve25519 | RECOMMENDED. Fast, constant-time. |
| `Ed448` | EdDSA | Curve448 | Higher security margin. |

Implementations SHOULD support at least `ES256` and `Ed25519` to maximize interoperability. These are widely supported by WebCrypto implementations and provide strong security with reasonable performance.

### A.2 Initialize Endpoint

Called by the browser after a successful handshake to create a ceremony and receive a session ID.

**Request:**
```
POST {initializeEndpoint}
Content-Type: application/json
```

```json
{
  "public_key": {
    "algorithm": "ECDSA",
    "curve": "P-256",
    "x": "base64url-encoded-x-coordinate",
    "y": "base64url-encoded-y-coordinate"
  }
}
```

Or for Ed25519:
```json
{
  "public_key": {
    "algorithm": "Ed25519",
    "key": "base64url-encoded-public-key"
  }
}
```

The public key algorithm MUST match the algorithm agreed during handshake.

**Response (success):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "initialized",
  "session_id": "vK9xQ2mN7pR4wY6zA3bC8dE...",
  "status_url": "/bind/status"
}
```

**Response (success, without optional status_url):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "initialized",
  "session_id": "vK9xQ2mN7pR4wY6zA3bC8dE..."
}
```

The `status_url` field is **optional**. If present, it specifies an endpoint path (resolved the same way as other endpoints) that supports WebSocket or Server-Sent Events for push notifications (see Appendix B and C). If absent, the browser uses polling.

The server generates the session_id and stores it along with the public_key and algorithm.

### A.3 Negotiate Endpoint

Called by the companion application after the user completes their operation.

**Request:**
```json
POST {negotiateEndpoint}
Content-Type: application/json

{
  "session_id": "vK9xQ2mN7pR4wY6zA3bC8dE...",
  "operation_data": { ... }
}
```

The `operation_data` field is service-specific (e.g., authentication assertion, signature, payment authorization token).

**Response (success):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "negotiated",
  "pairing_code": "K7M2"        // Present only when enabled in handshake response
}
```

If `pairing_code` is present, the companion app displays it; the user enters it into the browser.

**Response (operation failure):**
```json
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "operation_failed",
  "error_description": "The requested operation could not be completed"
}
```

The error code and description are service-defined. For authentication, this might be `"authentication_failed"` / `"Invalid credentials"`. For payments, `"payment_declined"` / `"Insufficient funds"`.

**Response (no such session):**
```json
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "unknown_session",
  "error_description": "No ceremony exists for this session ID"
}
```

**Response (compromised - multi-negotiation detection):**

When a successful negotiation has already occurred for this session, the server MUST return:
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "compromised",
  "message": "Another device already completed negotiation for this session. Your environment may be compromised."
}
```

The response intentionally omits `pairing_code`. Without the pairing code, this negotiator cannot complete the flow. The companion application MUST warn the user that the environment is compromised and advise them to start a new session from a secure browser.

### A.4 Complete Endpoint

Called by the browser to retrieve the result. The browser proves ownership by signing the request.

**Request (with pairing code):**
```json
POST {completeEndpoint}
Content-Type: application/json

{
  "session_id": "vK9xQ2mN7pR4wY6zA3bC8dE...",
  "timestamp": "2026-01-09T12:34:56Z",
  "pairing_code": "K7M2",
  "signature": "base64url-encoded-signature"
}
```

The signature is computed over `session_id || pairing_code || timestamp` using the private key corresponding to the public key sent during initialization.

**Request (without pairing code, for polling):**
```json
POST {completeEndpoint}
Content-Type: application/json

{
  "session_id": "vK9xQ2mN7pR4wY6zA3bC8dE...",
  "timestamp": "2026-01-09T12:34:56Z",
  "signature": "base64url-encoded-signature"
}
```

The signature is computed over `session_id || timestamp`.

**Response (pending - no negotiation yet):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "pending"
}
```

**Response (invalid signature):**
```json
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "invalid_signature",
  "error_description": "Signature verification failed"
}
```

**Response (invalid pairing code):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "error",
  "reason": "invalid_code",
  "message": "Pairing code does not match"
}
```

*Note on error response formats:* Invalid pairing code returns HTTP 200 with `status: "error"` because it is a **recoverable** error—the user can retry with the correct code. Terminal errors (invalid signature, unknown session) return HTTP 4xx with `error` and `error_description` fields because they cannot be recovered by retry.

**Response (complete - object mode):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "complete",
  "result": { ... },
  "compromised": false              // Optional; true if multi-negotiation detected
}
```

The `result` object is service-defined. For authentication, this might contain a session token. For signing, a signature. For payments, a transaction ID. Services SHOULD keep results under 64KB; user agents MAY reject larger responses.

**Response (complete - cookie mode):**
```json
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict

{
  "status": "complete",
  "redirect_url": "/dashboard",
  "compromised": false              // Optional; true if multi-negotiation detected
}
```

**Cookie mode and first-party status:** Cookie mode requires same-origin endpoints. The user agent rejects cookie mode requests where endpoints point to a different origin than the page (see Section 4.2). When endpoints are same-origin, cookies set via `Set-Cookie` headers are first-party cookies, and third-party cookie restrictions do not affect this flow. The user agent processes these headers using standard browser cookie handling. Servers SHOULD use appropriate cookie attributes (`Secure`, `HttpOnly`, `SameSite`) per their security requirements. For cross-origin services, use `object` or `bytes` completion mode instead.

**The `compromised` field:** When present and set to `true`, this indicates that multiple devices attempted to negotiate for this session (see Section 5.8). The session completed successfully—the legitimate user entered the correct pairing code—but the QR code was intercepted by another device. The user agent MUST inform the user of this condition; the user should review their security and consider whether to trust the session.

---

## Appendix B: WebSocket Protocol (Optional)

Services MAY support WebSocket for lower-latency notification of negotiation completion. This is optional; polling is always sufficient.

### B.1 Connection

The browser establishes a WebSocket connection to the `status_url` provided in the initialize response. Authentication uses a signed connection request:

```
GET {status_url}?session_id=vK9xQ2mN7pR4wY6zA3...&timestamp=2026-01-09T12:34:56Z&signature=...
Upgrade: websocket
Connection: Upgrade
```

The signature is computed over `session_id || timestamp` using the private key.

### B.2 Server Messages

The server sends JSON messages when state changes:

**Negotiation complete:**
```json
{
  "type": "negotiated"
}
```

This notifies the browser that negotiation occurred. If the pairing code is enabled, the browser prompts the user to enter it. If disabled, the browser can immediately send a complete request.

**Expired:**
```json
{
  "type": "expired"
}
```

### B.3 Client Messages

The client may send a ping to keep the connection alive:

```json
{
  "type": "ping"
}
```

Server responds:

```json
{
  "type": "pong"
}
```

---

## Appendix C: Server-Sent Events Protocol (Optional)

Services MAY support SSE for lower-latency notification of negotiation completion. This is optional; polling is always sufficient.

### C.1 Connection

The browser connects to the `status_url` provided in the initialize response. Authentication uses a signed connection request:

```
GET {status_url}?session_id=vK9xQ2mN7pR4wY6zA3...&timestamp=2026-01-09T12:34:56Z&signature=...
Accept: text/event-stream
```

The signature is computed over `session_id || timestamp` using the private key.

### C.2 Event Stream

The server sends events when state changes:

**Negotiation complete:**
```
event: negotiated
data: {}

```

This notifies the browser that negotiation occurred. If the pairing code is enabled, the browser prompts the user to enter it. If disabled, the browser can immediately send a complete request.

**Expired:**
```
event: expired
data: {}

```

**Keep-alive (optional):**
```
: keep-alive

```

---

## Appendix D: Alternative Design Analysis

This appendix describes an alternative protocol design that was considered and explains why the current approach was chosen instead.

### D.1 The Detection-Based Approach

Instead of initializing with a public key before exposing the session ID, an alternative approach relies on **detection** of racing attackers:

1. Browser generates session ID and immediately displays QR code (no initialization phase)
2. App scans and negotiates with server
3. Browser "claims" the session by contacting a claim endpoint
4. Server tracks how many browsers have claimed
5. App sends an "approval" which includes a **post-claim code** (displayed by browser, entered into app)
6. Server checks: if multiple browsers claimed, abort; if only one, approve
7. Browser retrieves result

**The post-claim code** serves two purposes in this design:
- Creates friction against premature approval (user must look at browser screen)
- Provides entropy if user enters a code without looking (low probability of matching attacker's code)

### D.2 Why The Current Design Is Better

The detection-based approach requires **two** user-entered codes for full protection:
- **Pairing code** (app → browser): Prevents session fixation
- **Post-claim code** (browser → app): Prevents session hijacking via premature approval

The current approach requires only **one** user-entered code:
- **Pairing code** (app → browser): Prevents session fixation
- Session hijacking is prevented cryptographically by the public key—no user action required

**UX comparison:**

| Approach | User steps (full security) |
|----------|---------------------------|
| Detection-based | QR scan, enter code, enter code |
| Current (public key) | QR scan, enter code |

At every security level, the current approach requires one fewer manual step.

**Security comparison:**

The current approach also provides stronger security guarantees:

| Threat | Detection-based | Current (public key) |
|--------|-----------------|----------------------|
| QR observation | Protected (multi-claim detection) | Protected (signature required) |
| TLS compromise (initialization) | N/A (no initialization) | Only public key exposed |
| TLS compromise (completion) | Shared token exposed | Only signature exposed |
| Server DB breach | Shared tokens leaked | Only public keys stored |

### D.3 The Tradeoff: Earlier State Creation

The detection-based approach creates server state only when an app successfully negotiates (which requires completing an operation). The current approach creates server state when the browser initializes—before any user action beyond loading the page.

This means the current approach has more potential for denial-of-service via state exhaustion. A bot could repeatedly call the initialize endpoint, creating abandoned ceremony state.

**Why this tradeoff is acceptable:**

1. **The state is small.** An initialized ceremony stores only: session_id, public_key, expires_at. This is tens of bytes, comparable to any session cookie.

2. **Standard mitigations apply.** Rate limiting, proof-of-work challenges, CAPTCHA, IP reputation, requiring valid session cookies—all standard DoS mitigations work here.

3. **Short expiration.** Ceremonies expire in 60-120 seconds. Abandoned state is automatically cleaned up.

4. **The UX benefit is significant.** Eliminating one manual code entry improves usability for every legitimate user. DoS attacks affect availability, not security, and can be mitigated orthogonally.

5. **The security benefit is significant.** Public key cryptography provides defense-in-depth against TLS compromise and server breaches that the detection-based approach lacks.

Given that proven DoS mitigation techniques exist and the state is minimal and short-lived, the improved UX and stronger security guarantees were deemed worth the tradeoff.

**Protocol scope:** This specification intentionally does not include DoS mitigation mechanisms (such as proof-of-work). Servers MUST implement DoS protections orthogonally using standard techniques appropriate to their environment—rate limiting, CAPTCHA, IP reputation, requiring authenticated sessions before initialization, or other measures. This separation keeps the protocol simple and allows servers to choose mitigations suited to their specific threat model and infrastructure.

---

## Appendix E: File Transfer Protocol

This appendix describes how a live file transfer protocol can be built on top of the OOB binding protocol. A proof-of-concept implementation is available.

### E.1 Overview

File transfer demonstrates the full flexibility of OOB binding:
- **Pre-negotiation** (Phase 3): The receiver page establishes download authentication with the relay
- **Negotiation** (Phase 4): The sender app establishes upload authentication and begins streaming
- **Streaming**: Data flows from app → relay → browser in real-time with minimal buffering

The relay acts as a cross-origin bridge: the receiver page may be on any origin, while the relay provides the streaming infrastructure. This is a valid use of cross-origin OOB binding—file transfer is not a phishing-sensitive operation.

### E.2 Protocol Flow

```
┌──────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Receiver     │   │ User Agent  │   │ Sender      │   │ Relay       │
│ Page         │   │             │   │ App         │   │ Service     │
└──────┬───────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                  │                 │                 │
       │ request(preNeg)  │                 │                 │
       ├─────────────────>│                 │                 │
       │                  │  handshake      │                 │
       │                  ├────────────────────────────────-->│
       │                  │  initialize     │                 │
       │                  ├────────────────────────────────-->│
       │                  │                 │                 │
       │  preNegotiate()  │                 │                 │
       │<─────────────────┤                 │                 │
       │                  │                 │                 │
       │  /pre-negotiate (offer algorithms) │                 │
       ├──────────────────────────────────────────────────────>│
       │             selected algorithm    │                 │
       │<──────────────────────────────────────────────────────┤
       │                  │                 │                 │
       │  [generate keypair]               │                 │
       │                  │                 │                 │
       │  /pre-negotiate (register key)    │                 │
       ├──────────────────────────────────────────────────────>│
       │                  │                 │   [state: PRE-NEGOTIATED]
       │                  │                 │                 │
       │  callback returns│                 │                 │
       ├─────────────────>│                 │                 │
       │                  │                 │                 │
       │                  │ ─ Display UI ─ ─│                 │
       │                  │   (QR code)     │                 │
       │                  │                 │                 │
       │                  │   Transfer      │                 │
       │                  │ · · · · · · · · >                 │
       │                  │                 │                 │
       │                  │                 │  /negotiate     │
       │                  │                 ├────────────────>│
       │                  │                 │  pairing_code,  │
       │                  │                 │  upload_url,    │
       │                  │                 │  upload_secret  │
       │                  │                 │<────────────────┤
       │                  │                 │                 │
       │                  │                 │  POST /upload   │
       │                  │                 │  (streaming)    │
       │                  │                 ├────────────────>│
       │                  │                 │  [request held  │
       │                  │                 │   by relay]     │
       │                  │                 │                 │
       │                  │  User enters    │                 │
       │                  │  pairing code   │                 │
       │                  │                 │                 │
       │                  │  /complete      │                 │
       │                  ├────────────────────────────────-->│
       │                  │  file metadata, │                 │
       │                  │  download_url   │                 │
       │                  │<──────────────────────────────────┤
       │                  │                 │                 │
       │  result          │                 │                 │
       │<─────────────────┤                 │                 │
       │                  │                 │                 │
       │  POST /download (signed)           │                 │
       ├──────────────────────────────────────────────────────>│
       │                  │                 │  [relay pipes   │
       │                  │                 │   upload→download]
       │  file data stream                  │                 │
       │<──────────────────────────────────────────────────────┤
       │                  │                 │                 │
       │  [download complete]               │  [respond to    │
       │                  │                 │   upload req]   │
       │                  │                 │<────────────────┤
       │                  │                 │  "done"         │
```

### E.3 Pre-negotiation Phase

The receiver page uses the `preNegotiate` callback to establish download authentication:

**Step 1: Algorithm Offer**

```http
POST /pre-negotiate
Content-Type: application/json

{
  "session_id": "abc123",
  "step": "offer",
  "algorithms": ["Ed25519"]
}
```

Response:
```json
{
  "status": "ok",
  "algorithm": "Ed25519"
}
```

**Step 2: Key Registration**

The page generates a keypair using the server-selected algorithm and registers the public key:

```http
POST /pre-negotiate
Content-Type: application/json

{
  "session_id": "abc123",
  "step": "register",
  "algorithm": "Ed25519",
  "publicKey": "base64-encoded-public-key"
}
```

Response:
```json
{
  "status": "ok"
}
```

The relay transitions the session to `PRE-NEGOTIATED` state. The private key remains in the page's JavaScript context and will be used to authenticate the download request.

### E.4 Negotiation Phase

The sender app calls `/bind/negotiate` after scanning the QR code:

Response:
```json
{
  "status": "negotiated",
  "pairing_code": "A1B2C3",
  "upload_url": "https://relay.example.com/stream/xyz789/upload",
  "upload_secret": "random-uuid-v4"
}
```

The app immediately begins uploading to `upload_url`, including the `upload_secret` in a header:

```http
POST /stream/xyz789/upload
Content-Type: application/octet-stream
X-Upload-Secret: random-uuid-v4

[file bytes...]
```

**Critical:** The relay holds this request open—it does not respond until the download completes. This provides backpressure: if the receiver is slow, the upload naturally slows down.

### E.5 Download Authentication

After OOB completion, the receiver page receives the download URL. To authenticate, the page signs a message with its private key:

```http
POST /stream/xyz789/download
Content-Type: application/json

{
  "public_key": "base64-encoded-public-key",
  "message": "download-1704067200000",
  "signature": "base64-encoded-signature"
}
```

The relay verifies:
1. The public key matches what was registered during pre-negotiation
2. The signature is valid for the message
3. The session is in the correct state

If valid, the relay begins streaming the file to the receiver. When complete, the relay responds to the app's upload request with success.

### E.6 Security Considerations

**Upload secret:** The `upload_secret` binds the upload to the negotiate call. Without it, an attacker who learns the `upload_url` could upload malicious data. The secret is a defense-in-depth measure.

**Production improvement:** For stronger security, the app could sign its upload request with a keypair. During negotiate, the app provides its public key; during upload, the app signs the request. This prevents attackers who intercept the `upload_secret` from hijacking the upload.

**Download authentication:** The signature proves the downloader is the same page that registered the key during pre-negotiation. An attacker who learns the download URL cannot forge a valid signature—the private key exists only in the receiver page's JavaScript context.

**Cross-origin safety:** File transfer accepts any `requesting_origin` because it's not phishing-sensitive. A malicious page cannot steal credentials by initiating a file transfer—at worst, the user receives an unwanted file, which they can decline to save.

### E.7 Memory Efficiency

The relay maintains minimal state:
- **No file buffering:** Data is piped directly from upload to download using Node.js streams with backpressure
- **Request pausing:** The upload request is paused (using `req.pause()`) until the downloader connects
- **Backpressure:** Standard stream backpressure ensures slow receivers don't cause memory exhaustion

This design allows transferring arbitrarily large files with constant memory overhead on the relay.

### E.8 Proof of Concept

The file transfer proof of concept includes:
- **Receiver page** (`localhost:3000`): Demonstrates pre-negotiation and signed download
- **Sender app** (`localhost:3001`): Demonstrates negotiate and streaming upload
- **Relay service** (`localhost:3002`): Demonstrates state machine, streaming, and backpressure

The three components run on different ports, demonstrating the cross-origin capability. The receiver page at `localhost:3000` successfully communicates with the relay at `localhost:3002`.

---

## Appendix F: QR Code Capacity Analysis

This appendix provides detailed analysis of QR code capacity for the session transfer format defined in Section 4.5.

### F.1 Question

QR codes have versions 1-40, with increasing capacity. The question: **Is QR capacity sufficient for this protocol's transfer payload?**

### F.2 Transfer Payload Components

What must be encoded:
- `version`: 1 byte (the digit `1`)
- `url`: Negotiate endpoint URL (full URL)
- `session_id`: max 64 characters (typically 22 for UUIDv4)
- `name`: Service display name

### F.3 Realistic Transfer Payload Sizes

**Minimal (short URL, UUIDv4 session ID):**
```
{"version":1,"url":"https://example.com/bind/negotiate",
"session_id":"dGhpcyBpcyBhIHV1aWQ0","name":"Example"}
```
~110 bytes

**Typical (moderate URL, UUIDv4 session ID):**
```
{"version":1,"url":"https://auth.example-service.com/api/oob/negotiate",
"session_id":"dGhpcyBpcyBhIHV1aWQ0Lg","name":"Example Service"}
```
~150 bytes

**Large (enterprise URL, max-length session ID):**
```
{"version":1,"url":"https://auth.corporate-solutions.example.com/api/v2/bind/negotiate",
"session_id":"ZXh0cmVtZWx5IGxvbmcgc2Vzc2lvbiBpZCB0aGF0IHVzZXMgYWxsIDY0IGNoYXJz",
"name":"Corporate Portal"}
```
~200 bytes

### F.4 QR Code Capacity

QR code capacity in binary mode with Level L error correction:

| Version | Modules | Capacity | Sufficient for |
|---------|---------|----------|----------------|
| 5 | 37×37 | 106 bytes | Minimal transfer payloads |
| 10 | 57×57 | 271 bytes | Typical and large transfer payloads |
| 15 | 77×77 | 412 bytes | Far exceeds protocol requirements |

### F.5 Display Considerations

A Version 10 QR code (57×57 modules) displayed at 4 pixels per module requires only 228×228 pixels—easily accommodated in browser UI. Higher versions (up to Version 20) remain scannable on modern smartphone cameras at typical browser UI sizes. Very high versions (Version 30-40) become increasingly difficult to scan reliably from browser UIs due to module density—these should be avoided.

### F.6 Conclusion

Typical transfer payloads fit comfortably in Version 5-10 QR codes. Even enterprise-scale URLs with max-length session IDs (~200 bytes) fit within Version 10. The 300-byte total transfer payload limit (Section 4.5.1) ensures payloads remain well within Version 10-12, easily scannable. QR capacity is not a practical constraint for this protocol.

---

*End of document.*