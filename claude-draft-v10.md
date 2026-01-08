# Secure Out-of-Band Session Binding for Web Browsers

**A Protocol Proposal for W3C WICG Discussion**

**Author:** [Your full name]

**Date:** January 2026

**Version:** 0.10 (Draft for public comment)

**Disclosure:** The protocol design and core ideas are the author's original work. Large language models were used to identify edge cases, stress-test the security model, and draft this document for a standards audience. The author reviewed and lightly edited the resulting text.

The author is a software engineer, not a security researcher. The protocol design reflects engineering judgment about secure system composition; specific parameter recommendations (entropy requirements, confirmation code lengths, token lifetimes) are based on common practice and should be validated by domain experts.

This disclosure is provided in the interest of transparency.

---

## Abstract

This proposal describes browser-native infrastructure for securely binding out-of-band operations to browser sessions. When a user performs an operation on a companion device (such as a mobile phone), the result of that operation can be securely delivered to a specific browser session, with cryptographic and human-verified guarantees that no attacker can intercept or misdirect it.

The protocol is agnostic to what is being bound. Authentication is one use case; payments, document signing, and access grants are others. The protocol provides the secure binding layer; the semantics of what is bound are determined by the service and companion application.

This is infrastructure, not an authentication protocol.

---

## Executive Summary

**Problem.** Users increasingly need to authorize browser sessions from companion devices (phones, tablets). Current solutions either require platform vendor permission (FIDO2 hybrid) or provide weak security (manual code copy-paste). There is no standardized, secure, platform-neutral way for a browser to receive the result of an operation performed on another device.

**Solution.** A browser-native API that securely binds out-of-band operations to browser sessions. The browser displays a trusted UI with a QR code (or alternative). The user scans it with a companion app, performs an operation (authentication, payment approval, signing, etc.), and the result is delivered to the correct browser session—with cryptographic guarantees against interception.

**Key mechanism.** Multi-claim detection. If an attacker observes the QR code and races to claim the result, the server detects multiple claims and aborts. A human-verified confirmation code provides friction against premature approval.

**Properties:**
- **Phishing-resistant.** Browser enforces same-origin; attackers can only bind to their own origin.
- **Platform-neutral.** Any compliant browser, app, and service can participate. No vendor permission required.
- **Semantically agnostic.** Works for login, payments, signing, access grants—any operation.
- **Simple.** Four HTTP endpoints, three tokens, one confirmation code.

**Implementation.** Minimal for web pages (one API call). Moderate for browsers and apps. Server state is short-lived, bounded, and containerizable.

**Call to action.** This proposal seeks feedback on the protocol design, security model, and API shape. The author invites critique from security researchers, browser engineers, and identity specialists.

---

## 1. Problem Statement

Web applications increasingly need to receive the results of operations performed on other devices. Common examples include:

- Logging in via a mobile app
- Approving a payment on a banking app
- Signing a document with a key held on a phone
- Granting access permissions from a management app

Currently, there is no standardized, secure way for a browser session to receive such results. Existing approaches have significant limitations:

**Platform-coupled solutions** (such as FIDO2 hybrid transport) require the companion application to be sanctioned by the browser vendor or operating system. Independent applications cannot participate.

**Redirect flows** require leaving the browser context entirely, breaking the user's workflow and creating opportunities for session confusion.

**Manual transfer** (copy-paste of codes) is error-prone and provides weak security guarantees.

**Polling without binding** allows attackers who observe a session initiation to race to claim the result.

This proposal describes infrastructure that enables any compliant user agent to securely receive results from any compliant companion application, mediated by any compliant service. The user agent provides trusted UI and cryptographic binding without needing to understand the semantics of what is being transferred.

### 1.1 What This Protocol Is

This protocol is a **secure binding layer**. It answers the question: "How can a browser session securely receive the result of an operation performed elsewhere?"

The protocol guarantees:

