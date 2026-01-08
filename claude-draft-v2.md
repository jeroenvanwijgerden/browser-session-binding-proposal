# Secure Out-of-Band Credential Delegation for Web Browsers

**A Protocol Proposal for W3C WICG Discussion**

**Author:** [Your full name]

**Date:** January 2026

**Version:** 0.2 (Draft for public comment)

---

## Abstract

Cross-device authentication on the web currently requires platform-specific integrations that concentrate control over which authenticators may participate. This proposal describes a browser-native protocol for secure out-of-band credential delegation that is agnostic to authentication method, ceremony type, and authenticator application. The protocol enables a user to initiate a capability request in a browser session and authorize it from another device, with cryptographic binding and human verification that prevent phishing and session confusion attacks. The design requires no novel cryptography and is simple enough for broad implementation while providing security properties comparable to current platform-coupled solutions.

---

## 1. Problem Statement

When a user wishes to authenticate a web browser session using a credential held on another device—typically a mobile phone—they currently have limited options. Platform-coupled solutions such as FIDO2 hybrid transport require the authenticator application to be sanctioned by the browser vendor or operating system. Independent authenticator applications cannot participate without platform cooperation.

This coupling has consequences:

- Users are locked into platform ecosystems
- Services cannot offer cross-device authentication without platform blessing
- Government-issued and privacy-focused authenticator applications face adoption barriers
- The browser, historically a neutral user agent, becomes a gatekeeper

This proposal describes a protocol that enables any compliant browser to work with any compliant authenticator application to delegate credentials from any compliant service. The browser mediates a secure ceremony without needing to understand or trust the specific authentication method used.

### 1.1 Motivating Example

A Dutch citizen wishes to log into a government service using their DigiD app. With current web standards, this requires either:

1. The DigiD app to integrate with platform-specific authenticator APIs (controlled by Apple/Google)
2. A redirect-based flow that leaves the browser context entirely
3. Manual copy-paste of codes between app and browser

None of these provide the seamless, secure experience that should be possible. This proposal enables a fourth option: the browser displays a trusted UI, the user scans a QR code, authenticates in their app, and the browser receives credentials—with cryptographic assurance that no attacker intercepted the flow.

---

## 2. Design Goals

The protocol satisfies the following goals:

**Phishing resistance.** A user following the protocol correctly cannot be tricked into authorizing a session controlled by an attacker, even if the attacker controls the web page that initiates the ceremony.

**Authentication-method agnosticism.** The protocol does not specify how the user authenticates to the service. Passkeys, passwords, OAuth, government eID schemes, biometrics, hardware tokens—any method works. The protocol concerns itself only with securely routing the result of authentication to the correct browser session.

**Platform neutrality.** No party requires permission from browser vendors or operating system vendors to participate. A compliant authenticator application needs only the ability to make HTTPS requests and display a user interface.

**Ceremony agnosticism.** The same protocol structure supports login, payment authorization, document signing, and other ceremonies. The browser and authenticator application display appropriate UI for the ceremony type, but the underlying protocol is identical.

**Simplicity.** The protocol should be easy to understand, implement, and analyze. Complexity is a source of bugs and vulnerabilities.

**Acceptable user experience.** The number of manual steps required should be comparable to existing cross-device authentication flows that have demonstrated broad usability, such as the DigiD application used in the Netherlands since 2017.

---

## 3. Participants and Terminology

The protocol involves four participants:

**Client.** The service's in-browser application, typically JavaScript running in a web page. The client initiates the ceremony by invoking a browser API. The client is untrusted: it may be malicious, compromised, or simply buggy. The protocol does not rely on the client behaving correctly.

**Browser.** The user's web browser, specifically a native, sandboxed user interface that the client cannot manipulate. The browser displays trusted UI, generates cryptographic tokens, communicates with the server, and either sets cookies or returns data to the client upon completion.

**App.** The authenticator application running on another device. The app receives ceremony parameters out-of-band (for example, by scanning a QR code), authenticates the user to the server, and approves the credential delegation.

**Server.** The service's HTTP server. The server implements four endpoints and maintains short-lived state mapping sessions to authenticated identities.

Additional terminology:

**Ceremony.** A complete protocol run, from initiation to completion.

**Capability.** The credential or authorization that the browser receives upon successful completion. This may be a session cookie, an access token, a cryptographic signature, or other data.

**Session ID.** A cryptographically random identifier generated by the browser that uniquely identifies a ceremony instance.

**Confirmation code.** A short code (for example, two digits) displayed by the browser and entered by the user into the app, providing human-verified binding between browser and app.

---

## 4. Proposed API

### 4.1 JavaScript API

