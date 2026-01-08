# Secure and Sovereign Out-of-Band Session Binding for Web Browsers

**A Protocol Proposal for W3C WICG Discussion**

**Author:** Jeroen van Wijgerden

**Date:** January 2026

**Version:** 0.1 (Draft for public comment)

**Disclosure:** The protocol design and core ideas are the author's original work. Large language models were used to identify edge cases, stress-test the security model, and draft this document for a standards audience. The author reviewed and lightly edited the resulting text.

The author is a software engineer, not a security researcher. The protocol design reflects engineering judgment about secure system composition; specific parameter recommendations (entropy requirements, post-claim code lengths, token lifetimes) are based on common practice and should be validated by domain experts.

This disclosure is provided in the interest of transparency.

---

## Abstract

This proposal describes browser-native infrastructure for securely binding out-of-band operations to browser sessions. When a user performs an operation on a companion device (such as a mobile phone), the result of that operation can be securely delivered to a specific browser session, with cryptographic and human-verified guarantees that no attacker can intercept or misdirect it.

The protocol is agnostic to what is being bound. Authentication is one use case; payments, document signing, and access grants are others. The protocol provides the secure binding layer; the semantics of what is bound are determined by the service and companion application.

The protocol is designed to be implementable by any service without platform vendor permission or specialized cryptographic expertise. By providing simple, well-defined infrastructure, it democratizes access to secure cross-device operations—making them available not just to large organizations with existing platform relationships, but to any service that can implement four HTTPS endpoints.

This is infrastructure, not an authentication protocol.

---

## Executive Summary

**Problem.** Security breaches for users interacting with web services via a browser remain commonplace. One contributing factor: secure cross-device authentication is artificially scarce. Today, only two types of organizations can offer it:

- **Browser/platform vendors** control the most secure option (FIDO2 hybrid transport, passkeys). They decide who may participate. Independent developers are excluded without vendor approval.

- **Large corporations** (banks, governments) can afford the alternative: building dedicated companion apps. The Dutch government's DigiD, for example, provides secure cross-device login—but only because the Netherlands can fund development, distribution, security audits, and ongoing maintenance of a dedicated app.

The vast majority of services do not have the influence to sway vendors or the resources to build and maintain a companion app.

**Solution.** This protocol decouples secure cross-device binding from dedicated apps. Services implement four server endpoints instead of building companion applications. Users could use a single general-purpose companion app (e.g., a password manager, authenticator) for multiple services.

The flow (in its most secure form): A service's web page requests a browser-native, sandboxed UI displaying a QR code (or offers other means of data transfer). The user's companion app scans it and negotiates with the service's server. Upon success, the server keeps some result to be claimed. The app receives a code. The user enters this code into the browser, which then claims the result. After claiming, the browser shows another code. The user enters this second code into the companion app to approve the claim. The browser then retrieves the result.

**What this changes:**
- Services no longer need to build, distribute, or maintain dedicated apps—just server endpoints
- Users no longer need a different app per service
- Secure cross-device authentication becomes accessible to any service, not just well-resourced ones