1. **Correct delivery.** The result reaches the browser session that initiated the request, not an attacker's session.
2. **User intent.** The user explicitly approved binding the result to this specific session.
3. **Attack detection.** If an attacker attempts to intercept or race the binding, the protocol detects this and aborts.

### 1.2 What This Protocol Is Not

This protocol does **not** specify:

- How the user authenticates (if authentication is involved)
- What credentials or tokens look like
- What the companion application does internally
- The semantics of the operation being performed

Those are determined by the service and companion application. This protocol only provides the secure channel for delivering the result to the browser.

---

## 2. Design Goals

**Binding security.** A user following the protocol cannot have results misdirected to an attacker's session, even if the attacker controls the web page that initiates the request or observes the session initiation.

**Semantic agnosticism.** The protocol works identically regardless of what is being bound—login tokens, payment confirmations, signatures, or arbitrary data.

**Platform neutrality.** No party requires permission from browser vendors or operating system vendors. A compliant companion application needs only HTTPS and a user interface.

**Simplicity.** The protocol should be easy to understand, implement, and analyze.

**Acceptable user experience.** The manual steps required should be comparable to existing cross-device flows that have demonstrated broad usability (e.g., DigiD in the Netherlands, WhatsApp Web linking).

---

## 3. Participants and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119].

**Web Page.** The service's in-browser code. Initiates the binding request. Untrusted—the protocol does not rely on the web page behaving correctly.

**User Agent.** The user's browser, specifically a native, sandboxed UI that the web page cannot manipulate. Generates session identifiers, displays trusted UI, and receives the bound result.

**Companion Application.** A native application on another device (or the same device). Receives session parameters out-of-band, facilitates whatever operation the user performs, and approves the binding. The companion application's internal behavior is outside the scope of this protocol.

**Service.** The backend that the companion application communicates with. Implements four endpoints, maintains short-lived binding state, and provides the result to the user agent upon successful binding.

Additional terminology:

**Binding.** The association between a browser session and the result of an out-of-band operation.

**Result.** Whatever the service provides upon successful binding—a token, a signature, binary data, or instructions to set cookies. The protocol is agnostic to the result's semantics.

**Session ID.** A cryptographically random identifier generated by the user agent that uniquely identifies a binding request. Must be long enough (minimum 128 bits) to make collision between independent sessions negligible.

**Confirmation Code.** A short code displayed by the user agent after claiming and entered by the user into the companion application. See Section 6 for detailed analysis of its purpose and requirements.

---

## 4. Proposed API

### 4.1 Design Rationale

This API is intentionally minimal. It provides the binding mechanism; it does not interpret what is being bound. The API returns opaque data to the web page (or sets cookies), and the web page decides what that data means.

The API allows the web page to provide descriptive text for the trusted UI. This is safe—see Section 4.6.

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
  "aborted",      // User cancelled or multi-claim attack detected
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
// Login example
const result = await navigator.outOfBandBinding.request({
  initiateEndpoint: '/bind/initiate',
  claimEndpoint: '/bind/claim',
  approveEndpoint: '/bind/approve',
  completeEndpoint: '/bind/complete',

  displayName: 'Acme Corp',
  title: 'Sign in to Acme Corp',
  description: 'Open the Acme app on your phone and scan this code. ' +
               'You will be asked to confirm the sign-in.',

  completionMode: 'cookie',
  timeoutSeconds: 90
});