```webidl
partial interface Navigator {
  readonly attribute CredentialDelegation credentialDelegation;
};

interface CredentialDelegation {
  Promise<DelegationResult> request(DelegationRequest request);
};

dictionary DelegationRequest {
  required DOMString authorizeEndpoint;  // Path, not full URL
  required DOMString claimEndpoint;
  required DOMString approveEndpoint;
  required DOMString finalizeEndpoint;
  required DOMString ceremonyType;       // "login", "payment", "signature", etc.
  required DOMString displayName;        // Human-readable service name
  DOMString description;                 // Optional ceremony description
  DelegationFinalizationMode finalizationMode = "object";
  ArrayBuffer payload;                   // Opaque data for the app
};

enum DelegationFinalizationMode {
  "cookie",    // Browser sets cookies, navigates to completion URL
  "object",    // Promise resolves with JSON object
  "bytes",     // Promise resolves with ArrayBuffer
  "redirect"   // Browser navigates to server-specified URL
};

dictionary DelegationResult {
  DOMString status;        // "success", "aborted", "timeout", "error"
  any credential;          // For "object" mode
  ArrayBuffer bytes;       // For "bytes" mode
  DOMString errorMessage;  // For "error" status
};
```

### 4.2 Example Usage

```javascript
// Login ceremony
const result = await navigator.credentialDelegation.request({
  authorizeEndpoint: '/auth/delegate/authorize',
  claimEndpoint: '/auth/delegate/claim',
  approveEndpoint: '/auth/delegate/approve',
  finalizeEndpoint: '/auth/delegate/finalize',
  ceremonyType: 'login',
  displayName: 'Example Service',
  finalizationMode: 'cookie'
});

if (result.status === 'success') {
  // Cookie has been set, redirect to authenticated page
  window.location.href = '/dashboard';
}
```

### 4.3 Browser UI Requirements

When `request()` is called, the browser MUST:

1. Display a modal, trusted UI that the page cannot manipulate or overlay
2. Show the origin of the requesting page prominently
3. Show the `displayName` provided by the client (clearly labeled as client-provided)
4. Display a machine-readable transfer mechanism (QR code by default)
5. Provide alternative transfer mechanisms for accessibility (e.g., manual code entry)
6. Show clear status updates during the ceremony
7. Allow the user to cancel at any time

The browser MUST NOT allow the page to:

- Dismiss or hide the delegation UI
- Overlay content on top of the delegation UI
- Read the session ID or tokens before ceremony completion

---

## 5. Protocol Flow

### 5.1 Overview

```
┌────────┐     ┌─────────┐     ┌────────┐     ┌────────┐
│ Client │     │ Browser │     │  App   │     │ Server │
└───┬────┘     └────┬────┘     └───┬────┘     └───┬────┘
    │               │              │              │
    │ request()     │              │              │
    ├──────────────>│              │              │
    │               │──────────────────────────── │
    │               │    Display QR code          │
    │               │              │              │
    │               │        Scan QR code         │
    │               │<─────────────┤              │
    │               │              │              │
    │               │              │  Authorize   │
    │               │              ├─────────────>│
    │               │              │ approve_token│
    │               │              │<─────────────┤
    │               │              │              │
    │               │    Claim (poll)             │
    │               ├────────────────────────────>│
    │               │    finalize_token + code    │
    │               │<────────────────────────────┤
    │               │              │              │
    │               │  Display confirmation code  │
    │               │              │              │
    │               │    User enters code in app  │
    │               │              │              │
    │               │              │   Approve    │
    │               │              ├─────────────>│
    │               │              │     OK       │
    │               │              │<─────────────┤
    │               │              │              │
    │               │    Finalize (poll)          │
    │               ├────────────────────────────>│
    │               │       capability            │
    │               │<────────────────────────────┤
    │               │              │              │
    │    result     │              │              │
    │<──────────────┤              │              │
    │               │              │              │
```

### 5.2 Initiation Phase

The client invokes `navigator.credentialDelegation.request()`. The browser:

1. Constructs full endpoint URLs by combining the provided paths with the client's origin
2. Generates a cryptographically random session ID (minimum 128 bits entropy)
3. Displays a trusted UI with a QR code encoding:
   - The four endpoint URLs
   - The session ID
   - The ceremony type
   - The display name
   - Any client-provided payload

### 5.3 Authentication Phase

The user transfers the QR code contents to the app. The app:

1. Displays the ceremony details including the origin
2. Requests user confirmation to proceed
3. Upon confirmation, authenticates the user to the server via the authorize endpoint

The authentication method is outside the scope of this protocol. Upon successful authentication, the server:

1. Generates a cryptographically random approve token (minimum 128 bits entropy)
2. Stores a record: `{session_id, authenticated_identity, approve_token, expires_at}`
3. Returns the approve token to the app

### 5.4 Claiming Phase

The browser polls the claim endpoint with the session ID. When the server has a matching authentication record:

1. Generates a cryptographically random finalize token (minimum 128 bits entropy)
2. Generates a confirmation code (default: two decimal digits)
3. Stores a record: `{finalize_token, authenticated_identity, confirmation_code, approve_token_ref, expires_at}`
4. Returns the finalize token and confirmation code to the browser

The browser displays the confirmation code with instructions for the user to enter it into the app.

**Critical:** The server MUST allow multiple claims against the same session ID. Each claim generates a separate finalize token. The count of claims is checked at approval time.

### 5.5 Approval Phase

The user enters the confirmation code into the app. The app submits to the approve endpoint:

- The approve token
- The confirmation code

The server verifies:

1. The approve token is valid and not expired
2. The confirmation code matches
3. **Exactly one claim exists** for the authenticated session

Based on claim count:

- **Zero claims:** Return error "browser has not yet claimed; please wait"
- **One claim with matching code:** Mark as approved, return success
- **Multiple claims:** Return error "ceremony aborted: session may be under attack"

### 5.6 Finalization Phase

The browser polls the finalize endpoint with the finalize token. When approved, the server returns the capability in the requested format.

---

## 6. Security Analysis

### 6.1 Threat Model

We consider the following attackers:

**Malicious website.** An attacker controls a website the user visits. The attacker can execute arbitrary JavaScript in that origin.

**Shoulder-surfer.** An attacker can observe the user's screen, including QR codes displayed by the browser.

**Network observer.** An attacker can observe encrypted traffic metadata but cannot break TLS.

We do NOT defend against:

- Compromised browser
- Compromised authenticator app
- Compromised server
- Active network attacker who can break TLS
- Physical access to user's devices

### 6.2 Phishing Resistance

A malicious website cannot use this protocol to gain access to a different origin's accounts.

The browser constructs endpoint URLs by combining client-provided paths with the browser's knowledge of the page origin. If a page at `https://evil.com` requests delegation, the QR code will contain URLs like `https://evil.com/auth/...`. The app displays this origin to the user.

Even if the user fails to notice the wrong origin and authenticates, the attacker gains only a credential for `evil.com`—not for any legitimate service.

### 6.3 Session Confusion Resistance

A shoulder-surfer who captures the QR code cannot hijack the session.

**Scenario:** User initiates ceremony. Attacker photographs QR code and races to authenticate first.

**Analysis:** Both attacker and user authenticate, creating two authentication records for the same session ID. When the user's browser claims, it receives a finalize token. When the attacker's browser claims, it receives a different finalize token. At approval time, the server detects multiple claims and aborts.

**Scenario:** Attacker claims before legitimate user's browser.

**Analysis:** Attacker obtains a finalize token and confirmation code. But the attacker cannot approve—approval requires the approve token, which was returned only to the legitimate app. The legitimate browser will claim separately, triggering multi-claim detection at approval.

### 6.4 Confirmation Code Purpose

The confirmation code provides:

1. **Human-verified binding.** Evidence to the user that their browser and app are participating in the same ceremony.

2. **Interruption of reflexive approval.** Users conditioned to approve prompts without attention must pause to enter a code.

The confirmation code is not the primary security mechanism—multi-claim detection provides the cryptographic guarantee. The code is a usability feature that reduces user error.

### 6.5 Trust Assumptions

- The browser correctly implements the protocol and is not compromised
- The app correctly implements the protocol and is not compromised
- The server correctly implements the protocol
- All communication uses HTTPS with valid certificates
- Tokens have sufficient entropy (minimum 128 bits)
- Token expiration is enforced (recommended: 60-120 seconds)

---

## 7. Privacy Considerations

### 7.1 Origin Disclosure

The app necessarily learns which origin the user is authenticating to. This is inherent to the use case and visible to the user.

### 7.2 Browser Fingerprinting

The session ID is generated fresh for each ceremony and not reused. It cannot be used for cross-site tracking.

### 7.3 Server Correlation

The server could correlate authentication requests across time, but this is true of any authentication system and outside the scope of this protocol.

### 7.4 QR Code Interception

If an attacker intercepts the QR code, they learn:

- The origin the user is authenticating to
- That an authentication ceremony is in progress
- A session ID (which is useless without the approve token)

This is acceptable given the security guarantees provided.

---

## 8. Generalization Beyond Authentication

The protocol structure supports any ceremony where a capability request originates in one context and authorization occurs in a separate, more trusted context.

### 8.1 Payments