**Key mechanism.** Instead of this protocol preventing an attacker from taking critical action within the ceremony (negotiating, claiming), this protocol allows it. In case of multiple actions of the same kind, an attack is assumed and dealt with accordingly. A post-action code ensures the user progresses the ceremony only after their own devices have taken the critical actions. The combination of multi-action detection (can only continue in case of a single action) and a post-action code (can only continue after the user's device has taken the action) ensures that ultimately only the user's browser can retrieve the negotiated result from the service, and this result is the one negotiated for by the user.

**Security vs. UX: service choice.** Security always trades off against user experience. This protocol acknowledges that tradeoff and lets services choose their position on the spectrum. Both post-action codes are optional. Services that want maximum protection against over-the-shoulder attacks use both codes. Services that prioritize smoother UX—or that have other mitigations in place—can disable one or both codes and accept the corresponding reduction in protection. The protocol adapts; the security properties degrade gracefully and predictably.

**Properties:**
- **Phishing-resistant.** Browser enforces same-origin; attackers can only bind to their own origin.
- **Over-the-shoulder protection (optional).** When both codes are enabled, an attacker who can see the user's screen can only void the ceremony, never hijack it. Services choose whether to enable this protection.
- **Platform-neutral.** Any compliant browser, app, and service can participate. No vendor permission required.
- **Semantically agnostic.** Works for login, payments, signing, access grants, etc.
- **Flexible.** Services choose their security/UX tradeoff: zero, one, or two user-entered codes.
- **Same trust model.** Users already trust their browser, their authenticator app, and the services they use. This protocol extends those existing relationships rather than introducing new ones.

**Implementation.** Minimal for web pages (one API call). Moderate for browsers and companion apps. Server-side: four endpoints, short-lived state, single expiration deadline.

**Call to action.** This proposal seeks feedback on the protocol design, security model, and API shape. The author invites critique from security researchers, browser engineers, and identity specialists. 

---

## 1. Problem Statement

Security breaches continue despite years of effort. Passwords remain weak. Phishing remains effective. Secure alternatives exist but are not universally available. This proposal addresses one piece of the puzzle: cross-device authentication.

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
- **Solves the hard problems once.** The browser handles trusted UI, session binding, and attack detection. Services don't need cryptographic expertise—just four HTTPS endpoints.

The result: secure cross-device authentication becomes accessible to any service, and users get a consistent experience with a single companion app instead of app-per-service fragmentation.

Importantly, this proposal opens doors without closing existing ones. Services that have invested in dedicated companion apps can continue using them. But services that implement the protocol's backend endpoints gain a new option: any compliant third-party app—a password manager, authenticator, or general-purpose companion app—will work. Users gain choice; services gain flexibility.

### 1.4 What This Protocol Is

This protocol is a **secure binding layer**. It answers the question: "How can a browser session securely receive the result of an operation performed elsewhere?"

The protocol guarantees:

1. **Correct delivery.** The result reaches the browser session that initiated the request, not an attacker's session.
2. **User intent.** The user explicitly approved binding the result to this specific session.
3. **Attack detection.** If an attacker attempts to intercept or race the binding, the protocol detects this and aborts.

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

**User Agent.** The user's browser, specifically a native, sandboxed UI that the web page cannot manipulate. Generates session identifiers, displays trusted UI, and receives the bound result.

**Companion Application.** A native application on another device (or the same device). Receives session parameters out-of-band, facilitates whatever operation the user performs, and approves the binding. This may be a service-specific app (e.g., a bank's app) or a general-purpose third-party app (e.g., a password manager or authenticator). The companion application's internal behavior is outside the scope of this protocol.

**Service.** The backend that the companion application communicates with. Implements four endpoints, maintains short-lived binding state, and provides the result to the user agent upon successful binding.

Additional terminology:

**Binding.** The association between a browser session and the result of an out-of-band operation.

**Result.** Whatever the service provides upon successful binding--a token, a signature, binary data, or instructions to set cookies. The protocol is agnostic to the result's semantics.

**Session ID.** A cryptographically random identifier generated by the user agent that uniquely identifies a binding request. Must be long enough (minimum 128 bits) to make collision between independent sessions negligible.

**Post-Negotiate Code.** A short code provided by the service after negotiation, displayed by the companion application, and entered by the user into the browser before claiming. Optional; when enabled, protects against session fixation attacks. See Section 6 for detailed analysis.

**Post-Claim Code.** A short code displayed by the user agent after claiming and entered by the user into the companion application. Optional; when enabled, protects against session hijacking attacks. See Section 7 for detailed analysis.

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
  required USVString initiateEndpoint;      // App calls this to initiate
  required USVString claimEndpoint;         // Browser calls this (if polling)
  required USVString approveEndpoint;       // App calls this to approve
  required USVString completeEndpoint;      // Browser calls this (if polling)

  // How browser receives status updates (claim ready, approval complete)
  BindingStatusMode statusMode = "polling";
  USVString statusEndpoint;                 // Required for "websocket" or "sse" modes

  // Post-negotiate code format (optional; omit both to disable post-negotiate code)
  CodeSpec postNegotiateCodeSpec;             // Format specified directly
  USVString postNegotiateCodeSpecEndpoint;    // OR: endpoint to fetch format from
  // If neither is provided, post-negotiate code is disabled (reduced security; see Section 6)

  // Display information for trusted UI
  required DOMString displayName;           // Service name, e.g., "Acme Corp"
  DOMString title;                          // Action title, e.g., "Sign in to Acme Corp"
  DOMString description;                    // Detailed instructions for the user

  // Completion handling
  BindingCompletionMode completionMode = "object";
  unsigned long timeoutSeconds = 120;       // How long before the binding times out

  // Data for companion application (included in transfer payload)
  BufferSource payload;
};

dictionary CodeSpec {
  required DOMString charset;               // e.g., "0-9", "A-Z", "0-9A-Z"
  required unsigned short length;           // 1-6 characters
};

enum BindingStatusMode {
  "polling",    // Browser polls claimEndpoint and completeEndpoint via HTTP
  "websocket",  // Browser connects to statusEndpoint via WebSocket for push updates
  "sse"         // Browser connects to statusEndpoint via Server-Sent Events
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
  "aborted",      // User cancelled, multi-negotiation or multi-claim attack detected
  "timeout",      // Binding timed out
  "error"         // Other error (see errorCode)
};
```

**Same-origin requirement.** The endpoint paths MUST be interpreted relative to the requesting page's origin. The user agent constructs full URLs by combining these paths with the page origin. Cross-origin endpoints are not permitted.

This constraint is fundamental to phishing resistance. If a page at `https://evil.com` could specify endpoints at `https://bank.com`, an attacker could initiate bindings that appear to be for the bank. By enforcing same-origin, the protocol guarantees that all operations occur against the origin that initiated the request.

Services that use separate API domains (e.g., `api.example.com` for a page on `example.com`) must either:
- Serve the binding-initiating page from the API domain, or
- Proxy the binding endpoints through the page's origin

### 4.3 Example Usage

```javascript
// Login example - with inline post-negotiate code spec
const result = await navigator.outOfBandBinding.request({
  initiateEndpoint: '/bind/initiate',
  claimEndpoint: '/bind/claim',
  approveEndpoint: '/bind/approve',
  completeEndpoint: '/bind/complete',

  postNegotiateCodeSpec: { charset: '0-9', length: 4 },

  displayName: 'Acme Corp',
  title: 'Sign in to Acme Corp',
  description: 'Open the Acme app on your phone and scan this code. ' +
               'Enter the code shown in the app, then confirm the sign-in.',

  completionMode: 'cookie',
  timeoutSeconds: 90
});

if (result.status === 'success') {
  window.location.href = '/dashboard';
}
```

```javascript
// Payment example - with server-fetched post-negotiate code spec
const result = await navigator.outOfBandBinding.request({
  initiateEndpoint: '/bind/initiate',
  claimEndpoint: '/bind/claim',
  approveEndpoint: '/bind/approve',
  completeEndpoint: '/bind/complete',

  postNegotiateCodeSpecEndpoint: '/bind/negotiation-spec',  // Server controls format

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
// Streamlined UX example - no post-negotiate code (reduced security)
// Use when: the companion app authenticates the user before negotiating,
// or when the service accepts the risk of session fixation attacks.
const result = await navigator.outOfBandBinding.request({
  initiateEndpoint: '/bind/initiate',
  claimEndpoint: '/bind/claim',
  approveEndpoint: '/bind/approve',
  completeEndpoint: '/bind/complete',

  // No postNegotiateCodeSpec or postNegotiateCodeSpecEndpoint
  // → Post-negotiate code is disabled
  // → User scans QR, browser claims immediately, user confirms in app
  // → Vulnerable to session fixation if attacker can scan QR first

  displayName: 'QuickService',
  title: 'Sign in to QuickService',
  description: 'Scan this code with the QuickService app to sign in.',

  completionMode: 'cookie',
  timeoutSeconds: 60
});
```

### 4.4 User Agent UI Requirements

When `request()` is called, the user agent MUST display a trusted, modal UI containing:

1. **Origin** (mandatory, user agent-verified): The full origin of the requesting page, prominently displayed. This is the only information the user agent can verify.

2. **Display name** (service-provided): Shown with clear indication it is unverified, e.g., displayed as a claim: `"Acme Corp" (claimed by https://acme.example.com)`

3. **Title** (service-provided, optional): A brief description of the action.

4. **Description** (service-provided, optional): Instructional text explaining what the user should do.

5. **Transfer mechanism**: A means to transfer session parameters to the companion application (see Section 4.5).

6. **Status indicator**: Current phase of the binding process.

7. **Post-negotiate code input** (conditional): If the service specifies a post-negotiate code format, displays an input field before claiming. The user enters the code shown by the companion app.

8. **Post-claim code area** (conditional): If the service provides a post-claim code after claiming, displays the code with instructions to enter it in the companion application.

9. **Cancel button**: Always available.

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

The transfer payload SHOULD include:
- The four endpoint URLs (as full URLs constructed from origin + paths)
- The session ID
- The display name
- The service-provided payload (if any)

The exact encoding format (JSON, CBOR, custom) is an implementation detail, though standardization would improve interoperability between different companion applications.

#### 4.5.1 QR Code Capacity Analysis

QR codes have versions 1-40, with increasing capacity. The question: **Is QR capacity sufficient for this protocol's payload?**

**What must be encoded:**
- Session ID: 128 bits minimum → ~22 characters in base64url
- Four endpoint URLs (sharing a common origin)
- Display name
- Optional service payload

**Realistic payload sizes:**

*Minimal (short origin, abbreviated keys):*
```
{"o":"https://example.com","p":["/b/i","/b/c","/b/a","/b/x"],
"s":"vK9xQ2mN7pR4wY6z...","n":"Example"}
```
~150-180 bytes

*Typical (moderate origin, readable structure):*
```
{"origin":"https://auth.example-service.com",
"initiate":"/api/oob/initiate","claim":"/api/oob/claim",
"approve":"/api/oob/approve","complete":"/api/oob/complete",
"sessionId":"vK9xQ2mN7pR4wY6zA3...","displayName":"Example Service"}
```
~280-350 bytes

*Large (enterprise origin, verbose paths, included payload):*
```
{"origin":"https://authentication.corporate-solutions.example.com",
"initiate":"/api/v2/cross-device/binding/initiate",
"claim":"/api/v2/cross-device/binding/claim",
"approve":"/api/v2/cross-device/binding/approve",
"complete":"/api/v2/cross-device/binding/complete",
"sessionId":"vK9xQ2mN7pR4wY6zA3...","displayName":"Corporate Portal",
"payload":"eyJhbW91bnQiOiI0OS45OSJ9"}
```
~550-700 bytes

**QR code capacity (binary mode, Level L error correction):**

| Version | Modules | Capacity | Sufficient for |
|---------|---------|----------|----------------|
| 10 | 57×57 | 271 bytes | Minimal payloads |
| 15 | 77×77 | 412 bytes | Typical payloads |
| 20 | 97×97 | 666 bytes | Large payloads |
| 25 | 117×117 | 958 bytes | Very large payloads |
| 40 | 177×177 | 2,953 bytes | Maximum capacity |

**Conclusion:** Typical payloads fit comfortably in Version 15-20 QR codes. Even "enterprise-scale" URLs with included payloads fit within Version 25. QR capacity is not a practical constraint for this protocol.

**Display considerations:** A Version 20 QR code (97×97 modules) displayed at 4 pixels per module requires 388×388 pixels—easily accommodated in browser UI. Higher versions remain scannable on modern smartphone cameras.

**Conversely, given maximum QR capacity:** Version 40 provides ~2,950 bytes. Subtracting typical overhead (~400 bytes for origin, paths, display name, JSON structure), over 2,500 bytes remain available for session ID and payload. This far exceeds the 128-bit (16 byte) session ID requirement and allows substantial service payloads if needed.

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

The diagram below shows the full ceremony with both codes enabled. When codes are disabled, the corresponding steps are skipped (see Section 5.8 for variations).

```
┌──────────┐   ┌────────────┐   ┌─────────────┐   ┌─────────┐
│ Web Page │   │ User Agent │   │ Companion   │   │ Service │
│          │   │            │   │ Application │   │         │
└────┬─────┘   └─────┬──────┘   └──────┬──────┘   └────┬────┘
     │               │                 │               │
     │ request()     │                 │               │
     ├──────────────>│                 │               │
     │               │                 │               │
     │               │ ─ ─ Display trusted UI ─ ─ ─ ─ ─│
     │               │   (QR + post-negotiate code input) │
     │               │                 │               │
     │               │   Transfer      │               │
     │               │ · · · · · · · · >               │
     │               │  (QR, NFC, etc.)│               │
     │               │                 │               │
     │               │                 │   Initiate    │
     │               │                 ├──────────────>│
     │               │                 │               │
     │               │                 │  [Operation   │
     │               │                 │   happens]    │
     │               │                 │               │
     │               │                 │ approve_token │
     │               │                 │ + post_neg*   │
     │               │                 │<──────────────┤
     │               │                 │               │
     │               │ ─ App shows post-negotiate code*─ ─│
     │               │                 │               │
     │               │   User enters post-negotiate code* │
     │               │                 │               │
     │               │   Claim (with post_neg*)        │
     │               ├────────────────────────────────>│
     │               │     complete_token + post_claim* │
     │               │<────────────────────────────────┤
     │               │                 │               │
     │               │ ─ Display post-claim code*─ ─  │
     │               │                 │               │
     │               │   User enters post-claim code* │
     │               │                 │               │
     │               │                 │    Approve    │
     │               │                 ├──────────────>│
     │               │                 │      OK       │
     │               │                 │<──────────────┤
     │               │                 │               │
     │               │      Complete (poll)            │
     │               ├────────────────────────────────>│
     │               │         result                  │
     │               │<────────────────────────────────┤
     │               │                 │               │
     │   result      │                 │               │
     │<──────────────┤                 │               │

* = optional, service-configurable
```

### 5.2 State Machine (Server-side)

The server maintains the following states for each session:

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

┌─────────┐   initiate    ┌────────────┐  claim (valid   ┌─────────┐
│  EMPTY  │──────────────►│ NEGOTIATED │───post_neg)────►│ CLAIMED │◄─┐
└─────────┘   (success)   └─────┬──────┘                 └────┬────┘  │
                                │                              │       │
                           additional                          │   additional
                           negotiations                        │   claims
                                │               ┌──────────────┴───┐   │
                                ▼               │                  │   │
                          ┌────────────┐  negotiations > 1│        │claims = 1
                          │ NEGOTIATED │  OR claims > 1   │        │negotiations = 1
                          │ (count: N) │  (approve)       │        │code matches
                          └────────────┘        │         │        │(approve)
                                                ▼         ▼        ▼
                                          ┌─────────┐    ┌──────────┐
                                          │ ABORTED │    │ APPROVED │
                                          └─────────┘    └────┬─────┘
                                                              │
                                                              │ complete
                                                              ▼
                                                        ┌───────────┐
                                                        │ COMPLETED │
                                                        └───────────┘
```

**State descriptions:**

| State | Meaning |
|-------|---------|
| EMPTY | No session exists for this session_id |
| NEGOTIATED | App(s) completed operation; approve_token(s) issued (and post_negotiate_code(s) if enabled); awaiting browser claim |
| CLAIMED | Browser(s) claimed (with valid post-negotiate code if enabled); complete_token(s) issued (and post_claim_code(s) if enabled) |
| APPROVED | App approved; exactly one negotiation AND one claim existed; result ready for browser |
| ABORTED | Multiple negotiations OR multiple claims detected; ceremony terminated |
| COMPLETED | Browser retrieved result; cleanup performed |
| EXPIRED | Timeout reached; state discarded |

### 5.3 Phase 1: Initiation

The web page calls `navigator.outOfBandBinding.request()`. The user agent:

1. Generates a cryptographically random session ID (minimum 128 bits entropy)
2. Constructs full endpoint URLs by combining paths with the web page's origin
3. Displays trusted UI with:
   - Transfer mechanism(s) providing the four endpoint URLs, session ID, display name, and any service-provided payload
   - **Post-negotiate code input field** (if the service specified a code format; otherwise skipped)

### 5.4 Phase 2: Out-of-Band Operation (Negotiation)

The user transfers the session parameters to the companion application via their chosen mechanism.

The companion application:

1. Displays the origin and operation details
2. Requests user confirmation to proceed
3. Contacts the service's initiate endpoint with the session ID
4. Performs whatever operation is appropriate--this is outside the protocol's scope
5. Upon completion, receives from the service:
   - An approve token
   - A **post-negotiate code** (if enabled by service; user must enter this into the browser)
   - Post-claim code specification (if enabled by service; character set, length)--see Section 7

The service, upon successful completion of the operation:

1. Generates a cryptographically random approve token (minimum 128 bits)
2. If post-negotiate code is enabled: generates a post-negotiate code according to its chosen specification
3. Stores: `{session_id, result_data, approve_token, [post_negotiate_code], expires_at}`
4. Returns the approve token, optional post-negotiate code, and optional post-claim code specification to the companion application

**Critical:** The service MUST allow multiple negotiations against the same session ID. Each negotiation generates a separate approve token and post-negotiate code. This is essential for multi-negotiation detection (see Section 6).

Failed operations (e.g., authentication failure) do not create any state. An attacker who races to call the initiate endpoint with invalid credentials simply fails; the ceremony is unaffected. If an attacker could successfully complete the operation (e.g., authenticate as the user), that represents a compromise outside this protocol's scope--the attacker can already impersonate the user regardless of this protocol.

If post-negotiate code is enabled, the companion application displays it for the user to enter into the browser. If post-claim code is enabled, the application prepares to receive it (e.g., displaying the appropriate number of input fields for the specified character set).

### 5.5 Phase 3: Claiming

**If post-negotiate code is enabled:** The user reads the post-negotiate code from the companion application and enters it into the browser's trusted UI. The browser then sends a claim request to the claim endpoint with:

- The session ID
- The post-negotiate code

The service validates the post-negotiate code against stored negotiations:

1. If no negotiation exists for this session → respond with "pending"
2. If the post-negotiate code matches a stored negotiation → proceed
3. If the post-negotiate code doesn't match → respond with "invalid_code" error

**If post-negotiate code is disabled:** The browser polls the claim endpoint with just the session ID. The service checks whether a negotiation exists:

1. If no negotiation exists → respond with "pending"
2. If a negotiation exists → proceed

When proceeding:

1. If post-claim code is enabled: generates a post-claim code according to its chosen specification
2. Generates a cryptographically random complete token (minimum 128 bits)
3. Stores: `{complete_token, session_id, [post_claim_code], negotiation_id, expires_at}`
4. Returns the complete token (and post-claim code if enabled) to the user agent

If post-claim code is enabled, the user agent displays it and instructs the user to enter it in the companion application.

**Critical:** The service MUST allow multiple claims against the same session ID (provided each has a valid post-negotiate code, if enabled). Each claim generates a separate complete token and post-claim code. This is essential for attack detection.

### 5.6 Phase 4: Approval

**If post-claim code is enabled:** The user enters the post-claim code into the companion application. The application sends to the approve endpoint:

- The approve token
- The post-claim code

**If post-claim code is disabled:** The companion application automatically sends the approval when the user confirms (no code entry required):

- The approve token

The service verifies:

1. The approve token is valid and the session has not expired
2. **Exactly one negotiation exists** for this session (multi-negotiation check)
3. **Exactly one claim exists** for this session (multi-claim check)
4. If post-claim code is enabled: the post-claim code matches the claim

Outcomes:

- **Zero claims:** Respond with "pending"--user agent hasn't claimed yet
- **One negotiation, one claim (and code matches if enabled):** Mark as approved, respond with success
- **Multiple negotiations:** Respond with "aborted"--potential session fixation attack detected
- **Multiple claims:** Respond with "aborted"--potential session hijacking attack detected

**Note on verification order:** The multi-negotiation check (step 2) and multi-claim check (step 3) can logically precede the post-claim code check (step 4)—if multiple negotiations or claims exist, the ceremony must abort regardless of whether the code matches. However, services may still choose to verify the post-claim code even in abort scenarios for logging or audit purposes.

### 5.7 Phase 5: Completion

The user agent polls the complete endpoint with its complete token. Upon approval, the service returns the result in the requested format.

### 5.8 Security Mode Variations

Services choose their position on the security/UX spectrum by enabling or disabling the two codes:

| Mode | Post-negotiate | Post-claim | User steps | Protection |
|------|----------------|------------|------------|------------|
| **Full** | Enabled | Enabled | QR scan, enter code, enter code, confirm | Session fixation + Session hijacking |
| **Hijack-only** | Disabled | Enabled | QR scan, confirm, enter code | Session hijacking only |
| **Fixation-only** | Enabled | Disabled | QR scan, enter code, confirm | Session fixation only |
| **Minimal** | Disabled | Disabled | QR scan, confirm | Multi-negotiation/multi-claim detection only |

**When to use each mode:**

- **Full:** High-value operations (payments, legal signing, admin access) where the environment may be compromised (public terminals, screen-sharing).
- **Hijack-only:** When the companion app authenticates the user before negotiating (like DigiD), making session fixation impossible.
- **Fixation-only:** When the browser environment is trusted but the network path might be observed.
- **Minimal:** Low-value operations or when other mitigations exist (e.g., short session validity, transaction confirmation emails).

All modes retain the multi-action detection property: if an attacker races the user and both negotiate (or both claim), the ceremony aborts. The codes add the requirement that the user actively confirms their own device's action, preventing scenarios where the attacker acts alone.

---

## 6. The Post-Negotiate Code

The post-negotiate code is an optional security feature that prevents session fixation attacks. When enabled, it provides strong protection against attackers who can observe the user's browser screen. When disabled, the ceremony is shorter but vulnerable to session fixation. This section explains the attack it prevents, how it works, and when services might choose to disable it.

### 6.1 The Attack: Session Fixation via QR Observation

Consider an attacker who can observe the user's browser screen (shoulder-surfing, screen-sharing, camera observation). The attacker sees the QR code. Without additional protection, this attack succeeds:

1. User's browser displays QR code (attacker observes it)
2. Attacker's app scans the QR code and **negotiates as the attacker** (logs in with attacker's credentials)
3. User's app also scans the QR code and negotiates as the user
4. Multi-negotiation detection aborts—but the attacker tries again, racing the user
5. If attacker negotiates first (user hasn't scanned yet), attacker is the only one who negotiated
6. User's browser claims, displays post-claim code (attacker observes it)
7. Attacker enters the post-claim code into their app, approves
8. User's browser completes—**receiving the attacker's session**

The user is now logged in as the attacker. This is a session fixation / login CSRF attack. The attacker didn't steal the user's session—they *gave* the user their own session. Depending on the service, this enables:
- The attacker sees everything the user does (if the attacker can monitor their own account)
- The user's sensitive actions are attributed to the attacker's account
- Financial transfers go to the attacker's account

**Why existing mechanisms don't prevent this:**

- **Multi-claim detection** doesn't help—only the user's browser claims
- **Post-claim code** doesn't help—the attacker observes it and enters it correctly
- **The attacker needs no access to the user's devices**—only visual observation

### 6.2 The Solution: Post-Negotiate Code

The post-negotiate code creates symmetry: just as the post-claim code binds the user's browser to the approval, the post-negotiate code binds the user's app to the claim.

**The flow with post-negotiate code:**

1. User's browser displays QR code **and a post-negotiate code input field**
2. User's app scans QR code, negotiates with service
3. Service returns `post_negotiate_code` to the app (along with `approve_token`)
4. User reads post-negotiate code from app, enters it into browser
5. Browser sends claim request **including the post-negotiate code**
6. Service validates: does the post-negotiate code match? Are there multiple negotiations?
7. If valid, browser receives `complete_token` and `post_claim_code`
8. User enters post-claim code into app, app approves
9. Browser completes, receives result

**Why this defeats the attack:**

If the attacker negotiates first:
- Attacker's app receives post-negotiate code "ABC"
- User's app also negotiates, receives different post-negotiate code "XYZ"
- Multi-negotiation detection triggers—ceremony aborts

If the attacker negotiates and user hasn't scanned yet:
- Attacker's app receives post-negotiate code "ABC"
- User's browser is waiting for post-negotiate code input
- For the attack to succeed, the attacker must enter "ABC" into the user's browser
- But if the attacker can type into the user's browser, all security is already lost

**The critical insight:** An attacker who can only *observe* the user's screen cannot enter the post-negotiate code. They'd need to type on the user's keyboard. If they can do that, they can directly manipulate any authentication mechanism.

### 6.3 Multi-Negotiation Detection

Just as multi-claim detection aborts when multiple browsers claim, multi-negotiation detection aborts when multiple apps negotiate.

**Detection mechanism:**

When the approve endpoint receives a request, the service checks:
1. How many successful negotiations exist for this session ID?
2. If more than one → abort, return `multiple_negotiations` error
3. If exactly one → proceed with post-claim code check

**What triggers multi-negotiation detection:**
- User's app negotiates, then attacker's app also negotiates → 2 negotiations → abort
- Attacker's app negotiates, then user's app negotiates → 2 negotiations → abort

**What doesn't trigger it:**
- Attacker negotiates, user never scans → 1 negotiation → continues
- But then attacker must enter post-negotiate code into user's browser (impossible without keyboard access)

### 6.4 Post-Negotiate Code Specification

The service controls the post-negotiate code format. There are two options for how the web page learns the format:

**Option 1: Web page specifies format directly**

The web page knows the format and tells the browser:

```javascript
navigator.outOfBandBinding.request({
  // ... other fields ...
  postNegotiateCodeSpec: {
    charset: "0-9A-Z",
    length: 4
  }
});
```

**Option 2: Browser fetches format from server**

The web page provides a URL; the browser fetches the specification:

```javascript
navigator.outOfBandBinding.request({
  // ... other fields ...
  postNegotiateCodeSpecEndpoint: "/bind/negotiation-spec"
});
```

The endpoint returns:
```json
{
  "charset": "0-9A-Z",
  "length": 4
}
```

Option 2 is useful when frontend and backend teams are misaligned, or when the service wants centralized control over security parameters.

**Requirements:**

- Character sets follow the same rules as post-claim codes (Section 7.3)
- Length: 1-6 characters (same bounds as post-claim codes)
- The browser displays an input field matching the specification
- The service generates the actual code when the app negotiates

**Recommendations:**
- Use alphanumeric codes (A-Z, 0-9) for higher entropy per character
- Use 3-4 characters for typical operations
- Longer codes for higher-value operations

### 6.5 Timing and Attack Detection

The attack can be detected at different points depending on timing:

**Scenario 1: User negotiates first, attacker negotiates second**
- User's app negotiates → success, receives post-negotiate code
- Attacker's app negotiates → multi-negotiation detected
- Attacker's app receives `multiple_negotiations` error immediately
- User's ceremony continues (only one valid negotiation at approval time)

**Scenario 2: Attacker negotiates first, user negotiates second**
- Attacker's app negotiates → success, receives post-negotiate code
- User's app negotiates → multi-negotiation detected
- User's app receives `multiple_negotiations` error
- User is warned: "Another device attempted this operation. Your environment may be compromised."

**Scenario 3: Attacker negotiates, user never scans**
- Attacker's app negotiates → success
- User's browser waits for post-negotiate code input
- Attacker cannot proceed without typing into user's browser
- Eventually: timeout

In all scenarios, the attack either fails or is detected. The user or attacker learns something went wrong; neither succeeds in binding the wrong session.

### 6.6 Boundary Condition: Attacker Keyboard Access

If an attacker can enter the post-negotiate code into the user's browser (physical keyboard access, remote desktop, malware with input injection), then the post-negotiate code provides no protection. The attacker can:

1. Observe QR code
2. Negotiate as attacker
3. Enter post-negotiate code into user's browser
4. Wait for user's browser to display post-claim code
5. Enter post-claim code into their app
6. Complete the attack

However, **if an attacker can type into the user's browser, all security guarantees collapse regardless of this protocol.** Such an attacker can:
- Fill in password fields
- Click "approve" buttons
- Navigate to any page
- Intercept any authentication mechanism

The post-negotiate code protects against *observation-only* attackers (shoulder-surfing, screen capture, camera surveillance). Attackers with input access require physical security measures, not protocol defenses.

### 6.7 When to Disable the Post-Negotiate Code

The post-negotiate code is optional. Services may disable it to reduce ceremony friction when:

1. **The companion app authenticates the user before negotiating.** If the app requires biometric or PIN verification before communicating with the service (like DigiD), an attacker who scans the QR cannot negotiate as the user—they can only negotiate their own session. The user's app's negotiation is inherently tied to the user's identity.

2. **Session fixation is mitigated by other means.** Some services may have account-level protections (e.g., new device notifications, session anomaly detection) that limit the impact of session fixation.

3. **The ceremony is low-value.** For operations where session fixation risk is acceptable (e.g., linking a low-privilege device, anonymous sessions), the UX benefit may outweigh the security cost.

**Trade-off summary:** Disabling the post-negotiate code removes one user step but makes the protocol vulnerable to session fixation attacks by observation-only attackers. Services must evaluate this trade-off based on their threat model and the value of the operations being bound.

---

## 7. The Post-Claim Code

The post-claim code is an optional security and usability feature. When enabled, it prevents session hijacking attacks (where an attacker claims the user's negotiated result) and adds friction against premature approval. When disabled, the ceremony is shorter but vulnerable to hijacking attacks. This section explains its purpose, how it works, and when services might choose to disable it.

### 7.1 Purpose

The post-claim code serves two distinct purposes:

**Purpose 1: Friction against premature approval.** Without proper friction, users might approve on autopilot—hitting "approve" before their browser has claimed. Requiring a post-claim code creates that friction: users are prompted to look at their browser screen and transcribe what they see. This makes premature approval unlikely (though not impossible—see Purpose 2).

**Purpose 2: Entropy against accidental matching.** Consider this attack scenario:

1. User initiates binding; attacker observes the QR code
2. User's app completes the operation with the service
3. Attacker's browser claims FIRST, receiving post-claim code "47"
4. User (on autopilot) enters a guess before their browser displays anything
5. If the user guesses "47", and only the attacker has claimed, approval succeeds--for the attacker's session

The post-claim code makes this attack improbable. With two digits (100 possibilities), even a user entering randomly has only a 1% chance of matching. With more digits, the probability drops further.

### 7.2 Relationship to Session ID

The **session ID** must be long and cryptographically random (minimum 128 bits) because:
- It identifies the binding session across all participants
- Collision between two independent sessions must be negligible
- An attacker who guesses it could inject themselves into the flow

The **post-claim code** has different requirements:
- It only needs to prevent accidental matching during a brief window
- It operates within a constrained context (the user already has the approve token from completing the operation)
- Usability matters--users must be able to read and type it

Therefore, the post-claim code can be much shorter than the session ID. Two digits provide meaningful protection; more digits provide more.

### 7.3 Service-Configurable Codes

Different services have different security requirements. A forum might be satisfied with a less-secure login than a bank. This proposal allows services to control the post-claim code specification within defined bounds.

**Character set negotiation.** The companion application declares which character sets it supports in the initiate request. The service either accepts one of them or rejects the app entirely.

All compliant companion applications MUST support at least decimal digits (`0-9`). This ensures a baseline for interoperability. Applications MAY support additional character sets:

- `0-9` -- Decimal digits (10 symbols). Mandatory baseline. Familiar, easy to type.
- `1-9` -- Digits excluding zero (9 symbols). Avoids confusion with letter O.
- `A-Z` -- Uppercase letters (26 symbols). More entropy per character.
- `0-9A-Z` -- Alphanumeric (36 symbols). Maximum entropy for short codes.
- Other sets -- Services may define additional character sets appropriate for their user base.

If the service requires a character set the app doesn't support, the service rejects the initiate request with an `unsupported_charset` error. This is intentional: if a service requires higher entropy for security reasons, an app that can't provide it is not secure enough for that service.

The user agent (browser) displays the post-claim code to the user. Browsers have comprehensive Unicode support, so display capability is not a practical constraint. The browser does not need advance knowledge of the character set--it simply renders whatever code the service provides.

**Length.** How many characters in the code. This proposal specifies hard bounds:

- **Minimum: 1 character.** For very low-risk operations where minimal friction is desired.
- **Maximum: 6 characters.** Even with only decimal digits, 6 characters provide 1,000,000 combinations (0.0001% random match probability). Combined with the friction of entering 6 characters, this exceeds what any reasonable threat model would require.

These bounds ensure companion application developers can design UI for a known, bounded range of input fields.

| Length | Digits (10) | Letters (26) | Alphanumeric (36) | Random match probability (digits) |
|--------|-------------|--------------|-------------------|-----------------------------------|
| 1 | 10 | 26 | 36 | 10% |
| 2 | 100 | 676 | 1,296 | 1% |
| 3 | 1,000 | 17,576 | 46,656 | 0.1% |
| 4 | 10,000 | 456,976 | 1,679,616 | 0.01% |
| 5 | 100,000 | 11,881,376 | 60,466,176 | 0.001% |
| 6 | 1,000,000 | 308,915,776 | 2,176,782,336 | 0.0001% |

**Recommendations:**
- Low-risk operations (forum login, newsletter signup): 1-2 characters
- Standard operations (typical authentication): 2-3 characters
- High-value operations (banking, payments): 4-6 characters

**Note:** These bounds are based on practical experience with authentication applications (e.g., DigiD, banking apps). Formal usability research with cognitive science input would strengthen these recommendations.

### 7.4 Protocol Integration

The service communicates the code specification to the companion application in the initiate response:

```json
{
  "approve_token": "...",
  "post_claim_code_spec": {
    "charset": "0-9",
    "length": 2
  }
}
```

The companion application uses this to prepare appropriate UI (e.g., two numeric input boxes with a digit-only keyboard).

The user agent receives the actual code from the claim endpoint and displays it. The user agent does not need to know the specification--it simply displays whatever code the service provides.

### 7.5 Security Considerations

The post-claim code and multi-claim detection work together as an integrated security mechanism. Neither is sufficient alone; both are essential.

**How the mechanisms complement each other:**

- **Multi-claim detection** ensures that if an attacker claims alongside the user, the ceremony aborts. This protects the user *after* their browser has claimed.

- **The post-claim code** makes it unlikely the user approves *before* their browser has claimed. Without friction, a user could approve on autopilot before their browser claims—and if only the attacker has claimed at that moment, the attacker wins. The code provides that friction, and if the user bypasses it by guessing, the entropy provides a backstop.

**The attack the post-claim code mitigates:**

1. User initiates binding; attacker observes the QR code
2. User's app completes the operation with the service
3. Attacker's browser claims FIRST, receiving post-claim code "47"
4. User (on autopilot) approves immediately, guessing or entering a code before looking at their browser
5. If the user happens to enter "47", and only the attacker has claimed, the attacker's session is approved

The post-claim code makes this attack improbable through two mechanisms. First, the friction of entering a code prompts users to look at their browser screen; most will. Second, users who bypass this friction and guess anyway face low odds of matching—with two digits, only 1% chance; with more digits, far less. By the time a user has looked at their screen and read the code, their browser has claimed. At that point, multi-claim detection takes over: if an attacker also claimed, multiple claims exist and approval is rejected.

**Key insight: Once the user's browser has claimed, the protocol is unconditionally safe.** At that point:

- If an attacker has also claimed → multiple claims exist → approval is rejected
- If only the user's browser has claimed → approval succeeds for the user's session

After claiming, the user can enter the code incorrectly, fumble it, take multiple attempts—none of this affects security. The code matching confirms the user is looking at *some* browser that claimed. If multiple browsers claimed (attacker present), the multi-claim check catches it.

**Could an attacker substitute their trusted UI for the user's?**

If an attacker can replace the browser's trusted UI with a fake one displaying the attacker's post-claim code, the user might enter the attacker's code. However, this attack requires the attacker to have control over what the user sees on their own screen—a level of compromise (screen injection, browser takeover) where the attacker has already won regardless of this protocol. No protocol can protect a user whose display is controlled by an attacker.

**The post-claim code also provides psychological assurance:** seeing the same code on browser and app confirms the user is participating in a single, consistent ceremony.

Services should choose code length based on their security requirements. Longer codes provide more entropy against accidental matching (see Section 7.3) and make premature approval less likely. For high-value operations, longer codes are recommended.

### 7.6 When to Disable the Post-Claim Code

The post-claim code is optional. Services may disable it to reduce ceremony friction when:

1. **The browser environment is trusted.** If users access the service only from controlled environments (e.g., enterprise workstations with endpoint security), the risk of an attacker racing to claim is low.

2. **Session hijacking is mitigated by other means.** Some services may require additional confirmation for sensitive operations (e.g., email verification, transaction PINs) that limit the impact of session hijacking.

3. **The ceremony is low-value.** For operations where hijacking risk is acceptable, the UX benefit may outweigh the security cost.

4. **The post-negotiate code is enabled.** When the post-negotiate code is required, the user must enter a code before claiming—which means the user's browser is actively involved. An attacker who races to claim would need to guess the post-negotiate code, making hijacking attacks significantly harder even without the post-claim code.

**Trade-off summary:** Disabling the post-claim code removes one user step but makes the protocol vulnerable to session hijacking attacks and removes the friction against premature approval. Services must evaluate this trade-off based on their threat model.

---

## 8. Security Analysis

### 8.1 Threat Model

**Threats addressed:**

- **Malicious web page:** Attacker controls the initiating page and can execute arbitrary JavaScript
- **Session observer:** Attacker can observe the transfer payload (shoulder-surfing the QR code, intercepting NFC, etc.)
- **Racing attacker:** Attacker attempts to claim or complete before the legitimate user
- **Deceptive content:** Attacker provides misleading display text
- **Session fixation:** Attacker negotiates as themselves before the user scans

**Threats NOT addressed:**

- Compromised user agent or companion application
- Compromised service
- Network attacker who can break TLS
- Physical compromise of user's devices

### 8.2 Binding Integrity

The user agent constructs endpoint URLs using its own knowledge of the page origin. A malicious page at `evil.com` cannot cause the user agent to generate a transfer payload pointing to `legitimate.com`. The companion application receives and displays the true origin.

### 8.3 Phishing Resistance

Even if the web page provides deceptive display text, the protocol prevents cross-origin attacks:

1. The transfer payload contains the true origin (`evil.com`)
2. The companion app shows the true origin
3. All operations occur against the true origin
4. The attacker receives only results from their own service

A phishing page can only "phish" itself. This is the same security model as the web itself.

### 8.4 Session Hijacking Prevention

**Scenario:** Attacker observes the transfer payload and attempts to receive the result.

If the attacker's user agent claims the session, it generates a separate complete token. At approval time, the service detects multiple claims and aborts. The attacker cannot approve because they lack the approve token (held only by the legitimate companion application).

**When post-claim code is enabled:** Even if the attacker claims first and the user enters a code prematurely, the probability of matching the attacker's code is low (see Section 7).

**When post-claim code is disabled:** The protection relies entirely on multi-claim detection. If the attacker races to claim before the user's browser, both claims are recorded and the ceremony aborts. However, if the attacker is the only one to claim (user's browser never claims or claims late), the attack could succeed. Services disabling the post-claim code should understand this reduced protection.

**Detection as a security feature.** Multi-claim detection does more than prevent attacks—it *reveals* them. When a ceremony aborts due to multiple claims, the user learns something important: someone else attempted to claim their session. Given that session IDs have 128+ bits of entropy, accidental collisions are astronomically unlikely. A multi-claim event is a strong signal that the user's environment is compromised—perhaps their screen is being observed, their network is hostile, or malware is intercepting their actions.

This transforms a would-be attack into actionable intelligence. Users can respond appropriately: move to a more secure environment, check for surveillance, or escalate to IT security.

**Note on false positives:** This detection is only reliable if browsers implement session ID generation correctly (minimum 128 bits cryptographic randomness, as specified). A poorly implemented browser using predictable or weak randomness could produce session IDs that collide, causing false multi-claim detections. Browsers MUST follow the entropy requirements in Section 11.2 for multi-claim detection to serve as a reliable compromise indicator.

Additionally, the effective collision probability is even lower than raw entropy suggests. For two independently generated session IDs to cause a false positive, they must:
- Be generated for the **same service** (same origin)
- Be used within the **same time window** (ceremonies expire in 60-120 seconds)

Even if a browser had weak randomness, collisions would only matter for simultaneous ceremonies at the same service—dramatically narrowing the collision space.

### 8.5 Session Fixation Prevention

**Scenario:** Attacker observes the transfer payload and negotiates as *themselves* before the user scans.

This is the "login CSRF" or session fixation attack. The attacker doesn't try to steal the user's session—they try to bind their *own* session to the user's browser. If successful, the user is logged in as the attacker.

**When post-negotiate code is enabled:** The post-negotiate code prevents this attack. When the companion app negotiates, it receives a post-negotiate code. The user must enter this code into the browser before claiming can occur. An attacker who only observes the QR code cannot enter the post-negotiate code—they'd need keyboard access to the user's browser.

**When post-negotiate code is disabled:** The protection relies on multi-negotiation detection and the race dynamics. If both user and attacker negotiate, the ceremony aborts. However, if the attacker negotiates first and the user never scans (or scans late), the user's browser may claim the attacker's negotiated session. Services disabling the post-negotiate code should understand this reduced protection—it's acceptable only when the companion app authenticates the user before negotiating (like DigiD), preventing attackers from negotiating a session the user would accept.

**Detection as a security feature.** Like multi-claim detection, multi-negotiation detection reveals attacks. If both the user and attacker negotiate, the ceremony aborts and the user is warned. A multi-negotiation event signals that someone else scanned the same QR code—a strong indicator of screen observation.

See Section 6 for detailed attack analysis and the boundary condition (keyboard access defeats all authentication).

### 8.6 Trust Assumptions

- User agent and companion application are not compromised
- Service correctly implements the protocol
- All communication uses HTTPS
- Session IDs have minimum 128 bits entropy
- Tokens expire within the configured timeout

### 8.7 Implementation Correctness and the Existing Trust Model

**What if implementations are incorrect?**

Each party has responsibilities. Incorrect implementations degrade security:

| Party | Responsibility | If implemented incorrectly |
|-------|----------------|---------------------------|
| **Browser** | Generate cryptographically random session IDs; render trusted UI that pages cannot manipulate; enforce same-origin | Weak randomness enables collision attacks; manipulable UI enables phishing; broken same-origin enables cross-origin attacks |
| **Companion App** | Display origin clearly; protect approve token; validate TLS | Hidden origin enables phishing; leaked token enables unauthorized approval; broken TLS enables MITM |
| **Service** | Generate cryptographically random tokens; enforce single-use; count claims correctly; enforce expiration | Weak tokens enable guessing; reusable tokens enable replay; broken claim counting defeats attack detection |

**This is the same trust model users already have.**

Users already trust their browser to correctly implement security-critical features: same-origin policy, TLS certificate validation, secure random number generation, and accurate URL display. A browser that fails at any of these is already a security catastrophe, regardless of this protocol.

Users already trust their authenticator apps and password managers to protect secrets, validate TLS, and correctly implement cryptographic operations. A TOTP app with weak random number generation or a password manager that doesn't verify server certificates is already a security catastrophe.

Users already trust services to correctly implement authentication: to hash passwords properly, to generate unpredictable session tokens, to enforce expiration. A service that fails at these is already vulnerable.

**This protocol does not introduce new trust relationships.** It extends existing responsibilities to cover new operations. The browser already must generate secure randomness (for various web platform features); now it also generates session IDs. The companion app already must protect secrets (passwords, TOTP seeds); now it also protects approve tokens. The service already must implement secure session management; now it implements four more endpoints following the same principles.

The security of this protocol degrades gracefully with implementation quality—just like existing web security. A poorly implemented browser is dangerous with or without this protocol. A poorly implemented companion app is dangerous with or without this protocol. This protocol adds surface area, but not new categories of trust.

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
| initiate | App | Register completed operation, receive approve_token (+ post_negotiate_code if enabled) |
| claim | Browser | Register interest in result, receive complete_token (+ post_claim_code if enabled) |
| approve | App | Submit post-claim code if enabled, trigger multi-claim check |
| complete | Browser | Retrieve result after approval |

Detailed request/response formats are in **Appendix A**.

**Wrong code handling.** When the user enters an incorrect post-claim code, the companion application SHOULD allow retry. Wrong code attempts do not affect ceremony state—the user can keep trying until the session expires. This is safe because multi-claim detection, not the post-claim code, provides the security guarantee (see Section 7.5).

Unlimited retries are not a security risk as long as the approve token remains secret between the service and companion application. An attacker who has only observed the QR code cannot attempt confirmations—they lack the approve token. The post-claim code mechanism prevents only the specific race condition described in Section 7.5, which unlimited retries do not affect.

That said, services MAY implement retry limits as defense-in-depth. This provides an additional layer of protection against implementation bugs or unforeseen attack vectors, following the security principle of redundant safeguards. A limit of 5-10 attempts is reasonable; short expiration times (60-120 seconds) make brute-force impractical regardless.

### 11.2 Token and Expiration Requirements

- Session ID: Minimum 128 bits cryptographic randomness
- Approve token: Minimum 128 bits cryptographic randomness
- Complete token: Minimum 128 bits cryptographic randomness
- All tokens: Single-use, server-validated

**Session-level expiration.** The entire binding ceremony has a single expiration time, set by `timeoutSeconds` in the API request. All tokens and state associated with a session share this deadline. After the deadline, all operations on the session fail and all state is discarded.

This design deliberately avoids per-token or per-stage expiration. A single ceremony-wide deadline is simpler to reason about and implement, with far fewer edge cases. Per-token expiration would introduce problematic interleavings--for example, a legitimate claim could expire while an attacker's later claim remains valid, or the approve token could expire between claim and approval. Session-level expiration eliminates these scenarios: either the entire ceremony is within its time budget, or it isn't. The security properties are identical, and the user experience is adequate--users simply see "session expired" rather than confusing partial-failure states.

### 11.3 Accessibility

User agents MUST provide transfer mechanisms usable by people with disabilities:

- Screen reader compatible manual code entry
- Keyboard-only operation
- Sufficient time for completion (configurable timeout)

### 11.4 Ceremony Length

At maximum security, this protocol requires two user-entered codes: the post-negotiate code (app → browser) and the post-claim code (browser → app). Both codes are optional; services choose their position on the security/UX spectrum.

**Comparison with existing systems:**

| System | User steps after QR scan |
|--------|--------------------------|
| DigiD (Netherlands) | Enter 1 code (browser → app), then approve in app |
| WhatsApp Web | Biometric confirmation in app only (no code entry) |
| This protocol (full) | Enter 1 code (app → browser), then enter 1 code (browser → app), then approve in app |
| This protocol (minimal) | Approve in app only (comparable to WhatsApp Web) |

**Service flexibility:**

Services choose their security/UX tradeoff by enabling or disabling each code (see Section 5.8 for the full matrix). A service that:

- **Wants DigiD-like UX** can disable the post-negotiate code (if the app authenticates users before negotiating) and keep the post-claim code
- **Wants WhatsApp-like UX** can disable both codes, relying on multi-action detection alone
- **Handles high-value operations** should enable both codes for maximum protection

**Why both codes exist:**

DigiD's companion app authenticates the user (via PIN or biometric) before communicating with the server. An attacker who scans the QR code cannot negotiate as the user. This protocol makes no such assumption—the negotiation phase may not involve user credentials at all. The post-negotiate code covers this case; the post-claim code covers the symmetric attack on the claiming side.

Services that *do* authenticate users in-app before negotiating can safely disable the post-negotiate code and achieve DigiD-like UX. The protocol's flexibility means services aren't forced into a one-size-fits-all ceremony.

### 11.5 Browser-Server Communication

**Polling is normative.** All compliant services MUST support polling. The browser periodically calls the claim and complete endpoints to check for status updates. This is simple, stateless, firewall-friendly, and works with any HTTP infrastructure.

For ceremonies under two minutes, polling at 1-2 second intervals adds negligible server load and provides adequate responsiveness.

**Push transports are optional.** Services MAY additionally support WebSocket or Server-Sent Events (SSE) for lower-latency updates. These are specified in Appendix B (WebSocket) and Appendix C (SSE). Services that already have push infrastructure may prefer these for a slightly snappier user experience, but they are not required for conformance.

| Mode | Description | Status |
|------|-------------|--------|
| `polling` | Browser periodically calls claim/complete endpoints. | **Normative** (MUST support) |
| `websocket` | Browser opens WebSocket to `statusEndpoint`. | Optional (MAY support) |
| `sse` | Browser opens SSE connection to `statusEndpoint`. | Optional (MAY support) |

The protocol semantics remain identical regardless of transport. If a service advertises a push mode but the browser cannot establish the connection, the browser SHOULD fall back to polling.

### 11.6 State Management

Service state can be in-memory, database, or cache. Expiration must be enforced. Abandoned sessions must not cause resource exhaustion.

---

## 12. Implementation Complexity by Party

A key goal of this protocol is lowering the barrier to secure cross-device binding. Currently, implementing such a system securely requires specialized cryptographic expertise that most development teams don't have. This protocol shifts that burden: the hard problems (multi-claim detection, timing attacks, trusted UI) are solved once in the browser and protocol specification. Services are left with straightforward integration work.

This section provides a concrete assessment of what each party must implement, to help potential adopters understand the effort involved.

### 12.1 What Services Implement (And What They Don't)

For service developers evaluating this protocol, here is a clear breakdown:

**What you implement:**
- **Four HTTPS endpoints** (initiate, claim, approve, complete) — see Appendix A for specifications
- **Short-lived state storage** — session data that expires in 60-120 seconds
- **Your operation logic** — whatever happens when the user performs the operation (authentication, payment approval, document signing, etc.)
- **One JavaScript API call** — to invoke the browser's trusted UI

**What you don't implement:**
- **No companion app.** Any protocol-compliant app works with your service. Password managers, authenticators, or dedicated apps—if they speak the protocol, they work.
- **No trusted UI.** The browser renders the QR code, displays the origin, shows the post-claim code. You provide display text; the browser handles presentation.
- **No session ID generation.** The browser generates cryptographically secure session IDs.
- **No QR code rendering.** The browser handles this.
- **No multi-claim detection logic.** You count claims and reject if more than one—the protocol tells you exactly when and how.
- **No cryptographic protocol design.** The security model is specified. You follow the endpoint contracts.

**If you use a reference container:**

The state management and endpoint logic can be deployed as an off-the-shelf container. In this scenario, your service provides just two simple hooks:

1. **Validate** — A stateless check: "Is this operation request valid?" For authentication: "Are these credentials correct?" For payments: "Is this payment authorized?" No side effects. Your server probably already has this logic.

2. **Flush** — Called only when the entire ceremony succeeds: "Apply the result." For authentication: create a session. For payments: record the transaction. This is work your server would do anyway.

The container handles everything in between: the four endpoints, session state, token generation, claim counting, multi-claim detection, expiration. Your service never sees the protocol complexity.

This splits a typical operation into two decoupled parts:
- **Validation** — stateless, simple, probably already exists
- **Flushing** — only happens on success, is what you'd do anyway

In a traditional flow, these always happen together. With this protocol, the container calls validate early (during the companion app's initiate request), handles the binding ceremony, and only calls flush when everything succeeds. Your service's integration surface is minimal: two hooks it likely already has, plus proxying the endpoints to the container.

A small team can deploy secure cross-device operations without understanding the protocol's internals.

### 12.2 Web Page (Service's JavaScript)

**Complexity: Minimal.**

The web page makes a single API call and handles the result. No state management, no polling logic, no cryptographic operations.

```javascript
// Complete implementation
const result = await navigator.outOfBandBinding.request({
  initiateEndpoint: '/bind/initiate',
  claimEndpoint: '/bind/claim',
  approveEndpoint: '/bind/approve',
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
2. **Trusted UI:** Modal display showing origin, service text, QR code, status, post-claim code
3. **Session ID generation:** Standard cryptographic randomness
4. **QR code encoding:** Standard library operation
5. **Status monitoring:** Polling, WebSocket, or SSE connection (per `statusMode`) for claim and complete phases
6. **Result delivery:** Set cookies or return data to promise

**State held during a ceremony:**
- Session ID
- Four endpoint URLs
- Complete token (after claiming)
- Current phase indicator

All state is local to the ceremony and discarded on completion or cancellation. No persistent storage. No cross-session state.

### 12.4 Companion Application

**Complexity: Moderate, straightforward.**

The companion application implements:

1. **QR code scanning:** Standard library operation
2. **Payload parsing:** JSON decode
3. **Origin display:** Show the service origin to user
4. **Initiate request:** Single HTTP POST
5. **Post-claim code input:** 1-6 character input field
6. **Approve request:** Single HTTP POST
7. **Result display:** Show success/failure

**State held during a ceremony:**
- Endpoint URLs (from QR)
- Session ID (from QR)
- Approve token (from initiate response)
- Post-claim code specification (from initiate response)

All state is local to the ceremony. The app needs no persistent state related to this protocol (authentication credentials are separate and existing).

### 12.5 Service (Server)

The server implements four endpoints and retains short-lived information.

**What the server must retain during a ceremony:**

For each active ceremony (identified by session_id):
- Which apps have negotiated (each with an approve_token and post_negotiate_code)
- The result data to deliver upon success (per negotiation)
- Which browsers have claimed (each with a complete_token and post_claim_code, linked to a negotiation)
- Whether approval has occurred (and for which complete_token)

The entire ceremony shares a single expiration deadline. When the deadline passes, all information for that ceremony can be discarded. There is no per-token or per-stage expiration to track.

**How this information is stored is an implementation choice.** A service might use Redis hashes, SQL tables, in-memory objects, or flat files. The protocol does not prescribe data structures—only what information must be available to implement the endpoint logic.

**Endpoint logic summary:**

| Endpoint | Receives | Does | Returns |
|----------|----------|------|---------|
| initiate | session_id, operation data | Validate operation, store result + approve_token (+ post_negotiate_code if enabled) | approve_token, [post_negotiate_code], [code_spec] |
| claim | session_id, [post_negotiate_code] | Validate post_negotiate_code if enabled, record claim with new complete_token (+ post_claim_code if enabled) | complete_token, [post_claim_code] |
| approve | approve_token, [post_claim_code] | Count negotiations, count claims, verify code if enabled, record approval | status |
| complete | complete_token | If approved, return result | result_data |

**Key properties:**

- **Short-lived:** Ceremonies expire in 60-120 seconds. State is self-cleaning.
- **Bounded:** One ceremony's worth of data per active session. Cannot grow unbounded.
- **Isolated:** Binding state is independent of application logic. Services can implement these endpoints without modifying existing systems.
- **Containerizable:** The logic can be extracted into a standalone service, deployed as a container or sidecar, with integration via internal API.

### 12.6 State Cleanup

All state expires with the ceremony. Successful completion allows eager cleanup, but it's optional—expiration handles abandoned ceremonies automatically.

### 12.7 Deployment Considerations

**Stateless web tier compatibility:** The server state can reside in Redis, memcached, or any shared cache. Multiple server instances can handle the endpoints without sticky sessions.

**Horizontal scaling:** State is keyed by session_id or token. No cross-key coordination required. Standard cache sharding works.

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
| Transfer payload format | Implementation detail | JSON, CBOR, or custom; standardization aids interoperability |
| Status updates | Service choice | polling, websocket, sse |
| Post-claim code | Service-configured | Character set flexible; length 1-6 characters |
| Completion mode | Service choice | cookie, object, bytes, redirect |
| Timeout | Service choice | Per-operation configuration |
| Operation semantics | Service/app choice | Protocol is agnostic to what is being bound |

Future extensions might include:
- Standardized payload format for interoperability
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

Additionally, the Device Grant doesn't have multi-claim detection or post-claim codes--it's vulnerable to the shoulder-surfing attacks this protocol prevents.

### Q: Why does the browser generate the session ID, not the server?

If the server generated the session ID, the web page would need to fetch it before displaying the QR code. This adds a round-trip and, more importantly, means the session ID passes through potentially malicious JavaScript. By having the browser generate it, the session ID never touches untrusted code until after the ceremony completes.

### Q: What about same-device scenarios (app and browser on the same phone)?

The protocol supports this via alternative transfer mechanisms: copy-paste, deep links, or local communication. The security properties remain identical--the multi-claim detection doesn't care whether devices are the same or different.

### Q: What prevents replay attacks?

All tokens (session ID, approve token, complete token) are single-use and short-lived. The server enforces this. Replaying a token after it's been used or expired has no effect.

### Q: Why four endpoints instead of fewer?

Each endpoint has a distinct caller and purpose:

- **initiate**: Called by app → server. Performs the operation.
- **claim**: Called by browser → server. Registers interest in receiving the result.
- **approve**: Called by app → server. Confirms the binding with multi-claim check.
- **complete**: Called by browser → server. Retrieves the result.

Combining them would conflate responsibilities and complicate the security analysis.

### Q: What if the user closes the browser mid-ceremony?

The ceremony times out. The app will receive a timeout or abort when it tries to approve. No state persists beyond the configured timeout. The user simply starts over.

### Q: How does this interact with existing authentication systems?

The protocol is a transport layer that sits alongside existing authentication. A service continues using whatever authentication it has (passwords, passkeys, OAuth, SAML). This protocol just provides a new way to deliver the authentication result to a browser session.

Services can adopt it incrementally--add the four endpoints (or deploy a reference container) and offer it as an additional login method. No dedicated companion app is required; any protocol-compliant third-party app (password managers, authenticators) will work.

### Q: Does a service need to build its own companion app?

No. Any protocol-compliant companion app works with any protocol-compliant service. A user with a general-purpose authenticator or password manager that supports this protocol can use it for all services that implement the protocol's endpoints. Services that already have dedicated apps can continue using them, but new services can rely entirely on third-party companion apps—they only need to implement the server-side endpoints.

### Q: Why allow such short post-claim codes (1 character)?

The post-claim code is integral to the security mechanism—it makes premature approval unlikely and provides a probabilistic backstop if users bypass the friction (see Section 7.5). Even a single character provides meaningful protection: the friction of entering a code prompts most users to look at their browser screen, giving their browser time to claim. For users who guess without looking, longer codes reduce the probability of accidentally matching an attacker's code.

Very low-risk services (e.g., forum login) may accept shorter codes. High-risk services (e.g., banking) should require longer codes. The service decides based on its security requirements.

### Q: Why are there TWO user-entered codes (post-negotiate and post-claim)?

They protect against different attacks with symmetric two-phase verification:

- **Post-negotiate code (app → browser):** Prevents session fixation. An attacker who observes the QR code could negotiate as themselves before the user scans. Without the post-negotiate code, the user's browser would end up with the attacker's session. The post-negotiate code requires the user to enter something from *their own* app, which an observation-only attacker cannot do.

- **Post-claim code (browser → app):** Prevents session hijacking. An attacker who observes the QR code could claim before the user's browser does. Without the post-claim code, the attacker could approve and steal the result. The post-claim code requires the user to enter something from *their own* browser, which an observation-only attacker cannot do.

Both codes create friction that prompts the user to look at the right screen, and both provide entropy against users who don't look. The symmetry is elegant: each code binds the user's device to a phase of the ceremony.

### Q: Why are the codes optional? Doesn't that compromise security?

Security always trades off against usability. This protocol acknowledges that tradeoff and lets services make an informed choice rather than mandating a one-size-fits-all ceremony.

**The codes ARE optional because:**

- Some services have lower security requirements (forum login vs. bank transfer)
- Some services have complementary protections (app authenticates user before negotiating, like DigiD)
- Some deployment environments are trusted (enterprise workstations)
- Forcing maximum security on all services would reduce adoption

**Security degrades gracefully and predictably:**

| Configuration | Protection level | Vulnerable to |
|---------------|------------------|---------------|
| Both codes | Full | Nothing (observation-only attacker) |
| Post-negotiate only | Session fixation only | Session hijacking |
| Post-claim only | Session hijacking only | Session fixation |
| Neither | Multi-action detection | First-to-act attacks |

Services should choose based on their threat model. High-value operations (payments, admin access, legal signing) should use both codes. Low-value operations can use fewer. The protocol provides the infrastructure; services decide the policy. See Section 5.8 for the full security mode matrix.

### Q: What if an attacker can type into my browser?

If an attacker can type into your browser (physical keyboard access, remote desktop, input injection malware), the post-negotiate code provides no protection—nor does any other authentication mechanism. Such an attacker can fill in password fields, click approve buttons, and navigate to any page. This protocol protects against *observation-only* attackers (shoulder-surfing, screen capture, camera surveillance). Physical security threats require physical security measures.

### Q: Is there a challenge-response alternative to multi-claim detection?

No alternative is known that achieves the same properties without additional complexity. Multi-claim detection is simple: the server counts claims and aborts if there's more than one. A challenge-response scheme would require additional round-trips and state. Proposals from security researchers are welcome if a better mechanism exists.

### Q: Can this protocol be polyfilled before browsers implement it natively?

Partially. A JavaScript library could implement most of the flow: generate session IDs, render QR codes, poll endpoints, display post-claim codes. However, a polyfill cannot provide the key security property: a trusted UI that the web page cannot manipulate. In a polyfill, the "trusted" UI is just more JavaScript that a malicious page could spoof or interfere with.

A polyfill would still be valuable for:
- Demonstrating the UX to users and stakeholders
- Allowing services to implement endpoints before browser support
- Testing companion app implementations
- Building ecosystem momentum

But the security guarantees require native browser implementation. The polyfill would be a development and demonstration tool, not a production security mechanism.

### Q: What's the adoption path? Who implements first—services or companion apps?

This is a classic chicken-and-egg problem. The proposal addresses it through several mechanisms:

**For companion apps:** Password managers and authenticators already have users, security expertise, and motivation to differentiate. A popular password manager that supports this protocol gains a compelling feature: "use your existing password manager to securely log into any supporting website." First-mover advantage is significant.

**For services:** The reference container approach (Section 12.1) dramatically lowers the barrier. A service can deploy the protocol with minimal integration work—two hooks (validate and flush) plus endpoint proxying. Early-adopter services gain a marketing story: "more secure than passwords, no app to download."

**Bootstrap strategy:**
1. Publish reference implementations (containers, libraries) so services can adopt cheaply
2. Work with one or two major password managers to commit to companion app support
3. Launch with a small set of services and apps that have coordinated
4. Browser implementation follows demonstrated ecosystem viability

The protocol is designed so that partial adoption still provides value. Even a single companion app supporting the protocol makes it useful for all services that implement the endpoints.

### Q: What if a browser, app, or service implements the protocol incorrectly?

The same thing that happens today when browsers, apps, or services implement security incorrectly: security degrades.

Users already trust their browser to implement same-origin policy, TLS validation, and secure randomness. Users already trust their password manager or authenticator app to protect secrets and validate certificates. Users already trust services to hash passwords and generate unpredictable session tokens. Failures in any of these are already security catastrophes—regardless of this protocol.

This protocol does not introduce new trust relationships. It extends existing responsibilities: the browser generates session IDs (using the same secure randomness it already must have), the companion app protects approve tokens (like it already protects passwords), and the service manages binding state (like it already manages session state).

The security model is the same one the web already operates under. Users choose which browser to use, which password manager to trust, and which services to interact with. This protocol adds functionality to those same trusted parties rather than introducing new ones. See Section 8.7 for detailed analysis.

---

## 16. Future Work

- Formal specification with complete schemas and state machine
- Security analysis and/or formal verification
- Usability studies
- Reference implementations
- Accessibility review
- Standardization of transfer payload format for cross-implementation interoperability
- W3C standardization

---

## 17. Conclusion

This proposal describes infrastructure for secure out-of-band session binding. When a user performs an operation on a companion device, the result is delivered to the correct browser session with guarantees against interception and misdirection.

The protocol is deliberately minimal and agnostic. It doesn't specify what is being bound--that's between the service and companion application. It only ensures the binding is secure.

The web needs this infrastructure. Currently, secure cross-device result delivery requires either platform gatekeeping (limiting who is *allowed* to participate) or specialized expertise (limiting who is *able* to participate). The result is an uneven security landscape where users of smaller services have fewer secure options.

This protocol addresses both barriers. It is platform-neutral—any service can participate without vendor permission. It is implementation-accessible—the hard problems are solved once in the browser, leaving services with straightforward integration. By democratizing access to secure cross-device binding, it makes the web more secure for everyone, not just users of large, well-resourced services.

---

## License

This document is made available under the [W3C Document License](https://www.w3.org/Consortium/Legal/2015/doc-license).

---

## References

1. IETF RFC 2119: Key words for use in RFCs to Indicate Requirement Levels
2. IETF RFC 8628: OAuth 2.0 Device Authorization Grant
3. W3C Web Authentication (WebAuthn) Level 2
4. FIDO Alliance: Client to Authenticator Protocol (CTAP) 2.1
5. OpenID Connect Client-Initiated Backchannel Authentication (CIBA)

---

## Appendix A: HTTP Endpoint Specifications

This appendix provides detailed request/response formats for the four HTTP endpoints.

### A.1 Initiate Endpoint

Called by the companion application after the user completes their operation.

**Request:**
```json
POST {initiateEndpoint}
Content-Type: application/json

{
  "session_id": "a]'k2...",
  "supported_charsets": ["0-9", "0-9A-Z"],
  "operation_data": { ... }
}
```

The `supported_charsets` field declares which post-claim code character sets the companion application can handle. All compliant apps MUST include at least `"0-9"`. The `operation_data` field is service-specific (e.g., authentication assertion, payment details).

**Response (success):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "approve_token": "x7Km9...",
  "post_negotiate_code": "K7M2",        // Optional; omit to disable
  "post_claim_code_spec": {             // Optional; omit to disable
    "charset": "0-9",
    "length": 2
  }
}
```

If `post_negotiate_code` is present, the companion app displays it; the user enters it into the browser before claiming. If omitted, the browser claims without requiring a code from the user.

If `post_claim_code_spec` is present, the service will generate a post-claim code when the browser claims. If omitted, no post-claim code is used.

**Response (operation failure):**
```json
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "operation_failed",
  "error_description": "The requested operation could not be completed"
}
```

The error code and description are service-defined. For authentication, this might be `"authentication_failed"` / `"Invalid credentials"`. For payments, `"payment_declined"` / `"Insufficient funds"`. The protocol does not constrain error semantics.

**Response (unsupported charset):**
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "unsupported_charset",
  "error_description": "App does not support required character set",
  "required_charsets": ["0-9A-Z"]
}
```

The `required_charsets` field indicates which character set(s) the service would accept. This allows the app to display a meaningful error to the user explaining why this service cannot be used.

### A.2 Claim Endpoint

Called by the browser to register interest in receiving the result. If post-negotiate code is enabled, the browser includes the code entered by the user.

**Request (with post-negotiate code):**
```json
GET {claimEndpoint}?session_id=a]'k2...&post_negotiate_code=K7M2

-- or --

POST {claimEndpoint}
Content-Type: application/json

{
  "session_id": "a]'k2...",
  "post_negotiate_code": "K7M2"
}
```

**Request (without post-negotiate code):**
```json
GET {claimEndpoint}?session_id=a]'k2...

-- or --

POST {claimEndpoint}
Content-Type: application/json

{
  "session_id": "a]'k2..."
}
```

**Response (pending - no negotiation yet):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "pending"
}
```

**Response (invalid post-negotiate code):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "error",
  "reason": "invalid_code",
  "message": "Post-negotiate code does not match any negotiation"
}
```

**Response (ready - valid post-negotiate code, or no code required):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ready",
  "complete_token": "j8Lp3...",
  "post_claim_code": "47"           // Optional; omitted if post-claim code disabled
}
```

### A.3 Approve Endpoint

Called by the companion application. If post-claim code is enabled, includes the code entered by the user.

**Request (with post-claim code):**
```json
POST {approveEndpoint}
Content-Type: application/json