if (result.status === 'success') {
  window.location.href = '/dashboard';
}
```

```javascript
// Payment example
const result = await navigator.outOfBandBinding.request({
  initiateEndpoint: '/bind/initiate',
  claimEndpoint: '/bind/claim',
  approveEndpoint: '/bind/approve',
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

### 4.4 User Agent UI Requirements

When `request()` is called, the user agent MUST display a trusted, modal UI containing:

1. **Origin** (mandatory, user agent-verified): The full origin of the requesting page, prominently displayed. This is the only information the user agent can verify.

2. **Display name** (service-provided): Shown with clear indication it is unverified, e.g., displayed as a claim: `"Acme Corp" (claimed by https://acme.example.com)`

3. **Title** (service-provided, optional): A brief description of the action.

4. **Description** (service-provided, optional): Instructional text explaining what the user should do.

5. **Transfer mechanism**: A means to transfer session parameters to the companion application (see Section 4.5).

6. **Status indicator**: Current phase of the binding process.

7. **Confirmation code area**: After claiming, displays the code with instructions to enter it in the companion application.

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

The transfer payload SHOULD include:
- The four endpoint URLs (as full URLs constructed from origin + paths)
- The session ID
- The display name
- The service-provided payload (if any)

The exact encoding format (JSON, CBOR, custom) is an implementation detail, though standardization would improve interoperability between different companion applications.

### 4.6 Safety of Service-Provided Text

The web page provides the `displayName`, `title`, and `description` shown in the trusted UI. This might seem dangerous—what if a malicious page provides misleading text?

**This is safe because of the protocol's phishing resistance.**

Consider a malicious page at `https://evil.com` that displays:

- displayName: "Your Bank"
- title: "Sign in to Your Bank"
- description: "Scan with Your Bank app to sign in."

The user agent displays this text, but also prominently shows the verified origin: `https://evil.com`. The transfer payload contains URLs pointing to `https://evil.com`. When the companion application receives the payload, it shows `https://evil.com` as the target.

Even if the user ignores all warnings and proceeds:

1. The companion app contacts `https://evil.com`, not the real bank
2. Any operations happen against `evil.com`
3. `evil.com` receives only what it provides itself—not bank credentials

**The blast radius of deceptive text is confined to the service's own origin.** A malicious service can confuse its own users, but cannot use this protocol to phish for credentials belonging to other origins.

This is the same trust model as existing web content: a page can display any text it wants, including fake bank logos. The browser doesn't prevent this because the page can only affect its own origin. This protocol inherits that property.

---

## 5. Protocol Flow

### 5.1 Overview

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
     │               │   (with transfer mechanism)     │
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
     │               │                 │ + code_spec   │
     │               │                 │<──────────────┤
     │               │                 │               │
     │               │        Claim (poll)             │
     │               ├────────────────────────────────>│
     │               │     complete_token + code       │
     │               │<────────────────────────────────┤
     │               │                 │               │
     │               │ ─ Display confirmation code ─ ─ │
     │               │                 │               │
     │               │   User enters code              │
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

┌─────────┐   initiate    ┌───────────┐   claim     ┌─────────┐
│  EMPTY  │──────────────►│ INITIATED │────────────►│ CLAIMED │◄─┐
└─────────┘   (success)   └───────────┘             └────┬────┘  │
                                                         │       │
                                                         │   additional
                                             ┌───────────┴───┐   claims
                                             │               │   │
                                   claims > 1│               │claims = 1
                                   (approve) │               │code matches
                                             │               │(approve)
                                             ▼               ▼
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
| INITIATED | App completed operation; approve_token issued; awaiting browser claim |
| CLAIMED | Browser(s) claimed; complete_token(s) and confirmation_code(s) issued |
| APPROVED | App approved; exactly one claim existed; result ready for browser |
| ABORTED | Multiple claims detected; ceremony terminated |
| COMPLETED | Browser retrieved result; cleanup performed |
| EXPIRED | Timeout reached; state discarded |

### 5.3 Phase 1: Initiation

The web page calls `navigator.outOfBandBinding.request()`. The user agent:

1. Generates a cryptographically random session ID (minimum 128 bits entropy)
2. Constructs full endpoint URLs by combining paths with the web page's origin
3. Displays trusted UI with transfer mechanism(s) providing:
   - The four endpoint URLs
   - The session ID
   - The display name and any service-provided payload

### 5.4 Phase 2: Out-of-Band Operation

The user transfers the session parameters to the companion application via their chosen mechanism.

The companion application:

1. Displays the origin and operation details
2. Requests user confirmation to proceed
3. Contacts the service's initiate endpoint with the session ID
4. Performs whatever operation is appropriate—this is outside the protocol's scope
5. Upon completion, receives from the service:
   - An approve token
   - Confirmation code specification (character set, length)—see Section 6

The service, upon successful completion of the operation:

1. Generates a cryptographically random approve token (minimum 128 bits)
2. Stores: `{session_id, result_data, approve_token, expires_at}`
3. Returns the approve token and confirmation code specification to the companion application

Failed operations (e.g., authentication failure) do not create any state. An attacker who races to call the initiate endpoint with invalid credentials simply fails; the ceremony is unaffected. If an attacker could successfully complete the operation (e.g., authenticate as the user), that represents a compromise outside this protocol's scope—the attacker can already impersonate the user regardless of this protocol.

The companion application prepares to receive the confirmation code (e.g., displaying the appropriate number of input fields for the specified character set).

### 5.5 Phase 3: Claiming

The user agent polls the claim endpoint with the session ID. When the service has a completed operation for that session:

1. Generates a confirmation code according to its chosen specification
2. Generates a cryptographically random complete token (minimum 128 bits)
3. Stores: `{complete_token, session_id, confirmation_code, expires_at}`
4. Returns the complete token and confirmation code to the user agent

The user agent displays the confirmation code and instructs the user to enter it in the companion application.

**Critical:** The service MUST allow multiple claims against the same session ID. Each claim generates a separate complete token and confirmation code. This is essential for attack detection.

### 5.6 Phase 4: Approval

The user enters the confirmation code into the companion application. The application sends to the approve endpoint:

- The approve token
- The confirmation code

The service verifies:

1. The approve token is valid and not expired
2. The confirmation code matches a claim for this session
3. **Exactly one claim exists** for this session

Outcomes:

- **Zero claims:** Respond with "pending"—user agent hasn't claimed yet
- **One claim, code matches:** Mark as approved, respond with success
- **Multiple claims:** Respond with "aborted"—potential attack detected

### 5.7 Phase 5: Completion

The user agent polls the complete endpoint with its complete token. Upon approval, the service returns the result in the requested format.

---

## 6. The Confirmation Code

The confirmation code is a critical usability and security feature. This section explains its purpose, why its requirements differ from the session ID, and how services can configure it.

### 6.1 Purpose

The confirmation code serves two distinct purposes:

**Purpose 1: Friction against premature approval.** Without a code requirement, users might approve on autopilot—hitting "confirm" before their browser has even claimed. The code forces the user to wait until their browser displays something, then actively engage by reading and entering it.

**Purpose 2: Entropy against accidental matching.** Consider this attack scenario:

1. User initiates binding; attacker observes the QR code
2. User's app authenticates with the service
3. Attacker's browser claims FIRST, receiving confirmation code "47"
4. User (on autopilot) enters a guess before their browser displays anything
5. If the user guesses "47", and only the attacker has claimed, approval succeeds—for the attacker's session

The confirmation code makes this attack improbable. With two digits (100 possibilities), even a user entering randomly has only a 1% chance of matching. With more digits, the probability drops further.

### 6.2 Relationship to Session ID

The **session ID** must be long and cryptographically random (minimum 128 bits) because:
- It identifies the binding session across all participants
- Collision between two independent sessions must be negligible
- An attacker who guesses it could inject themselves into the flow

The **confirmation code** has different requirements:
- It only needs to prevent accidental matching during a brief window
- It operates within an already-authenticated context (the user has the approve token)
- Usability matters—users must be able to read and type it

Therefore, the confirmation code can be much shorter than the session ID. Two digits provide meaningful protection; more digits provide more.

### 6.3 Service-Configurable Codes

Different services have different security requirements. A bank authorizing a large transfer should require more friction than a forum login. This proposal allows services to control the confirmation code specification within defined bounds.

The service specifies:

**Character set.** Which characters may appear in the code. Examples:
- `0-9` — Decimal digits (10 symbols). Familiar, easy to type.
- `1-9` — Digits excluding zero (9 symbols). Avoids confusion with letter O.
- `A-Z` — Uppercase letters (26 symbols). More entropy per character.
- `0-9A-Z` — Alphanumeric (36 symbols). Maximum entropy for short codes.
- Localized sets — Services may choose characters appropriate for their user base.

The companion application must be able to display an input method for the chosen character set. Exotic character sets may limit which companion applications can be used.

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

### 6.4 Protocol Integration

The service communicates the code specification to the companion application in the initiate response:

```json
{
  "approve_token": "...",
  "confirmation_code_spec": {
    "charset": "0-9",
    "length": 2
  }
}
```

The companion application uses this to prepare appropriate UI (e.g., two numeric input boxes with a digit-only keyboard).

The user agent receives the actual code from the claim endpoint and displays it. The user agent does not need to know the specification—it simply displays whatever code the service provides.

### 6.5 Security Considerations

The confirmation code is **not** the primary security mechanism. Multi-claim detection provides the cryptographic guarantee.

**Key insight: Once the user's browser has claimed, the protocol is unconditionally safe.** At that point:

- If an attacker has also claimed → multiple claims exist → approval is rejected
- If only the user's browser has claimed → approval succeeds for the user's session

The user can enter the code incorrectly, fumble it, take multiple attempts—none of this affects security. The code matching simply confirms that the user is entering the code displayed by *some* browser that claimed. If multiple browsers claimed (attacker present), the multi-claim check catches it regardless of what code the user enters.

**The confirmation code's only security role is to ensure the user waits until their browser has claimed before approving.** It creates friction that prevents approval before the browser's claim, closing the narrow window in which an attacker could:

1. Claim first (before the user's browser)
2. Receive a confirmation code
3. Hope the user enters that code on autopilot

Once the user's browser has claimed, this attack is impossible—multi-claim detection will abort the ceremony.

The confirmation code also provides psychological assurance: seeing the same code on browser and app confirms they are participating in the same ceremony.

Services should choose code parameters based on how much friction they want to impose. Longer codes make it harder for users to approve prematurely, but the multi-claim mechanism provides the actual security guarantee.

---

## 7. Security Analysis

### 7.1 Threat Model

**Threats addressed:**

- **Malicious web page:** Attacker controls the initiating page and can execute arbitrary JavaScript
- **Session observer:** Attacker can observe the transfer payload (shoulder-surfing the QR code, intercepting NFC, etc.)
- **Racing attacker:** Attacker attempts to claim or complete before the legitimate user
- **Deceptive content:** Attacker provides misleading display text

**Threats NOT addressed:**

- Compromised user agent or companion application
- Compromised service
- Network attacker who can break TLS
- Physical compromise of user's devices

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

**Scenario:** Attacker observes the transfer payload and attempts to receive the result.

If the attacker's user agent claims the session, it generates a separate complete token. At approval time, the service detects multiple claims and aborts. The attacker cannot approve because they lack the approve token (held only by the legitimate companion application).

Even if the attacker claims first and the user enters a code prematurely, the probability of matching the attacker's code is low (see Section 6).

### 7.5 Trust Assumptions

- User agent and companion application are not compromised
- Service correctly implements the protocol
- All communication uses HTTPS
- Session IDs have minimum 128 bits entropy
- Tokens expire within the configured timeout

---

## 8. Privacy Considerations

### 8.1 Information Disclosed

The companion application learns which origin the user is binding to. This is inherent and visible to the user.

### 8.2 Tracking Prevention

Session IDs are generated fresh per request and cannot be used for cross-site tracking.

### 8.3 Transfer Mechanism Privacy

Different transfer mechanisms have different privacy properties:

- **QR codes** can be observed visually
- **NFC/Bluetooth** may be detectable by nearby devices
- **Manual codes** are visible on screen

Services and users should choose mechanisms appropriate for their environment.

---

## 9. Use Cases

The protocol supports any operation where results must be securely delivered to a browser session.

### 9.1 Authentication

A user logs into a service via their phone. The companion application authenticates the user (by any method) and the service provides a session token. The token is bound to the browser session.

### 9.2 Payment Approval

A user approves a payment in their banking app. The service provides a payment confirmation token. The web page receives this and completes the purchase.

### 9.3 Document Signing

A user signs a document using a key held on their phone. The signature bytes are bound to the browser session.

### 9.4 Access Grants

A user approves an access request in a management app. The access token is bound to the browser session.

### 9.5 Device Provisioning

A new device displays a binding request. A management app approves provisioning. Credentials are bound to the new device's session.

---

## 10. Implementation Considerations

### 10.1 Service Endpoint Specifications

The service implements four HTTP endpoints. A summary:

| Endpoint | Caller | Purpose |
|----------|--------|---------|
| initiate | App | Register completed operation, receive approve_token |
| claim | Browser | Register interest in result, receive complete_token + confirmation_code |
| approve | App | Submit confirmation code, trigger multi-claim check |
| complete | Browser | Retrieve result after approval |

Detailed request/response formats are in **Appendix A**.

**Wrong code handling.** When the user enters an incorrect confirmation code, the companion application SHOULD allow retry. Services MAY implement retry limits, though short expiration times (60-120 seconds) make brute-force impractical. Wrong code attempts do not affect ceremony state—the user can keep trying until the session expires. This is safe because multi-claim detection, not the confirmation code, provides the security guarantee (see Section 6.5).

### 10.2 Token Requirements

- Session ID: Minimum 128 bits cryptographic randomness
- Approve token: Minimum 128 bits cryptographic randomness
- Complete token: Minimum 128 bits cryptographic randomness
- All tokens: Single-use, short-lived (respect configured timeout), server-validated

### 10.3 Accessibility

User agents MUST provide transfer mechanisms usable by people with disabilities:

- Screen reader compatible manual code entry
- Keyboard-only operation
- Sufficient time for completion (configurable timeout)

### 10.4 Browser-Server Communication

The service chooses how the browser receives status updates via the `statusMode` parameter:

| Mode | Description | See |
|------|-------------|-----|
| `polling` (default) | Browser periodically calls claim/complete endpoints. Simple, stateless, firewall-friendly. | Appendix A |
| `websocket` | Browser opens WebSocket to `statusEndpoint`. Server pushes updates. | Appendix B |
| `sse` | Browser opens SSE connection to `statusEndpoint`. Server pushes updates. | Appendix C |

For ceremonies under two minutes, polling at 1-2 second intervals adds negligible load. WebSocket and SSE are more efficient for services that already have that infrastructure.

The protocol semantics remain identical regardless of transport. The service picks the mode that matches its infrastructure; if frontend and backend don't match, the ceremony fails—that's the service's responsibility.

### 10.5 State Management

Service state can be in-memory, database, or cache. Expiration must be enforced. Abandoned sessions must not cause resource exhaustion.

---

## 11. Implementation Complexity by Party

This section provides a concrete assessment of what each party must implement, to help potential adopters understand the effort involved.

### 11.1 Web Page (Service's JavaScript)

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

### 11.2 User Agent (Browser)

**Complexity: Moderate, but well-defined.**

The user agent implements:

1. **API surface:** One method (`request()`) with straightforward parameters
2. **Trusted UI:** Modal display showing origin, service text, QR code, status, confirmation code
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

### 11.3 Companion Application

**Complexity: Moderate, straightforward.**

The companion application implements:

1. **QR code scanning:** Standard library operation
2. **Payload parsing:** JSON decode
3. **Origin display:** Show the service origin to user
4. **Initiate request:** Single HTTP POST
5. **Confirmation code input:** 1-6 character input field
6. **Approve request:** Single HTTP POST
7. **Result display:** Show success/failure

**State held during a ceremony:**
- Endpoint URLs (from QR)
- Session ID (from QR)
- Approve token (from initiate response)
- Confirmation code specification (from initiate response)

All state is local to the ceremony. The app needs no persistent state related to this protocol (authentication credentials are separate and existing).

### 11.4 Service (Server)

**Complexity: Moderate, but containerizable.**

The server implements four endpoints and maintains short-lived state. This is the most complex component, but the complexity is bounded and isolatable.

**State structures:**

```
initiated_sessions: {
  session_id → { result_data, approve_token, expires_at }
}

claims: {
  session_id → [ { complete_token, confirmation_code, expires_at }, ... ]
}

approvals: {
  complete_token → { result_data, expires_at }
}
```

**Key properties:**

- **Short-lived:** All entries expire in 60-120 seconds. State is self-cleaning.
- **Bounded:** One entry per active ceremony. Cannot grow unbounded.
- **Isolated:** The binding state is independent of application logic. Services can implement the four endpoints without modifying their existing authentication system.
- **Containerizable:** The binding logic can be extracted into a standalone service. A service could deploy a reference implementation (as a container, sidecar, or library) and integrate via internal API. The binding service knows nothing about the application's authentication—it just manages tokens and state.

**Endpoint logic summary:**

| Endpoint | Receives | Does | Returns |
|----------|----------|------|---------|
| initiate | session_id, operation data | Process operation, store initiated_sessions entry | approve_token, code_spec |
| claim | session_id | If initiated, create claims entry | complete_token, confirmation_code |
| approve | approve_token, code | Verify code, check claim count, create approvals entry | status |
| complete | complete_token | If approved, return result | result_data |

### 11.5 State Cleanup

All state is self-expiring. Additionally, successful completion allows eager cleanup:

- On successful approval: Remove related entries from `initiated_sessions` and `claims`
- On successful completion: Remove entry from `approvals`

Abandoned ceremonies (user cancels, timeout) require no explicit cleanup—expiration handles it.

### 11.6 Deployment Considerations

**Stateless web tier compatibility:** The server state can reside in Redis, memcached, or any shared cache. Multiple server instances can handle the endpoints without sticky sessions.

**Horizontal scaling:** State is keyed by session_id or token. No cross-key coordination required. Standard cache sharding works.

**Reference implementation potential:** The binding protocol is sufficiently isolated that a reference implementation could be published as:
- A library (Node.js, Python, Go, etc.)
- A Docker container exposing the four endpoints
- A cloud function template

Services would integrate by proxying the four endpoints to this component and providing a callback for the actual authentication logic.

---

## 12. Extensibility Points

This proposal defines the core protocol. Several aspects are intentionally flexible to allow evolution and adaptation:

| Aspect | Flexibility | Notes |
|--------|-------------|-------|
| Transfer mechanism | User agent choice | QR, NFC, Bluetooth, USB, audio, manual entry, deep links |
| Transfer payload format | Implementation detail | JSON, CBOR, or custom; standardization aids interoperability |
| Status updates | Service choice | polling, websocket, sse |
| Confirmation code | Service-configured | Character set flexible; length 1-6 characters |
| Completion mode | Service choice | cookie, object, bytes, redirect |
| Timeout | Service choice | Per-operation configuration |
| Operation semantics | Service/app choice | Protocol is agnostic to what is being bound |

Future extensions might include:
- Standardized payload format for interoperability
- Additional completion modes
- Bidirectional communication during the operation phase
- Multi-step approval flows

---

## 13. Relationship to Existing Standards

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

## 14. Anticipated Questions

### Q: Why not extend WebAuthn or FIDO2 instead of creating a new protocol?

WebAuthn specifies *how to authenticate* using public-key cryptography. This protocol specifies *how to deliver results* to a browser session. They operate at different layers and are complementary.

More practically: WebAuthn's hybrid transport requires platform integration (the authenticator must be recognized by the OS or browser). This protocol is platform-neutral—any app can participate without vendor permission. A companion app could use WebAuthn internally and then use this protocol to deliver the resulting session token.

### Q: Why not use CIBA (Client-Initiated Backchannel Authentication)?

CIBA is tightly coupled to OpenID Connect and specifies authentication semantics. This protocol is agnostic—it works for authentication, payments, signing, or any operation. CIBA also lacks browser-native trusted UI; it relies on out-of-band notification mechanisms that vary by implementation.

### Q: Why not use OAuth Device Authorization Grant (RFC 8628)?

The Device Grant solves the opposite problem: authorizing a *limited-input device* (like a TV) by having the user authenticate on a *full browser*. This protocol delivers results *to* a browser from a companion device. The direction is reversed.

Additionally, the Device Grant doesn't have multi-claim detection or confirmation codes—it's vulnerable to the shoulder-surfing attacks this protocol prevents.

### Q: Why does the browser generate the session ID, not the server?

If the server generated the session ID, the web page would need to fetch it before displaying the QR code. This adds a round-trip and, more importantly, means the session ID passes through potentially malicious JavaScript. By having the browser generate it, the session ID never touches untrusted code until after the ceremony completes.

### Q: What about same-device scenarios (app and browser on the same phone)?

The protocol supports this via alternative transfer mechanisms: copy-paste, deep links, or local communication. The security properties remain identical—the multi-claim detection doesn't care whether devices are the same or different.

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

Services can adopt it incrementally—add the four endpoints, update the app, and offer it as an additional login method.

### Q: Why allow such short confirmation codes (1 character)?

The confirmation code is friction, not the security mechanism. Multi-claim detection provides the cryptographic guarantee. Very low-risk services (e.g., forum login) may prefer minimal friction. High-risk services (e.g., banking) can require longer codes. The service decides based on its risk tolerance.

### Q: Is there a challenge-response alternative to multi-claim detection?

No alternative is known that achieves the same properties without additional complexity. Multi-claim detection is simple: the server counts claims and aborts if there's more than one. A challenge-response scheme would require additional round-trips and state. Proposals from security researchers are welcome if a better mechanism exists.

---

## 15. Future Work

- Formal specification with complete schemas and state machine
- Security analysis and/or formal verification
- Usability studies
- Reference implementations
- Accessibility review
- Standardization of transfer payload format for cross-implementation interoperability
- W3C standardization

---

## 16. Conclusion

This proposal describes infrastructure for secure out-of-band session binding. When a user performs an operation on a companion device, the result is delivered to the correct browser session with guarantees against interception and misdirection.

The protocol is deliberately minimal and agnostic. It doesn't specify what is being bound—that's between the service and companion application. It only ensures the binding is secure.

The web needs this infrastructure. Currently, secure cross-device result delivery requires either platform gatekeeping or weak security. This protocol provides both security and openness.

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
  "operation_data": { ... }
}
```

The `operation_data` field is service-specific (e.g., authentication assertion, payment details).

**Response (success):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "approve_token": "x7Km9...",
  "confirmation_code_spec": {
    "charset": "0-9",
    "length": 2
  },
  "expires_in": 120
}
```

**Response (failure):**
```json
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "authentication_failed",
  "error_description": "Invalid credentials"
}
```

### A.2 Claim Endpoint

Called by the browser to register interest in receiving the result.

**Request:**
```json
GET {claimEndpoint}?session_id=a]'k2...

-- or --

POST {claimEndpoint}
Content-Type: application/json

{
  "session_id": "a]'k2..."
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

**Response (ready):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ready",
  "complete_token": "j8Lp3...",
  "confirmation_code": "47",
  "expires_in": 120
}
```

### A.3 Approve Endpoint

Called by the companion application with the confirmation code.

**Request:**
```json
POST {approveEndpoint}
Content-Type: application/json

{
  "approve_token": "x7Km9...",
  "confirmation_code": "47"
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

**Response (aborted - multiple claims):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "aborted",
  "reason": "multiple_claims",
  "message": "Multiple browsers claimed this session. Possible attack detected."
}
```

**Response (invalid code):**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "error",
  "reason": "invalid_code",
  "message": "Confirmation code does not match"
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
  "result": {
    "session_token": "eyJhbG...",
    "user_id": "12345"
  }
}
```

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
  "confirmation_code": "47",
  "expires_in": 120
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
data: {"complete_token":"j8Lp3...","confirmation_code":"47","expires_in":120}

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