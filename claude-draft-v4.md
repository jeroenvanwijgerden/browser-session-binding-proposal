# Secure Out-of-Band Session Binding for Web Browsers

**A Protocol Proposal for W3C WICG Discussion**

**Author:** [Your full name]

**Date:** January 2026

**Version:** 0.4 (Draft for public comment)

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

**Session ID.** A cryptographically random identifier generated by the user agent that uniquely identifies a binding request.

**Confirmation Code.** A short code displayed by the user agent and entered into the companion application, providing human-verified assurance that the user is binding to the correct session.

---

## 4. Proposed API

### 4.1 Design Rationale

This API is intentionally minimal. It provides the binding mechanism; it does not interpret what is being bound. The API returns opaque data to the web page (or sets cookies), and the web page decides what that data means.

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
  required USVString initiateEndpoint;   // Path relative to origin
  required USVString claimEndpoint;
  required USVString approveEndpoint;
  required USVString completeEndpoint;
  required DOMString displayName;        // Human-readable service name
  DOMString operationType;               // Hint for UI: "login", "payment", "signature", etc.
  DOMString description;                 // Optional description shown to user
  BindingCompletionMode completionMode = "object";
  BufferSource payload;                  // Opaque data for companion application
};

enum BindingCompletionMode {
  "cookie",    // User agent sets cookies, navigates to completion URL
  "object",    // Promise resolves with JSON object
  "bytes",     // Promise resolves with ArrayBuffer
  "redirect"   // User agent navigates to service-specified URL
};

dictionary BindingResult {
  required BindingResultStatus status;
  any result;                            // Present for "object" mode on success
  ArrayBuffer bytes;                     // Present for "bytes" mode on success
  DOMString errorMessage;                // Present on error
};

enum BindingResultStatus {
  "success",
  "aborted",    // User cancelled or attack detected
  "timeout",
  "error"
};
```

### 4.3 Example Usage

```javascript
// Request binding (the operation type is just a UI hint)
const binding = await navigator.outOfBandBinding.request({
  initiateEndpoint: '/binding/initiate',
  claimEndpoint: '/binding/claim',
  approveEndpoint: '/binding/approve',
  completeEndpoint: '/binding/complete',
  displayName: 'Example Service',
  operationType: 'login',  // UI hint only; protocol doesn't interpret this
  completionMode: 'object'
});