{
  "approve_token": "x7Km9...",
  "post_claim_code": "47"
}
```

**Request (without post-claim code):**
```json
POST {approveEndpoint}
Content-Type: application/json

{
  "approve_token": "x7Km9..."
}
```

**Response (pending):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "pending",
  "message": "Browser has not claimed yet"
}
```

**Response (approved):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "approved"
}
```

**Response (aborted - multiple negotiations):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "aborted",
  "reason": "multiple_negotiations",
  "message": "Multiple apps negotiated this session. Possible session fixation attack detected."
}
```

**Response (aborted - multiple claims):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "aborted",
  "reason": "multiple_claims",
  "message": "Multiple browsers claimed this session. Possible session hijacking attack detected."
}
```

**Response (invalid code):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "error",
  "reason": "invalid_code",
  "message": "Post-claim code does not match"
}
```

### A.4 Complete Endpoint

Called by the browser to retrieve the result after approval.

**Request:**
```json
GET {completeEndpoint}?token=j8Lp3...

-- or --

POST {completeEndpoint}
Content-Type: application/json

{
  "complete_token": "j8Lp3..."
}
```

**Response (pending):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "pending"
}
```

**Response (complete - object mode):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "complete",
  "result": { ... }
}
```

The `result` object is service-defined. For authentication, this might contain a session token. For payments, a transaction ID. For document signing, the signature bytes. The protocol does not constrain result semantics.

