I wa# Secure Out-of-Band Session Binding for Web Browsers

**A Protocol Proposal for W3C WICG Discussion**

**Author:** [Your full name]

**Date:** January 2026

**Version:** 0.7 (Draft for public comment)

---

## Abstract

This proposal describes browser-native infrastructure for securely binding out-of-band operations to browser sessions. When a user performs an operation on a companion device (such as a mobile phone), the result of that operation can be securely delivered to a specific browser session, with cryptographic and human-verified guarantees that no attacker can intercept or misdirect it.

The protocol is agnostic to what is being bound. Authentication is one use case; payments, document signing, and access grants are others. The protocol provides the secure binding layer; the semantics of what is bound are determined by the service and companion application.

This is infrastructure, not an authentication protocol.

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

### 1.3 Analogy

Consider postal mail with signature confirmation. The postal service doesn't know or care what's in the envelope—it could be a contract, a check, or a birthday card. The postal service's job is to deliver the envelope to the correct recipient and obtain proof of receipt. The contents and their meaning are between the sender and recipient.

This protocol is the postal service. The service and companion application are the sender; the browser session is the recipient. What's in the envelope is not the protocol's concern.

---

## 2. Design Goals

**Binding security.** A user following the protocol cannot have results misdirected to an attacker's session, even if the attacker controls the web page that initiates the request or observes the session initiation.

**Semantic agnosticism.** The protocol works identically regardless of what is being bound—login tokens, payment confirmations, signatures, or arbitrary data.

**Platform neutrality.** No party requires permission from browser vendors or operating system vendors. A compliant companion application needs only HTTPS and a user interface.

**Simplicity.** The protocol should be easy to understand, implement, and analyze.

**Acceptable user experience.** The manual steps required should be comparable to existing cross-device flows that have demonstrated broad usability (e.g., DigiD in the Netherlands, WhatsApp Web linking).

---

## 3. Participants and Terminology

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
  // Endpoint paths (combined with origin by user agent)
  required USVString initiateEndpoint;
  required USVString claimEndpoint;
  required USVString approveEndpoint;
  required USVString completeEndpoint;

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

5. **Transfer mechanism**: A means to transfer session parameters to the companion application (see Section 5).

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

### 5.2 Phase 1: Initiation

The web page calls `navigator.outOfBandBinding.request()`. The user agent:

1. Generates a cryptographically random session ID (minimum 128 bits entropy)
2. Constructs full endpoint URLs by combining paths with the web page's origin
3. Displays trusted UI with transfer mechanism(s) providing:
   - The four endpoint URLs
   - The session ID
   - The display name and any service-provided payload

### 5.3 Phase 2: Out-of-Band Operation

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

The companion application prepares to receive the confirmation code (e.g., displaying the appropriate number of input fields for the specified character set).

### 5.4 Phase 3: Claiming

The user agent polls the claim endpoint with the session ID. When the service has a completed operation for that session:

1. Generates a confirmation code according to its chosen specification
2. Generates a cryptographically random complete token (minimum 128 bits)
3. Stores: `{complete_token, session_id, confirmation_code, expires_at}`
4. Returns the complete token and confirmation code to the user agent

The user agent displays the confirmation code and instructs the user to enter it in the companion application.

**Critical:** The service MUST allow multiple claims against the same session ID. Each claim generates a separate complete token and confirmation code. This is essential for attack detection.

### 5.5 Phase 4: Approval

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

### 5.6 Phase 5: Completion

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

**POST {initiateEndpoint}**
```
Request:  { session_id, ...operation_specific_data }
Response: { approve_token, confirmation_code_spec: { charset, length }, expires_in }
```

**GET/POST {claimEndpoint}**
```
Request:  { session_id }
Response (pending):   { status: "pending" }
Response (ready):     { complete_token, confirmation_code, expires_in }
```

**POST {approveEndpoint}**
```
Request:  { approve_token, confirmation_code }
Response (pending):   { status: "pending" }  // No claim yet
Response (success):   { status: "approved" }
Response (attacked):  { status: "aborted", reason: "multiple_claims" }
Response (wrong):     { status: "error", reason: "invalid_code" }
```

**GET/POST {completeEndpoint}**
```
Request:  { complete_token }
Response (pending):   { status: "pending" }
Response (ready):     { status: "complete", ...result_data }
```

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

### 10.4 State Management

Service state can be in-memory, database, or cache. Expiration must be enforced. Abandoned sessions must not cause resource exhaustion.

---

## 11. Extensibility Points

This proposal defines the core protocol. Several aspects are intentionally flexible to allow evolution and adaptation:

| Aspect | Flexibility | Notes |
|--------|-------------|-------|
| Transfer mechanism | User agent choice | QR, NFC, Bluetooth, USB, audio, manual entry, deep links |
| Transfer payload format | Implementation detail | JSON, CBOR, or custom; standardization aids interoperability |
| Confirmation code | Service-configured | Character set flexible; length 1-6 characters |
| Completion mode | Web page choice | cookie, object, bytes, redirect |
| Timeout | Web page choice | Per-operation configuration |
| Operation semantics | Service/app choice | Protocol is agnostic to what is being bound |

Future extensions might include:
- Standardized payload format for interoperability
- Additional completion modes
- Bidirectional communication during the operation phase
- Multi-step approval flows

---

## 12. Relationship to Existing Standards

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

## 13. Future Work

- Formal specification with complete schemas and state machine
- Security analysis and/or formal verification
- Usability studies
- Reference implementations
- Accessibility review
- Standardization of transfer payload format for cross-implementation interoperability
- W3C standardization

---

## 14. Conclusion

This proposal describes infrastructure for secure out-of-band session binding. When a user performs an operation on a companion device, the result is delivered to the correct browser session with guarantees against interception and misdirection.

The protocol is deliberately minimal and agnostic. It doesn't specify what is being bound—that's between the service and companion application. It only ensures the binding is secure.

The web needs this infrastructure. Currently, secure cross-device result delivery requires either platform gatekeeping or weak security. This protocol provides both security and openness.

Feedback and collaboration welcome.

---

## About the Author

[Your name] is a software engineer with ten years of experience building web applications. Correspondence welcome at [your contact].

---

## License

CC BY 4.0. Share and adapt with attribution.

---

## References

1. IETF RFC 8628: OAuth 2.0 Device Authorization Grant
2. W3C Web Authentication (WebAuthn) Level 2
3. FIDO Alliance: Client to Authenticator Protocol (CTAP) 2.1
4. OpenID Connect Client-Initiated Backchannel Authentication (CIBA)

---

*End of document.*