The client initiates with `ceremonyType: "payment"` and a payload containing amount and merchant details. The app displays these details in trusted UI. The user approves knowing the true amount and recipient.

### 8.2 Document Signing

The client initiates with `ceremonyType: "signature"` and a payload containing a document hash. The app holds the signing key; a compromised page cannot sign without user participation in the app.

### 8.3 Access Delegation

The client initiates with `ceremonyType: "access"` and a payload describing requested permissions. Similar to OAuth consent, but with the binding guarantees of this protocol.

---

## 9. Implementation Considerations

### 9.1 Server Endpoint Specifications

**POST /authorize**
- Request: `{session_id, ...authentication_data}`
- Success response: `{approve_token, expires_in}`
- The server authenticates the user by whatever method it supports

**GET /claim?session_id=...** or **POST /claim** with `{session_id}`
- If no authentication record: `{status: "pending"}`
- If authentication record exists: `{finalize_token, confirmation_code, expires_in}`

**POST /approve**
- Request: `{approve_token, confirmation_code}`
- If not yet claimed: `{status: "pending", message: "await browser claim"}`
- If exactly one claim and code matches: `{status: "approved"}`
- If multiple claims: `{status: "aborted", message: "multiple claims detected"}`
- If code mismatch: `{status: "error", message: "incorrect code"}`

**GET /finalize?token=...** or **POST /finalize** with `{finalize_token}`
- If not yet approved: `{status: "pending"}`
- If approved: Response varies by finalization mode

### 9.2 Token Requirements

- Minimum 128 bits of cryptographic randomness
- Single-use
- Short-lived (60-120 seconds recommended)
- Stored server-side; tokens are bearer credentials

### 9.3 Rate Limiting

All endpoints should be rate-limited. Failed requests should not reveal whether a token exists (constant-time comparison, generic error messages).

### 9.4 Accessibility

Browsers MUST provide alternatives to QR codes for users who cannot use visual transfer mechanisms. Options include:

- Manual entry of a numeric code
- NFC tap
- Bluetooth discovery
- USB connection

### 9.5 State Management

Server state can reside in memory, database, or distributed cache. Expiration must be enforced. Implementations should prevent resource exhaustion from abandoned ceremonies.

---

## 10. Comparison with Existing Standards

| Feature | This Proposal | FIDO2 Hybrid | OAuth Device Grant | CIBA |
|---------|---------------|--------------|-------------------|------|
| Platform neutral | Yes | No | Yes | Yes |
| Browser-native UI | Yes | Yes | No | No |
| Multi-claim detection | Yes | N/A | No | No |
| Auth-method agnostic | Yes | No (FIDO only) | Yes | Yes |
| Phishing resistant | Yes | Yes | Weak | Weak |
| Standardized | Proposed | Yes | Yes | Yes |

**FIDO2 Hybrid Transport** provides excellent security but requires platform integration. This proposal achieves similar security properties without platform gatekeeping.

**OAuth Device Authorization Grant (RFC 8628)** solves a related problem (authorizing limited devices) but in the opposite direction and without browser-native UI or multi-claim detection.

**CIBA (Client-Initiated Backchannel Authentication)** is tightly coupled to OpenID Connect and lacks browser-native trusted UI.

---

## 11. Future Work

- **Formal specification** with precise schemas, error codes, and state machine definition
- **Security proofs** or formal verification of the protocol
- **Usability studies** with general populations
- **Reference implementations** (browser extension polyfill, server library, sample app)
- **Accessibility audit** and recommendations
- **Standardization** via W3C, potentially in coordination with WebAuthn WG

---

## 12. Conclusion

This proposal addresses a genuine gap: secure cross-device credential delegation without platform gatekeeping. The protocol is simple (four endpoints, three token types, one human-verified binding), authentication-method agnostic, and provides strong guarantees against phishing and session confusion.

The urgency comes from converging trends: passkeys concentrating authenticator control in platform vendors, government digital identity initiatives requiring browser integration, and regulatory pressure for interoperability. A standardized, open protocol would serve users, services, and the open web.

Feedback, critique, and collaboration are welcome.

---

## About the Author

[Your name] is a software engineer with ten years of experience building web applications. Correspondence is welcome at [your contact].

---

## License

This document is released under CC BY 4.0. You may share and adapt this material, provided you give appropriate credit.

---

## References

1. IETF RFC 8628: OAuth 2.0 Device Authorization Grant
2. W3C Web Authentication (WebAuthn) Level 2
3. FIDO Alliance: Client to Authenticator Protocol (CTAP) 2.1
4. OpenID Connect Client-Initiated Backchannel Authentication (CIBA)

---

*End of document.*