**Response (complete - cookie mode):**
```json
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict

{
  "status": "complete",
  "redirect_url": "/dashboard"
}
```

**Response (aborted):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "aborted",
  "reason": "multiple_claims"
}
```

---

## Appendix B: WebSocket Protocol

When `statusMode: "websocket"` is specified, the browser establishes a WebSocket connection to `statusEndpoint` instead of polling.

### B.1 Connection

```
GET {statusEndpoint}?session_id=a]'k2...
Upgrade: websocket
Connection: Upgrade
```

### B.2 Server Messages

The server sends JSON messages when state changes:

**Claim ready:**
```json
{
  "type": "claim_ready",
  "complete_token": "j8Lp3...",
  "post_claim_code": "47"
}
```

**Approved:**
```json
{
  "type": "approved"
}
```

**Aborted:**
```json
{
  "type": "aborted",
  "reason": "multiple_claims"
}
```

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

## Appendix C: Server-Sent Events Protocol

When `statusMode: "sse"` is specified, the browser opens an SSE connection to `statusEndpoint` instead of polling.

### C.1 Connection

```
GET {statusEndpoint}?session_id=a]'k2...
Accept: text/event-stream
```

### C.2 Event Stream

The server sends events when state changes:

**Claim ready:**
```
event: claim_ready
data: {"complete_token":"j8Lp3...","post_claim_code":"47"}

```

**Approved:**
```
event: approved
data: {}

```

**Aborted:**
```
event: aborted
data: {"reason":"multiple_claims"}

```

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