if (binding.status === 'success') {
  // binding.result contains whatever the service provided
  // The web page interprets this according to its own logic
  console.log('Received:', binding.result);
}
```

### 4.4 User Agent UI Requirements

When `request()` is called, the user agent MUST:

1. Display a modal, trusted UI that the web page cannot manipulate
2. Show the origin prominently
3. Show the `displayName` (labeled as service-provided, not verified by user agent)
4. Display a transfer mechanism (QR code by default) encoding the session parameters
5. Provide accessible alternatives (manual code entry, NFC, etc.)
6. Show status updates during the binding process
7. Allow the user to cancel at any time

The web page MUST NOT be able to:

- Dismiss, hide, or overlay the binding UI
- Access the session ID or internal tokens

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
     │               │ ─ ─ Display QR code ─ ─ ─ ─ ─ ─│
     │               │                 │               │
     │               │      Scan QR    │               │
     │               │<────────────────┤               │
     │               │                 │               │
     │               │                 │   Initiate    │
     │               │                 ├──────────────>│
     │               │                 │               │
     │               │                 │  [Operation   │
     │               │                 │   happens     │
     │               │                 │   here]       │
     │               │                 │               │
     │               │                 │ approve_token │
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
3. Displays trusted UI with a QR code (or alternative) encoding:
   - The four endpoint URLs
   - The session ID
   - The display name and operation type
   - Any payload from the web page

### 5.3 Phase 2: Out-of-Band Operation

The user transfers the session parameters to the companion application (e.g., by scanning the QR code).

The companion application:

1. Displays the origin and operation details
2. Requests user confirmation to proceed
3. Contacts the service's initiate endpoint with the session ID
4. Performs whatever operation is appropriate (authentication, payment approval, signing, etc.)—this is outside the protocol's scope
5. Upon completion, receives an approve token from the service

The service, upon successful completion of the operation:

1. Generates a cryptographically random approve token (minimum 128 bits)
2. Stores: `{session_id, result_data, approve_token, expires_at}`
3. Returns the approve token to the companion application

### 5.4 Phase 3: Claiming

The user agent polls the claim endpoint with the session ID. When the service has a completed operation for that session:

1. Generates a cryptographically random complete token (minimum 128 bits)
2. Generates a confirmation code (default: two decimal digits)
3. Stores: `{complete_token, session_id, confirmation_code, expires_at}`
4. Returns the complete token and confirmation code to the user agent

The user agent displays the confirmation code and instructs the user to enter it in the companion application.

**Critical:** The service MUST allow multiple claims against the same session ID. Each claim generates a separate complete token. This is essential for attack detection.

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

The user agent polls the complete endpoint with its complete token. Upon approval, the service returns the result in the requested format:

- **cookie:** Cookie parameters; user agent sets cookies and navigates
- **object:** JSON data; promise resolves with the data
- **bytes:** Binary data; promise resolves with ArrayBuffer
- **redirect:** URL; user agent navigates

---

## 6. Security Analysis

### 6.1 Threat Model

**Threats addressed:**

- **Malicious web page:** Attacker controls the initiating page and can execute arbitrary JavaScript
- **Session observer:** Attacker can observe the QR code (shoulder-surfing, camera, screen capture)
- **Racing attacker:** Attacker attempts to claim or complete before the legitimate user

**Threats NOT addressed:**

- Compromised user agent or companion application
- Compromised service
- Network attacker who can break TLS
- Physical compromise of user's devices

### 6.2 Binding Integrity

The user agent constructs endpoint URLs using its own knowledge of the page origin. A malicious page at `evil.com` cannot cause the user agent to display a QR code pointing to `legitimate.com`. The companion application shows the true origin.

### 6.3 Session Hijacking Prevention

**Scenario:** Attacker observes QR code and attempts to receive the result instead of the user.

If the attacker's user agent claims the session, it generates a separate complete token. At approval time, the service detects multiple claims and aborts. The attacker cannot approve because they lack the approve token (held only by the legitimate companion application).

**Scenario:** Attacker races to complete before the user.

The attacker cannot complete without a valid complete token, which requires claiming. If both attacker and user claim, multiple claims are detected at approval. If only the attacker claims, the user's claim will trigger detection.

### 6.4 Confirmation Code

The confirmation code provides:

1. **Human verification** that the user agent and companion application are in the same binding session
2. **Interruption of reflexive approval**—users must actively engage rather than blindly approving

The code is a usability feature. The cryptographic guarantee comes from multi-claim detection and token binding.

### 6.5 Trust Assumptions

- User agent and companion application are not compromised
- Service correctly implements the protocol
- All communication uses HTTPS
- Tokens have minimum 128 bits entropy
- Tokens expire within 60-120 seconds

---

## 7. Privacy Considerations

### 7.1 Information Disclosed

The companion application learns which origin the user is binding to. This is inherent and visible to the user.

### 7.2 Tracking Prevention

Session IDs are generated fresh per request and cannot be used for cross-site tracking.

### 7.3 Metadata

An observer of the QR code learns that a binding operation is in progress and the target origin. The session ID alone is not useful without the approve token.

---

## 8. Use Cases

The protocol supports any operation where results must be securely delivered to a browser session. The following are examples, not an exhaustive list.

### 8.1 Authentication

A user logs into a service via their phone. The companion application authenticates the user (by any method—passkey, password, biometric, etc.) and the service provides a session token. The token is bound to the browser session.

The protocol doesn't care how authentication happens. It only ensures the token reaches the correct browser.

### 8.2 Payment Approval

A user approves a payment in their banking app. The service provides a payment confirmation token. The token is bound to the browser session, which can then complete the purchase.

### 8.3 Document Signing

A user signs a document using a key held on their phone. The signature bytes are the result. They are bound to the browser session, which receives the signature.

### 8.4 Access Grants

A user approves an access request (OAuth-style) in a management app. The access token is bound to the browser session.

### 8.5 Device Provisioning

A new device displays a binding request. A management app approves provisioning. The provisioning credentials are bound to the new device's session.

---

## 9. Implementation Considerations

### 9.1 Service Endpoint Specifications

**POST {initiateEndpoint}**
- Request: `{session_id, ...operation_specific_data}`
- Response on success: `{approve_token, expires_in}`
- The service performs whatever operation is appropriate

**GET/POST {claimEndpoint}**
- Request: `{session_id}`
- If no completed operation: `{status: "pending"}`
- If completed: `{complete_token, confirmation_code, expires_in}`

**POST {approveEndpoint}**
- Request: `{approve_token, confirmation_code}`
- If not claimed: `{status: "pending"}`
- If one claim, code matches: `{status: "approved"}`
- If multiple claims: `{status: "aborted", reason: "multiple_claims"}`
- If code wrong: `{status: "error", reason: "invalid_code"}`

**GET/POST {completeEndpoint}**
- Request: `{complete_token}`
- If not approved: `{status: "pending"}`
- If approved: Result according to completion mode

### 9.2 Token Requirements

- Minimum 128 bits cryptographic randomness
- Single-use
- Short-lived (60-120 seconds)
- Stored and validated server-side

### 9.3 Accessibility

User agents MUST provide alternatives to QR codes:

- Manual numeric code entry
- NFC
- Bluetooth
- USB

### 9.4 State Management

Service state can be in-memory, database, or cache. Expiration must be enforced. Abandoned sessions must not cause resource exhaustion.

---

## 10. Relationship to Existing Standards

This protocol operates at a different layer than authentication protocols.

| | This Protocol | FIDO2/WebAuthn | OAuth | CIBA |
|---|---|---|---|---|
| **Purpose** | Secure binding | Authentication | Authorization | Authentication |
| **Scope** | Transport layer | Full auth protocol | Full authz protocol | Full auth protocol |
| **What it specifies** | How to deliver results | How to authenticate | How to authorize | How to authenticate |
| **Agnostic to auth method** | Yes | No (FIDO only) | Partially | No (OIDC) |
| **Platform neutral** | Yes | No | Yes | Yes |

This protocol could be used **alongside** these protocols. For example:

- A companion app authenticates via FIDO2, then this protocol delivers the resulting session token to the browser
- A companion app performs OAuth authorization, then this protocol delivers the access token to the browser

The protocol doesn't replace authentication standards; it provides secure delivery infrastructure that any authentication (or non-authentication) flow can use.

---

## 11. Future Work

- Formal specification with complete schemas and state machine
- Security analysis and/or formal verification
- Usability studies
- Reference implementations (browser polyfill, server library, sample companion app)
- Accessibility review
- W3C standardization

---

## 12. Conclusion

This proposal describes infrastructure for secure out-of-band session binding. The protocol ensures that when a user performs an operation on a companion device, the result is delivered to the correct browser session with guarantees against interception and misdirection.

The protocol is deliberately minimal and agnostic. It doesn't specify what is being bound—that's between the service and companion application. It only ensures the binding is secure.

Authentication is one use case. Payments, signing, access grants, and device provisioning are others. Any operation where "something happened on another device and the browser needs the result" fits this model.

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