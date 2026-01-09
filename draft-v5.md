# Secure and Sovereign Out-of-Band Session Binding for Web Browsers

**A Protocol Proposal for W3C WICG Discussion**

**Author:** Jeroen van Wijgerden

**Date:** January 2026

**Version:** 0.5 (Draft for public comment)

**Disclosure:** The protocol design and core ideas are the author's original work. Large language models were used to identify edge cases, stress-test the security model, and draft this document for a standards audience. The author reviewed and lightly edited the resulting text.

The author is a software engineer, not a security researcher. The protocol design reflects engineering judgment about secure system composition; specific parameter recommendations (entropy requirements, pairing code lengths, token lifetimes) are based on common practice and should be validated by domain experts.

This disclosure is provided in the interest of transparency.

---

## Abstract

This proposal describes browser-native infrastructure for securely binding out-of-band operations to browser sessions. When a user performs an operation on a companion device (such as a mobile phone), the result of that operation can be securely delivered to a specific browser session, with cryptographic guarantees that no attacker can intercept or misdirect it.

The protocol is agnostic to what is being bound. Authentication is one use case; others are payments, document signing, and access grants. The protocol provides the secure binding layer; the semantics of what is bound are determined by the service and companion application. This is infrastructure, not an authentication protocol.

The protocol is designed to be implementable by any service without platform vendor permission or specialized expertise, and without the need for a proprietary companion application. By providing simple, well-defined infrastructure, this proposal democratizes access to secure cross-device operations; any service that can implement four HTTPS endpoints can participate.

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
    - [4.5.2 QR Code Capacity Analysis](#452-qr-code-capacity-analysis)
  - [4.6 Safety of Service-Provided Text](#46-safety-of-service-provided-text)
- [5. Protocol Flow](#5-protocol-flow)
  - [5.1 Overview](#51-overview)
  - [5.2 Phase 1: Handshake](#52-phase-1-handshake)
  - [5.3 Phase 2: Initialization](#53-phase-2-initialization)
  - [5.4 Phase 3: Out-of-Band Operation (Negotiation)](#54-phase-3-out-of-band-operation-negotiation)
  - [5.5 Phase 4: Completion](#55-phase-4-completion)
  - [5.6 State Machine (Server-side)](#56-state-machine-server-side)
  - [5.7 Multi-Negotiation Detection](#57-multi-negotiation-detection)
  - [5.8 Security Mode Variations](#58-security-mode-variations)
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
- [8. Alternative Design: Detection-Based Protocol](#8-alternative-design-detection-based-protocol)
  - [8.1 The Detection-Based Approach](#81-the-detection-based-approach)
  - [8.2 Why The Current Design Is Better](#82-why-the-current-design-is-better)
  - [8.3 The Tradeoff: Earlier State Creation](#83-the-tradeoff-earlier-state-creation)
- [9. Privacy Considerations](#9-privacy-considerations)
  - [9.1 Information Disclosed](#91-information-disclosed)
  - [9.2 Tracking Prevention](#92-tracking-prevention)
  - [9.3 Transfer Mechanism Privacy](#93-transfer-mechanism-privacy)
- [10. Use Cases](#10-use-cases)
  - [10.1 Authentication](#101-authentication)
  - [10.2 Payment Approval](#102-payment-approval)
  - [10.3 Document Signing](#103-document-signing)
  - [10.4 Access Grants](#104-access-grants)
  - [10.5 Device Provisioning](#105-device-provisioning)
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
  - [17.3 A Regulatory Path](#173-a-regulatory-path)
  - [17.4 Other Adoption Paths](#174-other-adoption-paths)
  - [17.5 The Chicken-and-Egg Problem](#175-the-chicken-and-egg-problem)
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

---

## Executive Summary

**Problem.** Security breaches for users interacting with web services via a browser remain commonplace. One contributing factor: secure cross-device authentication is artificially scarce. Today, only two types of organizations can offer it:

- **Browser/platform vendors** control the most secure option (FIDO2 hybrid transport, passkeys). They decide who may participate. Independent developers are excluded without vendor approval.

- **Large corporations** (banks, governments) can afford the alternative: building dedicated companion apps. The Dutch government's DigiD, for example, provides secure cross-device login—but only because the Netherlands can fund development, distribution, security audits, and ongoing maintenance of a dedicated app.

The vast majority of services do not have the influence to sway vendors or the resources to build and maintain a companion app.

**Solution.** This protocol decouples secure cross-device binding from dedicated apps. Services implement four server endpoints instead of building companion applications. Users could use a single general-purpose companion app (e.g., a password manager, authenticator) for multiple services.

The flow: A web page requests a browser-native UI. The browser starts a session with the server. The browser offers a QR code (or other means of data transfer). Operated by the user, a companion app scans the QR code and negotiates with the server. Upon successful negotiation, the server stages some result (e.g., a JWT) and sends the app a pairing code. The user enters the pairing code into the browser. The browser completes the session by retrieving the staged result. Optionally, the server can decide to skip the pairing code (trading UX for security).

**What this changes:**
- Services no longer need to build, distribute, or maintain dedicated apps—just server endpoints
- Users no longer need a different app per service
- Secure cross-device authentication becomes accessible to any service, not just well-resourced ones

**Key mechanisms.** Browser-native UI is sandboxed from web page. The web page supplies partial URLs, completed by the browser based on web page origin. Session hijacking is prevented by public key sharing upon initialization. The QR code can be stolen by design; in case of multiple negotiations, the user is informed of a compromised environment, and the session is voided. The combination of multi-negotiation detection (can only continue in case of a single negotiation) and the pairing code (can only continue after the user's app has negotiated) prevents session fixation.

**Adoption.** As supporting infrastructure, this proposal would be beneficial to passkeys, which are currently heavily invested in by browser vendors and platform providers. However, this proposal goes against the observable platform-locked approach taken by browser vendors and platform providers. A more likely road to success is via regulatory mandate. The EU has been investing significantly in eIDAS 2.0, for which this proposal is not a competitor but supporting infrastructure. Furthermore, this proposal suits the EU's sovereignty ethos.

**Properties:**
- **Phishing-resistant.** Browser enforces same-origin; attackers can only bind to their own origin.
- **Session hijacking prevention.** Public key cryptography ensures only the browser that initialized can complete—the private key never leaves the browser.
- **Over-the-shoulder protection (optional).** When the pairing code is enabled, an attacker who can see the user's screen can only void the ceremony, never hijack it or bind their own session to the user's browser.
- **Platform-neutral.** Any compliant browser, app, and service can participate. No vendor permission required.
- **Semantically agnostic.** Works for login, payments, signing, access grants, etc.
- **Flexible Security/UX tradeoff.** Optional user-entered code. Shape of code is specified by the service.
- **Same trust model.** Users already trust their browser, their authenticator app, and the services they use. This protocol extends those existing relationships rather than introducing new ones.

**Implementation.** Minimal for web pages (one API call). Moderate for browsers and companion apps. Server-side: four endpoints, short-lived state, single expiration deadline.

**Call to action.** This proposal seeks feedback on the protocol design, security model, and API shape. The author invites critique from security researchers, browser engineers, and identity specialists.

---

## 1. Problem Statement

Security breaches for users interacting with web services via a browser remain commonplace. Passwords remain weak. Phishing remains effective. Secure alternatives exist but are not universally available. This proposal addresses one piece of the puzzle: cross-device authentication.

Cross-device flows—logging in via a mobile app, approving a payment on a banking app, signing a document with a key held on a phone—offer strong security because the authenticating device is separate from the potentially compromised browser. But deploying them securely today requires resources most organizations don't have.

### 1.1 The Current Landscape

Two paths exist for secure cross-device authentication, both with high barriers:

**Path 1: Platform vendor integration.** Solutions like FIDO2 hybrid transport and passkeys are secure and standardized. But they require the companion application to be sanctioned by browser vendors or operating systems. Apple, Google, and Microsoft control who may participate. Independent developers are excluded without explicit approval. This creates a gatekept ecosystem where only organizations with existing platform relationships can offer the most secure options.

**Path 2: Dedicated companion apps.** Large organizations (banks, governments) can bypass platform gatekeeping by building their own companion apps. The Dutch government's DigiD provides secure cross-device login for government services. Banks offer similar flows for payment approval. These work well, but the cost is substantial:

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

Importantly, this proposal opens doors without closing existing ones. Services that have invested in dedicated companion apps can continue using them. But services that implement the protocol's backend endpoints gain a new option: any compliant third-party app—a password manager, authenticator, or general-purpose companion app—will work. Users gain choice; services gain flexibility.

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

**Semantic agnosticism.** The protocol works identically regardless of what is being bound--login tokens, payment confirmations, signatures, or arbitrary data.

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
  Promise<BindingResult> request(BindingRequest request);
};

dictionary BindingRequest {
  // Endpoint paths (MUST be same-origin; combined with page origin by user agent)
  // Each path MUST NOT exceed 2048 characters
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

  // Data for companion application (included in transfer payload)
  BufferSource payload;                     // Max 4096 bytes
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

**Same-origin requirement.** The endpoint paths MUST be interpreted relative to the requesting page's origin. The user agent constructs full URLs by combining these paths with the page origin. Cross-origin endpoints are not permitted.

This constraint is fundamental to phishing resistance. If a page at `https://evil.com` could specify endpoints at `https://bank.com`, an attacker could initiate bindings that appear to be for the bank. By enforcing same-origin, the protocol guarantees that all operations occur against the origin that initiated the request.

Services that use separate API domains (e.g., `api.example.com` for a page on `example.com`) must either:
- Serve the binding-initiating page from the API domain, or
- Proxy the binding endpoints through the page's origin

**Field limits.** The following limits apply to `BindingRequest` fields:

| Field | Limit |
|-------|-------|
| `handshakeEndpoint`, `initializeEndpoint`, `negotiateEndpoint`, `completeEndpoint` | Max 2048 characters each |
| `displayName` | Max 64 characters |
| `title` | Max 128 characters |
| `description` | Max 1024 characters |
| `timeoutSeconds` | 10-600 inclusive |
| `payload` | Max 4096 bytes |

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
// Payment example - server controls pairing code format
const result = await navigator.outOfBandBinding.request({
  handshakeEndpoint: '/bind/handshake',
  initializeEndpoint: '/bind/initialize',
  negotiateEndpoint: '/bind/negotiate',
  completeEndpoint: '/bind/complete',

  displayName: 'MyBank',
  title: 'Approve payment of €49.99',
  description: 'Open the MyBank app and scan this code to approve ' +
               'the payment to Example Store.',

  completionMode: 'object',
  timeoutSeconds: 180,

  // Payment details for the companion app to display
  payload: new TextEncoder().encode(JSON.stringify({
    amount: '49.99',
    currency: 'EUR',
    recipient: 'Example Store'
  }))
});

if (result.status === 'success') {
  completeCheckout(result.result.paymentToken);
}
```

```javascript
// Streamlined UX example - server disables pairing code (reduced security)
// Use when: the companion app authenticates the user before negotiating,
// or when the service accepts the risk of session fixation attacks.
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

### 4.4 User Agent UI Requirements

When `request()` is called, the user agent MUST first perform the handshake (see Section 5.2) and initialize the ceremony with the service (see Section 5.3), then display a trusted, modal UI containing:

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

The user agent must provide a way for the user to transfer session parameters (endpoint URLs, session ID, display name, payload) to the companion application. This proposal does not mandate a specific mechanism; implementations should support multiple options for flexibility and accessibility.

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
  "name": "Example Service",
  "payload": "eyJhbW91bnQiOiI0OS45OSIsImN1cnJlbmN5IjoiRVVSIn0"
}
```

**Field definitions and bounds:**

| Field | Required | Max Length | Description |
|-------|----------|------------|-------------|
| `version` | Yes | N/A | Protocol version. MUST be `1` for this specification. |
| `url` | Yes | 512 chars | Full negotiate endpoint URL (origin + path). |
| `session_id` | Yes | 64 chars | The session identifier from initialization (base64url encoded). |
| `name` | Yes | 64 chars | Service display name. If the companion app does not recognize the URL, it MUST display this name along with an indication that the service is unknown. |
| `payload` | No | 1024 chars | Service-specific data as base64-encoded JSON. This limit corresponds to approximately 768 bytes of raw data before base64 encoding. |

**Total payload limit:** The entire JSON transfer payload (including all field names, values, and JSON syntax) MUST NOT exceed 1500 bytes when encoded as UTF-8. This ensures reliable scanning with QR code Version 12-15 at error correction level M.

*Note:* The API allows service payloads up to 4096 bytes, but QR code capacity limits the transfer payload to approximately 768 bytes of service data. Services requiring larger payloads SHOULD use alternative transfer mechanisms (deep links, NFC) or redesign their payload to fit within QR constraints.

**Field justification:** Every field in the transfer payload consumes scarce QR code capacity. Each field above is included because:
- `version`: Required for future protocol evolution without breaking existing apps
- `url`: Required for the app to know where to send the negotiate request
- `session_id`: Required to identify the ceremony
- `name`: Required for user confirmation, especially when the URL doesn't match a known service
- `payload`: Optional; only included when the service needs to pass additional data

**Payload encoding:** When present, the `payload` field MUST contain base64-encoded JSON. The companion application MUST first base64-decode the value, then parse the result as JSON. Note that this means service-provided data is encoded twice: first as JSON then base64 to produce the `payload` field value, then again as part of the outer JSON that is encoded into the QR code.

**Example payload encoding chain:**
1. Service wants to send: `{"amount":"49.99","currency":"EUR"}`
2. JSON serialize → `{"amount":"49.99","currency":"EUR"}`
3. Base64 encode → `eyJhbW91bnQiOiI0OS45OSIsImN1cnJlbmN5IjoiRVVSIn0`
4. This string becomes the `payload` field value in the transfer JSON

#### 4.5.2 QR Code Capacity Analysis

QR codes have versions 1-40, with increasing capacity. The question: **Is QR capacity sufficient for this protocol's payload?**

**What must be encoded:**
- `version`: 1 byte (the digit `1`)
- `url`: Negotiate endpoint URL (full URL)
- `session_id`: max 64 characters (typically 22 for UUIDv4)
- `name`: Service display name
- `payload`: Optional, base64-encoded JSON

**Realistic payload sizes:**

*Minimal (short URL, UUIDv4 session ID):*
```
{"version":1,"url":"https://example.com/bind/negotiate",
"session_id":"dGhpcyBpcyBhIHV1aWQ0","name":"Example"}
```
~110 bytes

*Typical (moderate URL, UUIDv4 session ID):*
```
{"version":1,"url":"https://auth.example-service.com/api/oob/negotiate",
"session_id":"dGhpcyBpcyBhIHV1aWQ0Lg","name":"Example Service"}
```
~150 bytes

*Large (enterprise URL, max-length session ID, included payload):*
```
{"version":1,"url":"https://auth.corporate-solutions.example.com/api/v2/bind/negotiate",
"session_id":"ZXh0cmVtZWx5IGxvbmcgc2Vzc2lvbiBpZCB0aGF0IHVzZXMgYWxsIDY0IGNoYXJz",
"name":"Corporate Portal",
"payload":"eyJhbW91bnQiOiI0OS45OSJ9"}
```
~290 bytes

**QR code capacity (binary mode, Level L error correction):**

| Version | Modules | Capacity | Sufficient for |
|---------|---------|----------|----------------|
| 5 | 37×37 | 106 bytes | Minimal payloads |
| 10 | 57×57 | 271 bytes | Typical payloads |
| 15 | 77×77 | 412 bytes | Large payloads with service payload |
| 20 | 97×97 | 666 bytes | Very large payloads |

**Conclusion:** Typical payloads fit comfortably in Version 5-10 QR codes. Even enterprise-scale URLs with max-length session IDs and service payloads fit within Version 15. QR capacity is not a practical constraint for this protocol.

**Display considerations:** A Version 10 QR code (57×57 modules) displayed at 4 pixels per module requires only 228×228 pixels—easily accommodated in browser UI. Higher versions (up to Version 20) remain scannable on modern smartphone cameras at typical browser UI sizes. Very high versions (Version 30-40) become increasingly difficult to scan reliably from browser UIs due to module density—these should be avoided. The 1500-byte total payload limit (Section 4.5.1) ensures payloads fit comfortably within Version 12-15, well within the reliable scanning range.

### 4.6 Safety of Service-Provided Text

The web page provides the `displayName`, `title`, and `description` shown in the trusted UI. This might seem dangerous--what if a malicious page provides misleading text?

**This is safe because of the protocol's phishing resistance.**

Consider a malicious page at `https://evil.com` that displays:

- displayName: "Your Bank"
- title: "Sign in to Your Bank"
- description: "Scan with Your Bank app to sign in."

The user agent displays this text, but also prominently shows the verified origin: `https://evil.com`. The transfer payload contains URLs pointing to `https://evil.com`. When the companion application receives the payload, it shows `https://evil.com` as the target.

Even if the user ignores all warnings and proceeds:

1. The companion app contacts `https://evil.com`, not the real bank
2. Any operations happen against `evil.com`
3. `evil.com` receives only what it provides itself--not bank credentials

**The blast radius of deceptive text is confined to the service's own origin.** A malicious service can confuse its own users, but cannot use this protocol to phish for credentials belonging to other origins.

This is the same trust model as existing web content: a page can display any text it wants, including fake bank logos. The browser doesn't prevent this because the page can only affect its own origin. This protocol inherits that property.

---

## 5. Protocol Flow

### 5.1 Overview

The diagram below shows the full ceremony with the pairing code enabled. When the code is disabled, the corresponding steps are skipped (see Section 5.8 for variations).

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
```

### 5.2 Phase 1: Handshake

Before generating keys or initializing a session, the browser and server must agree on a signature algorithm. The web page calls `navigator.outOfBandBinding.request()`. The user agent:

1. Constructs the handshake endpoint URL by combining the path with the web page's origin
2. Sends a handshake request containing the algorithms the browser supports (up to 16 algorithm names, each at most 16 characters)
3. Receives either:
   - **Accepted:** The server chose an algorithm from the browser's list, along with the pairing code configuration
   - **Rejected:** The server does not support any of the browser's offered algorithms

If rejected, the user agent MUST display an error to the user indicating that the browser is not compatible with this service. The ceremony terminates.

If accepted, the user agent proceeds to initialization using the agreed algorithm.

**Handshake request/response:**

The service, upon receiving a handshake request:

1. Examines the list of algorithms offered by the browser
2. Selects an algorithm it supports (server's choice)
3. Returns the selected algorithm and pairing code configuration

**Algorithm recommendations:** Implementations SHOULD support `ES256` (ECDSA P-256) and `Ed25519` to maximize interoperability. These algorithms are widely supported by WebCrypto implementations and provide strong security with reasonable performance.

### 5.3 Phase 2: Initialization

The user agent, having completed the handshake:

1. Generates an ephemeral key pair using the algorithm agreed during handshake
2. Constructs the initialize endpoint URL by combining the path with the web page's origin
3. Sends an initialization request to the initialize endpoint with the public key
4. Receives the session ID from the service
5. Only after successful initialization, displays trusted UI with:
   - Transfer mechanism(s) providing the negotiate endpoint URL, session ID, display name, and any service-provided payload
   - **Pairing code input field** (if the service enabled the pairing code during handshake; otherwise skipped)

**Initialization request/response:**

The service, upon receiving an initialization request:

1. Generates a cryptographically random session ID (UUIDv4 recommended; see Section 11.2)
2. Stores `{session_id, public_key, algorithm, expires_at}`
3. Returns the session ID to the browser

**Critical:** The private key never leaves the browser. At completion, the browser will sign a message with the private key to prove it is the same browser that initialized the ceremony. An attacker who observes the session ID (e.g., via the QR code) cannot complete the ceremony—they lack the private key.

### 5.4 Phase 3: Out-of-Band Operation (Negotiation)

The user transfers the session parameters to the companion application via their chosen mechanism.

The companion application:

1. Displays the origin and operation details
2. Requests user confirmation to proceed
3. Contacts the service's negotiate endpoint with the session ID
4. Performs whatever operation is appropriate--this is outside the protocol's scope
5. Upon completion, receives from the service:
   - A **pairing code** (if enabled by service; user must enter this into the browser)

The service, upon receiving a negotiate request:

1. Checks whether a successful negotiation has already occurred for this session (see Section 5.6)
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

### 5.5 Phase 4: Completion

**If pairing code is enabled:** The user reads the pairing code from the companion application and enters it into the browser's trusted UI. The browser then sends a complete request to the complete endpoint with:

- The session ID
- A signature over `session_id || pairing_code || timestamp` using the private key
- The pairing code
- The timestamp

**If pairing code is disabled:** The browser polls the complete endpoint, signing `session_id || timestamp` with each request.

The service validates:

1. The session ID exists and has not expired
2. The signature is valid for the stored public key
3. The timestamp is recent (prevents replay)
4. A negotiation has occurred (result is staged)
5. If pairing code is enabled: the pairing code matches

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

### 5.6 State Machine (Server-side)

The server maintains the following states for each session:

**Note on handshake:** The handshake phase (Phase 1) is stateless—it does not create server-side session state. The browser sends its supported algorithms, and the server responds with its selection and pairing code configuration. No session_id exists yet; no state is persisted. The server remembers nothing from the handshake. Session state is created only when the browser calls the initialize endpoint, which includes the public key (implicitly specifying the agreed algorithm). The server stores the algorithm alongside the public key at initialization time.

```
                         ┌─────────────────────────────────────────┐
                         │           (all states)                  │
                         │               │                         │
                         │     timeout/expiration                  │
                         │               │                         │
                         │               ▼                         │
                         │         ┌──────────┐                    │
                         │         │ EXPIRED  │                    │
                         │         └──────────┘                    │
                         └─────────────────────────────────────────┘

┌─────────┐  initialize  ┌─────────────┐  negotiate   ┌────────────┐
│  EMPTY  │────────────>│ INITIALIZED │─────────────>│ NEGOTIATED │
└─────────┘  (success)  └─────────────┘   (success)  └─────┬──────┘
                                                          │
                                                          │ complete
                                                          │ (valid signature
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
| INITIALIZED | Browser initialized with public_key; session_id issued; awaiting app negotiation |
| NEGOTIATED | App completed operation; result staged (and pairing_code if enabled); awaiting browser completion |
| COMPLETED | Browser retrieved result with valid signature (and pairing_code if enabled); cleanup performed |
| EXPIRED | Timeout reached; state discarded |

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

### 5.7 Multi-Negotiation Detection

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

### 5.8 Security Mode Variations

Services choose their position on the security/UX spectrum by enabling or disabling the pairing code:

| Mode | Pairing code | User steps | Protection                              |
|------|---------------------|------------|-----------------------------------------|
| **Full** | Enabled | QR scan, enter code | hijacking, fixation                     |
| **Minimal** | Disabled | QR scan only | hijacking only                          |

**When to use each mode:**

- **Full:** High-value operations (payments, legal signing, admin access) where the environment may be compromised (public terminals, screen-sharing), or when the companion app does not authenticate the user before negotiating.
- **Minimal:** When the companion app authenticates the user before negotiating (like DigiD), making session fixation impossible because an attacker cannot negotiate as the user. Also suitable for low-value operations or when other mitigations exist.

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

The user agent constructs endpoint URLs using its own knowledge of the page origin. A malicious page at `evil.com` cannot cause the user agent to generate a transfer payload pointing to `legitimate.com`. The companion application receives and displays the true origin.

### 7.3 Phishing Resistance

Even if the web page provides deceptive display text, the protocol prevents cross-origin attacks:

1. The transfer payload contains the true origin (`evil.com`)
2. The companion app shows the true origin
3. All operations occur against the true origin
4. The attacker receives only results from their own service

A phishing page can only "phish" itself. This is the same security model as the web itself.

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

**Detection as a security feature.** Multi-negotiation detection (Section 5.7) can reveal attacks. If both the user and attacker negotiate, the user's app can be warned. This doesn't prevent the attack (the pairing code does that) but provides valuable intelligence about compromised environments.

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
| **Browser** | Generate secure ephemeral key pairs; render trusted UI that pages cannot manipulate; enforce same-origin; initialize before displaying QR; never expose private key | Weak key generation enables forgery; manipulable UI enables phishing; broken same-origin enables cross-origin attacks; early QR display defeats hijacking protection; leaked private key defeats all protection |
| **Companion App** | Display origin clearly; validate TLS | Hidden origin enables phishing; broken TLS enables MITM |
| **Service** | Generate cryptographically random session IDs; store public keys correctly; verify signatures correctly; enforce expiration | Weak session IDs enable collision attacks; broken signature verification defeats hijacking protection |

**This is the same trust model users already have.**

Users already trust their browser to correctly implement security-critical features: same-origin policy, TLS certificate validation, secure random number generation, and accurate URL display. A browser that fails at any of these is already a security catastrophe, regardless of this protocol.

Users already trust their authenticator apps and password managers to protect secrets, validate TLS, and correctly implement cryptographic operations. A TOTP app with weak random number generation or a password manager that doesn't verify server certificates is already a security catastrophe.

Users already trust services to correctly implement authentication: to hash passwords properly, to generate unpredictable session tokens, to enforce expiration. A service that fails at these is already vulnerable.

**This protocol does not introduce new trust relationships.** It extends existing responsibilities to cover new operations. The browser already must generate secure randomness and key pairs (for various web platform features like WebCrypto); now it also generates ephemeral key pairs for session binding. The service already must implement secure session management; now it implements four more endpoints following the same principles.

The security of this protocol degrades gracefully with implementation quality—just like existing web security. A poorly implemented browser is dangerous with or without this protocol. A poorly implemented service is dangerous with or without this protocol. This protocol adds surface area, but not new categories of trust.

---

## 8. Alternative Design: Detection-Based Protocol

This section describes an alternative protocol design that was considered and explains why the current approach was chosen instead.

### 8.1 The Detection-Based Approach

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

### 8.2 Why The Current Design Is Better

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

### 8.3 The Tradeoff: Earlier State Creation

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

The protocol supports any operation where results must be securely delivered to a browser session.

### 10.1 Authentication

A user logs into a service via their phone. The companion application authenticates the user (by any method) and the service provides a session token. The token is bound to the browser session.

### 10.2 Payment Approval

A user approves a payment in their banking app. The service provides a payment confirmation token. The web page receives this and completes the purchase.

### 10.3 Document Signing

A user signs a document using a key held on their phone. The signature bytes are bound to the browser session.

### 10.4 Access Grants

A user approves an access request in a management app. The access token is bound to the browser session.

### 10.5 Device Provisioning

A new device displays a binding request. A management app approves provisioning. Credentials are bound to the new device's session.

---

## 11. Implementation Considerations

### 11.1 Service Endpoint Specifications

The service implements four HTTP endpoints. A summary:

| Endpoint | Caller | Purpose |
|----------|--------|---------|
| handshake | Browser | Negotiate signature algorithm, receive pairing_code_specification |
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
- **Signatures:** Must include timestamp to prevent replay
- **All cryptographic operations:** Use well-tested libraries (e.g., WebCrypto API)

**Session-level expiration.** The entire binding ceremony has a single expiration time, set by `timeoutSeconds` in the API request. All tokens and state associated with a session share this deadline. After the deadline, all operations on the session fail and all state is discarded.

This design deliberately avoids per-token or per-stage expiration. A single ceremony-wide deadline is simpler to reason about and implement, with far fewer edge cases. The security properties are identical, and the user experience is adequate—users simply see "session expired" rather than confusing partial-failure states.

### 11.3 Accessibility

User agents MUST provide transfer mechanisms usable by people with disabilities:

- Screen reader compatible manual code entry
- Keyboard-only operation
- Sufficient time for completion (configurable timeout)

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

Services choose their security/UX tradeoff by enabling or disabling the pairing code (see Section 5.8). A service that:

- **Wants maximum security** enables the pairing code
- **Wants WhatsApp-like UX** disables the code, relying on signature verification for hijacking protection and accepting fixation risk (or mitigating it via app-side authentication)

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
- **Your operation logic** — whatever happens when the user performs the operation (authentication, payment approval, document signing, etc.)
- **One JavaScript API call** — to invoke the browser's trusted UI

**What you don't implement:**
- **No companion app.** Any protocol-compliant app works with your service. Password managers, authenticators, or dedicated apps—if they speak the protocol, they work.
- **No trusted UI.** The browser renders the QR code, displays the origin, handles code input. You provide display text; the browser handles presentation.
- **No client-side binding state.** Your web page JavaScript doesn't generate or track session IDs—the server generates them, and the browser manages the ceremony lifecycle.
- **No QR code rendering.** The browser handles this.
- **No cryptographic protocol design.** The security model is specified. You follow the endpoint contracts.

**If you use a reference container:**

The state management and endpoint logic can be deployed as an off-the-shelf container. In this scenario, your service provides just two simple hooks:

1. **Validate** — A stateless check: "Is this operation request valid?" For authentication: "Are these credentials correct?" For payments: "Is this payment authorized?" No side effects. Your server probably already has this logic.

2. **Flush** — Called only when the entire ceremony succeeds: "Apply the result." For authentication: create a session. For payments: record the transaction. This is work your server would do anyway.

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

1. **API surface:** One method (`request()`) with straightforward parameters
2. **Handshake:** HTTP request to handshake endpoint with supported algorithms, receive agreed algorithm and pairing code configuration
3. **Key generation:** Ephemeral key pair using agreed algorithm via WebCrypto API
4. **Initialization:** HTTP request to initialize endpoint with public key, receive session_id
5. **Trusted UI:** Modal display showing origin, service text, QR code, status, code input
6. **QR code encoding:** Standard library operation
7. **Signing:** Sign completion requests with private key
8. **Status monitoring:** Polling (or WebSocket/SSE) for negotiation completion
9. **Result delivery:** Set cookies or return data to promise
10. **Compromise notification:** If the complete response contains a `compromised` field set to `true`, the user agent MUST inform the user that their environment may be compromised—even though the session completed successfully, another device also scanned the QR code and attempted to negotiate. The user SHOULD be advised to review their security and consider whether the session should be trusted.

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
2. **Payload parsing:** JSON decode
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
| handshake | algorithms[] | Select supported algorithm | algorithm, pairing_code_specification |
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

### Q: Why not extend WebAuthn or FIDO2 instead of creating a new protocol?

WebAuthn specifies *how to authenticate* using public-key cryptography. This protocol specifies *how to deliver results* to a browser session. They operate at different layers and are complementary.

More practically: WebAuthn's hybrid transport requires platform integration (the authenticator must be recognized by the OS or browser). This protocol is platform-neutral--any app can participate without vendor permission. A companion app could use WebAuthn internally and then use this protocol to deliver the resulting session token.

### Q: Why not use CIBA (Client-Initiated Backchannel Authentication)?

CIBA is tightly coupled to OpenID Connect and specifies authentication semantics. This protocol is agnostic--it works for authentication, payments, signing, or any operation. CIBA also lacks browser-native trusted UI; it relies on out-of-band notification mechanisms that vary by implementation.

### Q: Why not use OAuth Device Authorization Grant (RFC 8628)?

The Device Grant solves the opposite problem: authorizing a *limited-input device* (like a TV) by having the user authenticate on a *full browser*. This protocol delivers results *to* a browser from a companion device. The direction is reversed.

Additionally, the Device Grant doesn't have the session hijacking protections this protocol provides.

### Q: Why does the server generate the session ID, not the browser?

The server generates the session ID during initialization, after receiving the browser's public key. This design:

1. **Eliminates clash handling.** With browser-generated IDs, a collision (however unlikely) requires retry logic. Server-generated IDs are guaranteed unique.
2. **Keeps the session ID unexposed until initialization completes.** The browser generates a key pair, sends the public key, and only then receives the session ID. The session ID is never exposed before the cryptographic binding is established.
3. **Simplifies the protocol.** The browser only generates one thing (the key pair), and the server only generates one thing (the session ID).

### Q: What about same-device scenarios (app and browser on the same phone)?

The protocol supports this via alternative transfer mechanisms: copy-paste, deep links, or local communication. The security properties remain identical.

### Q: What prevents replay attacks?

Session IDs are single-use and short-lived. Signatures include timestamps to prevent replay. The server enforces expiration and rejects stale timestamps. Replaying a request after the session expires or with an old timestamp has no effect.

### Q: Why four endpoints instead of fewer?

Each endpoint has a distinct caller and purpose:

- **handshake**: Called by browser → server. Negotiates signature algorithm, receives pairing code configuration.
- **initialize**: Called by browser → server. Sends public key, receives session ID.
- **negotiate**: Called by app → server. Performs the operation, stages result.
- **complete**: Called by browser → server. Retrieves the result with signed proof of ownership.

Combining them would conflate responsibilities and complicate the security analysis.

### Q: What if the user closes the browser mid-ceremony?

The ceremony times out. No state persists beyond the configured timeout. The user simply starts over.

### Q: How does this interact with existing authentication systems?

The protocol is a transport layer that sits alongside existing authentication. A service continues using whatever authentication it has (passwords, passkeys, OAuth, SAML). This protocol just provides a new way to deliver the authentication result to a browser session.

Services can adopt it incrementally—add the four endpoints (or deploy a reference container) and offer it as an additional login method. No dedicated companion app is required; any protocol-compliant third-party app (password managers, authenticators) will work.

### Q: Does a service need to build its own companion app?

No. Any protocol-compliant companion app works with any protocol-compliant service. A user with a general-purpose authenticator or password manager that supports this protocol can use it for all services that implement the protocol's endpoints. Services that already have dedicated apps can continue using them, but new services can rely entirely on third-party companion apps—they only need to implement the server-side endpoints.

### Q: Why is the pairing code optional? Doesn't disabling it compromise security?

Security always trades off against usability. The pairing code protects against session fixation by observation-only attackers. Disabling it makes the ceremony simpler (no code entry) but vulnerable to this attack.

Session hijacking is *always* protected by the signature mechanism—that's not optional.

Services should enable the pairing code for high-value operations. They may disable it for low-value operations, or when the companion app authenticates the user before negotiating (reducing fixation risk through other means), or when other mitigations exist.

### Q: What if an attacker can type into my browser?

If an attacker can type into your browser (physical keyboard access, remote desktop, input injection malware), the pairing code provides no protection—nor does any other authentication mechanism. Such an attacker can fill in password fields, click approve buttons, and navigate to any page. This protocol protects against *observation-only* attackers (shoulder-surfing, screen capture, camera surveillance). Physical security threats require physical security measures.

### Q: Can this protocol be polyfilled before browsers implement it natively?

Partially. A JavaScript library could implement most of the flow: generate key pairs, render QR codes, poll endpoints. However, a polyfill cannot provide the key security property: a trusted UI that the web page cannot manipulate, and crucially, keeping the private key isolated from the page context.

In a polyfill, a malicious page could observe the session ID before initialization completes, or manipulate the "trusted" UI. The security guarantees require native browser implementation.

A polyfill would still be valuable for:
- Demonstrating the UX to users and stakeholders
- Allowing services to implement endpoints before browser support
- Testing companion app implementations
- Building ecosystem momentum

But the security guarantees require native browser implementation. The polyfill would be a development and demonstration tool, not a production security mechanism.

### Q: What if a browser, app, or service implements the protocol incorrectly?

The same thing that happens today when browsers, apps, or services implement security incorrectly: security degrades.

Users already trust their browser to implement same-origin policy, TLS validation, and secure randomness. Users already trust their password manager or authenticator app to protect secrets and validate certificates. Users already trust services to hash passwords and generate unpredictable session tokens. Failures in any of these are already security catastrophes—regardless of this protocol.

This protocol does not introduce new trust relationships. It extends existing responsibilities. See Section 7.7 for detailed analysis.

---

## 16. Future Work

- Formal specification with complete schemas and state machine
- Security analysis and/or formal verification
- Usability studies
- Reference implementations
- Accessibility review
- W3C standardization

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

### 17.3 A Regulatory Path

Given these incentive structures, voluntary adoption by incumbent browser vendors may be slow or absent. A more realistic path to adoption may be regulatory mandate.

The European Union's eIDAS 2.0 regulation is creating requirements for interoperable digital identity infrastructure. Member states must provide citizens with European Digital Identity Wallets that work across borders and services. This regulatory push aligns naturally with this proposal:

- **Complementary, not competing.** eIDAS 2.0 defines *what* digital identity infrastructure must accomplish. This proposal defines *how* browsers can securely bind cross-device operations. The two address different layers of the stack.

- **Infrastructure for compliance.** Services required to accept EU Digital Identity Wallets need secure mechanisms for cross-device binding. This proposal provides that infrastructure without requiring platform vendor permission.

- **Sovereignty alignment.** The EU's emphasis on digital sovereignty—reducing dependence on non-EU platform providers—aligns with a protocol that enables any compliant implementation to participate.

A regulatory mandate requiring browsers to implement secure, open cross-device binding infrastructure would create adoption regardless of individual vendor incentives. The EU has demonstrated willingness to mandate browser changes (e.g., browser choice screens, DMA compliance). This proposal could fit within that regulatory framework.

### 17.4 Other Adoption Paths

Regulatory mandate is not the only path:

- **Independent browsers.** Firefox (Mozilla) and Brave have different incentive structures than platform-integrated browsers. They may see value in enabling independent authentication providers.

- **Enterprise pressure.** Large enterprises with multi-platform environments may pressure browser vendors to support open cross-device protocols.

- **Developer demand.** If enough services want this capability, browser vendors may respond to market demand.

- **Polyfill demonstration.** A JavaScript polyfill (with reduced security guarantees) could demonstrate the UX and build ecosystem momentum before native implementation. See the polyfill FAQ in Section 15 for details on what a polyfill can and cannot provide.

However, the regulatory path remains the most likely to succeed given the structural incentives involved.

### 17.5 The Chicken-and-Egg Problem

Adoption requires both services implementing endpoints and companion apps supporting the protocol. This classic chicken-and-egg problem can be addressed:

**For companion apps:** Password managers and authenticators already have users, security expertise, and motivation to differentiate. A popular password manager that supports this protocol gains a compelling feature: "use your existing password manager to securely log into any supporting website." First-mover advantage is significant.

**For services:** The reference container approach (Section 12.1) dramatically lowers the barrier. A service can deploy the protocol with minimal integration work—two hooks (validate and flush) plus endpoint proxying. Early-adopter services gain a marketing story: "more secure than passwords, no app to download."

**Bootstrap strategy:**
1. Publish reference implementations (containers, libraries) so services can adopt cheaply
2. Work with one or two major password managers to commit to companion app support
3. Launch with a small set of services and apps that have coordinated
4. Browser implementation follows demonstrated ecosystem viability

The protocol is designed so that partial adoption still provides value. Even a single companion app supporting the protocol makes it useful for all services that implement the endpoints.

---

## 18. Conclusion

This proposal describes infrastructure for secure out-of-band session binding. When a user performs an operation on a companion device, the result is delivered to the correct browser session with cryptographic guarantees against interception and misdirection.

The protocol is deliberately minimal and agnostic. It doesn't specify what is being bound—that's between the service and companion application. It only ensures the binding is secure.

The key innovation is establishing a cryptographic binding (via public key initialization) between browser and server *before* exposing the session identifier. This provides unconditional protection against session hijacking—no race conditions, no probabilistic defenses, no reliance on user behavior. The private key never leaves the browser; only the browser that initialized can complete the ceremony. An optional pairing code extends protection to session fixation attacks.

The web needs this infrastructure. Currently, secure cross-device result delivery requires either platform gatekeeping (limiting who is *allowed* to participate) or specialized expertise (limiting who is *able* to participate). The result is an uneven security landscape where users of smaller services have fewer secure options.

This protocol addresses both barriers. It is platform-neutral—any service can participate without vendor permission. It is implementation-accessible—the hard problems are solved once in the browser, leaving services with straightforward integration. By democratizing access to secure cross-device binding, it makes the web more secure for everyone, not just users of large, well-resourced services.

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

Called by the browser before initialization to negotiate the signature algorithm and receive pairing code configuration.

**Request:**
```
POST {handshakeEndpoint}
Accept-Language: ja, en-US;q=0.9
Content-Type: application/json
```

```json
{
  "algorithms": ["ES256", "Ed25519"],
  "input_hints": {
    "keyboard_layout": "us"
  }
}
```

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
  "type": "rejected"
}
```

If the server does not support any of the browser's offered algorithms, it returns a rejected response. The browser MUST display an error to the user indicating that the browser is not compatible with this service.

**Algorithm identifiers:** Implementations SHOULD support `ES256` (ECDSA with P-256 and SHA-256) and `Ed25519` to maximize interoperability. Other common identifiers include `ES384`, `ES512`, and `Ed448`.

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

The `status_url` field is **optional**. If present, it specifies a same-origin endpoint path that supports WebSocket or Server-Sent Events for push notifications (see Appendix B and C). If absent, the browser uses polling.

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

The `operation_data` field is service-specific (e.g., authentication assertion, payment details).

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

The `result` object is service-defined. For authentication, this might contain a session token. For payments, a transaction ID. Services SHOULD keep results under 64KB; user agents MAY reject larger responses.

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

**Cookie mode and first-party status:** Because the complete endpoint is same-origin with the web page (enforced by the API), cookies set via `Set-Cookie` headers are first-party cookies. Third-party cookie restrictions do not affect this flow. The user agent processes these headers using standard browser cookie handling. Servers SHOULD use appropriate cookie attributes (`Secure`, `HttpOnly`, `SameSite`) per their security requirements.

**The `compromised` field:** When present and set to `true`, this indicates that multiple devices attempted to negotiate for this session (see Section 5.7). The session completed successfully—the legitimate user entered the correct pairing code—but the QR code was intercepted by another device. The user agent MUST inform the user of this condition; the user should review their security and consider whether to trust the session.

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

*End of document.*