# Secure Out-of-Band Credential Delegation for Web Browsers

**A Protocol Proposal for W3C WICG Discussion**

**Author:** [Your full name]

**Date:** January 2026

**Version:** 0.3 (Draft for public comment)

---

## Abstract

Cross-device authentication on the web currently requires platform-specific integrations that concentrate control over which authorization applications may participate. This proposal describes a browser-native protocol for secure out-of-band credential delegation that is agnostic to authentication method, ceremony type, and authorization application. The protocol enables a user to initiate a capability request in a browser session and authorize it from another device, with cryptographic binding and human verification that prevent phishing and session confusion attacks. The design requires no novel cryptography and is simple enough for broad implementation while providing security properties comparable to current platform-coupled solutions.

---

## 1. Problem Statement

When a user wishes to authenticate a web browser session using a credential held on another device—typically a mobile phone—they currently have limited options. Platform-coupled solutions such as FIDO2 hybrid transport require the authorization application to be sanctioned by the browser vendor or operating system. Independent applications cannot participate without platform cooperation.

This coupling has consequences:

- Users are locked into platform ecosystems
- Relying parties cannot offer cross-device authentication without platform blessing
- Government-issued and privacy-focused authorization applications face adoption barriers
- The user agent, historically neutral, becomes a gatekeeper

This proposal describes a protocol that enables any compliant user agent to work with any compliant authorization application to delegate credentials from any compliant relying party. The user agent mediates a secure ceremony without needing to understand or trust the specific authentication method used.

### 1.1 Motivating Example

A Dutch citizen wishes to log into a government service using their DigiD app. With current web standards, this requires either:

1. The DigiD app to integrate with platform-specific APIs (controlled by Apple/Google)
2. A redirect-based flow that leaves the browser context entirely
3. Manual copy-paste of codes between app and browser

None of these provide the seamless, secure experience that should be possible. This proposal enables a fourth option: the user agent displays a trusted UI, the user scans a QR code, authorizes in their app, and the user agent receives credentials—with cryptographic assurance that no attacker intercepted the flow.

---

## 2. Design Goals

The protocol satisfies the following goals:

**Phishing resistance.** A user following the protocol correctly cannot be tricked into authorizing a session controlled by an attacker, even if the attacker controls the web page that initiates the ceremony.

**Authentication-method agnosticism.** The protocol does not specify how the user authenticates to the relying party. Passkeys, passwords, OAuth, government eID schemes, biometrics, hardware tokens—any method works. The protocol concerns itself only with securely routing the result of authentication to the correct browser session.

**Platform neutrality.** No party requires permission from browser vendors or operating system vendors to participate. A compliant authorization application needs only the ability to make HTTPS requests and display a user interface.

**Ceremony agnosticism.** The same protocol structure supports login, payment authorization, document signing, and other ceremonies. The user agent and authorization application display appropriate UI for the ceremony type, but the underlying protocol is identical.

**Simplicity.** The protocol should be easy to understand, implement, and analyze. Complexity is a source of bugs and vulnerabilities.

**Acceptable user experience.** The number of manual steps required should be comparable to existing cross-device authentication flows that have demonstrated broad usability, such as the DigiD application used in the Netherlands since 2017.

---

## 3. Participants and Terminology

The protocol involves four participants:

**Web Page.** The relying party's in-browser code, typically JavaScript. The web page initiates the ceremony by invoking a browser API. The web page is untrusted: it may be malicious, compromised, or simply buggy. The protocol does not rely on the web page behaving correctly.

**User Agent.** The user's web browser, specifically a native, sandboxed user interface that the web page cannot manipulate. The user agent displays trusted UI, generates cryptographic tokens, communicates with the relying party server, and either sets cookies or returns data to the web page upon completion.

**Authorization Application.** A native application running on another device (or potentially the same device). The authorization application receives ceremony parameters out-of-band (for example, by scanning a QR code), facilitates user authentication to the relying party, and approves the credential delegation. Note: this is distinct from a FIDO "authenticator"—the authorization application may use any authentication method internally.

**Relying Party Server.** The relying party's HTTP server. The server implements four endpoints and maintains short-lived state mapping sessions to authenticated identities.

Additional terminology:

**Relying Party (RP).** The service requesting authentication or authorization. The relying party comprises both the web page and server components.

**Ceremony.** A complete protocol run, from initiation to completion.

**Capability.** The credential or authorization that the user agent receives upon successful completion. This may be a session cookie, an access token, a cryptographic signature, or other data.

**Session ID.** A cryptographically random identifier generated by the user agent that uniquely identifies a ceremony instance.

**Confirmation Code.** A short code (for example, two digits) displayed by the user agent and entered by the user into the authorization application, providing human-verified binding between user agent and application.

---

## 4. Proposed API

### 4.1 Relationship to Credential Management API

This proposal extends the web platform's credential management capabilities. While the existing Credential Management API (`navigator.credentials`) handles same-device credential operations, this API addresses out-of-band credential delegation where authorization occurs on a separate device.

The API is namespaced separately (`navigator.credentialDelegation`) rather than extending `navigator.credentials` to maintain clear separation of concerns and avoid confusion with existing WebAuthn flows.

### 4.2 WebIDL Definition

```webidl
partial interface Navigator {
  [SecureContext] readonly attribute CredentialDelegation credentialDelegation;
};

[Exposed=Window, SecureContext]
interface CredentialDelegation {
  Promise<DelegationResult> request(DelegationRequest request);
};

dictionary DelegationRequest {
  required USVString authorizeEndpoint;  // Path relative to origin
  required USVString claimEndpoint;
  required USVString approveEndpoint;
  required USVString finalizeEndpoint;
  required DOMString ceremonyType;       // "login", "payment", "signature", etc.
  required DOMString displayName;        // Human-readable RP name
  DOMString description;                 // Optional ceremony description
  DelegationFinalizationMode finalizationMode = "object";
  BufferSource payload;                  // Opaque data for authorization application
};

enum DelegationFinalizationMode {
  "cookie",    // User agent sets cookies, navigates to completion URL
  "object",    // Promise resolves with JSON object
  "bytes",     // Promise resolves with ArrayBuffer
  "redirect"   // User agent navigates to RP-specified URL
};

dictionary DelegationResult {
  required DelegationResultStatus status;
  any credential;                        // Present for "object" mode on success
  ArrayBuffer bytes;                     // Present for "bytes" mode on success
  DOMString errorMessage;                // Present on error
};

enum DelegationResultStatus {
  "success",
  "aborted",
  "timeout",
  "error"
};
```

### 4.3 Example Usage

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
  // Cookie has been set by user agent
  window.location.href = '/dashboard';
}
```

### 4.4 User Agent UI Requirements

When `request()` is called, the user agent MUST:

1. Display a modal, trusted UI that the web page cannot manipulate or overlay
2. Show the origin of the requesting page prominently
3. Show the `displayName` (clearly labeled as RP-provided, not verified)
4. Display a machine-readable transfer mechanism (QR code by default)
5. Provide alternative transfer mechanisms for accessibility (e.g., manual code entry)
6. Show clear status updates during the ceremony
7. Allow the user to cancel at any time

The user agent MUST NOT allow the web page to:

- Dismiss or hide the delegation UI
- Overlay content on top of the delegation UI
- Read the session ID or tokens before ceremony completion

---

## 5. Protocol Flow

### 5.1 Overview

```
┌──────────┐   ┌────────────┐   ┌───────────┐   ┌──────────┐
│ Web Page │   │ User Agent │   │ Auth App  │   │ RP Server│
└────┬─────┘   └─────┬──────┘   └─────┬─────┘   └────┬─────┘
     │               │                │              │
     │ request()     │                │              │
     ├──────────────>│                │              │
     │               │─────────────────────────────  │
     │               │   Display QR code             │
     │               │                │              │
     │               │         Scan QR code          │
     │               │<───────────────┤              │
     │               │                │              │
     │               │                │  Authorize   │
     │               │                ├─────────────>│
     │               │                │ approve_token│
     │               │                │<─────────────┤
     │               │                │              │
     │               │    Claim (poll)               │
     │               ├──────────────────────────────>│
     │               │    finalize_token + code      │
     │               │<──────────────────────────────┤
     │               │                │              │
     │               │  Display confirmation code    │
     │               │                │              │
     │               │    User enters code in app    │
     │               │                │              │
     │               │                │   Approve    │
     │               │                ├─────────────>│
     │               │                │     OK       │
     │               │                │<─────────────┤
     │               │                │              │
     │               │    Finalize (poll)            │
     │               ├──────────────────────────────>│
     │               │       capability              │
     │               │<──────────────────────────────┤
     │               │                │              │
     │    result     │                │              │
     │<──────────────┤                │              │
     │               │                │              │
```

### 5.2 Initiation Phase

The web page invokes `navigator.credentialDelegation.request()`. The user agent:

1. Constructs full endpoint URLs by combining the provided paths with the web page's origin
2. Generates a cryptographically random session ID (minimum 128 bits entropy)
3. Displays a trusted UI with a QR code encoding:
   - The four endpoint URLs
   - The session ID
   - The ceremony type
   - The display name
   - Any web page-provided payload

### 5.3 Authentication Phase

The user transfers the QR code contents to the authorization application. The application:

1. Displays the ceremony details including the origin
2. Requests user confirmation to proceed
3. Upon confirmation, authenticates the user to the relying party server via the authorize endpoint

The authentication method is outside the scope of this protocol. Upon successful authentication, the relying party server:

1. Generates a cryptographically random approve token (minimum 128 bits entropy)
2. Stores a record: `{session_id, authenticated_identity, approve_token, expires_at}`
3. Returns the approve token to the authorization application

### 5.4 Claiming Phase

The user agent polls the claim endpoint with the session ID. When the relying party server has a matching authentication record:

1. Generates a cryptographically random finalize token (minimum 128 bits entropy)
2. Generates a confirmation code (default: two decimal digits)
3. Stores a record: `{finalize_token, authenticated_identity, confirmation_code, approve_token_ref, expires_at}`
4. Returns the finalize token and confirmation code to the user agent

The user agent displays the confirmation code with instructions for the user to enter it into the authorization application.

**Critical:** The relying party server MUST allow multiple claims against the same session ID. Each claim generates a separate finalize token. The count of claims is checked at approval time.

### 5.5 Approval Phase

The user enters the confirmation code into the authorization application. The application submits to the approve endpoint:

- The approve token
- The confirmation code

The relying party server verifies:

1. The approve token is valid and not expired
2. The confirmation code matches
3. **Exactly one claim exists** for the authenticated session

Based on claim count:

- **Zero claims:** Return error indicating the user agent has not yet claimed
- **One claim with matching code:** Mark as approved, return success
- **Multiple claims:** Return error indicating ceremony aborted due to potential attack

### 5.6 Finalization Phase

The user agent polls the finalize endpoint with the finalize token. When approved, the relying party server returns the capability in the requested format.

---

## 6. Security Analysis

### 6.1 Threat Model

We consider the following attackers:

**Malicious web page.** An attacker controls a web page the user visits. The attacker can execute arbitrary JavaScript in that origin.

**Shoulder-surfer.** An attacker can observe the user's screen, including QR codes displayed by the user agent.

**Network observer.** An attacker can observe encrypted traffic metadata but cannot break TLS.

We do NOT defend against:

- Compromised user agent
- Compromised authorization application
- Compromised relying party server
- Active network attacker who can break TLS
- Physical access to user's devices

### 6.2 Phishing Resistance

A malicious web page cannot use this protocol to gain access to a different origin's accounts.

The user agent constructs endpoint URLs by combining web page-provided paths with the user agent's knowledge of the page origin. If a page at `https://evil.com` requests delegation, the QR code will contain URLs like `https://evil.com/auth/...`. The authorization application displays this origin to the user.

Even if the user fails to notice the wrong origin and authenticates, the attacker gains only a credential for `evil.com`—not for any legitimate relying party.

### 6.3 Session Confusion Resistance

A shoulder-surfer who captures the QR code cannot hijack the session.

**Scenario:** User initiates ceremony. Attacker photographs QR code and races to authenticate first.

**Analysis:** Both attacker and user authenticate, creating two authentication records for the same session ID. When the user's user agent claims, it receives a finalize token. When the attacker's user agent claims, it receives a different finalize token. At approval time, the relying party server detects multiple claims and aborts.

**Scenario:** Attacker claims before legitimate user's user agent.

**Analysis:** Attacker obtains a finalize token and confirmation code. But the attacker cannot approve—approval requires the approve token, which was returned only to the legitimate authorization application. The legitimate user agent will claim separately, triggering multi-claim detection at approval.

### 6.4 Confirmation Code Purpose

The confirmation code provides:

1. **Human-verified binding.** Evidence to the user that their user agent and authorization application are participating in the same ceremony.

2. **Interruption of reflexive approval.** Users conditioned to approve prompts without attention must pause to enter a code.

The confirmation code is not the primary security mechanism—multi-claim detection provides the cryptographic guarantee. The code is a usability feature that reduces user error.

### 6.5 Trust Assumptions

- The user agent correctly implements the protocol and is not compromised
- The authorization application correctly implements the protocol and is not compromised
- The relying party server correctly implements the protocol
- All communication uses HTTPS with valid certificates
- Tokens have sufficient entropy (minimum 128 bits)
- Token expiration is enforced (recommended: 60-120 seconds)

---

## 7. Privacy Considerations

### 7.1 Origin Disclosure

The authorization application necessarily learns which origin the user is authenticating to. This is inherent to the use case and visible to the user.

### 7.2 Cross-Site Tracking

The session ID is generated fresh for each ceremony and not reused. It cannot be used for cross-site tracking.

### 7.3 Relying Party Correlation

The relying party server could correlate authentication requests across time, but this is true of any authentication system and outside the scope of this protocol.

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

The web page initiates with `ceremonyType: "payment"` and a payload containing amount and merchant details. The authorization application displays these details in trusted UI. The user approves knowing the true amount and recipient.

### 8.2 Document Signing

The web page initiates with `ceremonyType: "signature"` and a payload containing a document hash. The authorization application holds the signing key; a compromised page cannot sign without user participation in the application.

### 8.3 Access Delegation

The web page initiates with `ceremonyType: "access"` and a payload describing requested permissions. Similar to OAuth consent, but with the binding guarantees of this protocol.

---

## 9. Implementation Considerations

### 9.1 Relying Party Server Endpoint Specifications

**POST {authorizeEndpoint}**
- Request: `{session_id, ...authentication_data}`
- Success response: `{approve_token, expires_in}`
- The relying party authenticates the user by whatever method it supports

**GET {claimEndpoint}?session_id=...** or **POST {claimEndpoint}** with `{session_id}`
- If no authentication record: `{status: "pending"}`
- If authentication record exists: `{finalize_token, confirmation_code, expires_in}`

**POST {approveEndpoint}**
- Request: `{approve_token, confirmation_code}`
- If not yet claimed: `{status: "pending", message: "await claim"}`
- If exactly one claim and code matches: `{status: "approved"}`
- If multiple claims: `{status: "aborted", message: "multiple claims detected"}`
- If code mismatch: `{status: "error", message: "incorrect code"}`

**GET {finalizeEndpoint}?token=...** or **POST {finalizeEndpoint}** with `{finalize_token}`
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

User agents MUST provide alternatives to QR codes for users who cannot use visual transfer mechanisms. Options include:

- Manual entry of a numeric code
- NFC tap
- Bluetooth discovery
- USB connection

### 9.5 State Management

Relying party server state can reside in memory, database, or distributed cache. Expiration must be enforced. Implementations should prevent resource exhaustion from abandoned ceremonies.

---

## 10. Comparison with Existing Standards

| Feature | This Proposal | FIDO2 Hybrid | OAuth Device Grant | CIBA |
|---------|---------------|--------------|-------------------|------|
| Platform neutral | Yes | No | Yes | Yes |
| User agent trusted UI | Yes | Yes | No | No |
| Multi-claim detection | Yes | N/A | No | No |
| Auth-method agnostic | Yes | No (FIDO only) | Yes | Yes |
| Phishing resistant | Yes | Yes | Weak | Weak |
| Standardized | Proposed | Yes | Yes | Yes |

**FIDO2 Hybrid Transport** provides excellent security but requires platform integration. This proposal achieves similar security properties without platform gatekeeping.

**OAuth Device Authorization Grant (RFC 8628)** solves a related problem (authorizing limited devices) but in the opposite direction and without user agent trusted UI or multi-claim detection.

**CIBA (Client-Initiated Backchannel Authentication)** is tightly coupled to OpenID Connect and lacks user agent trusted UI.

---

## 11. Future Work

- **Formal specification** with precise schemas, error codes, and state machine definition
- **Security proofs** or formal verification of the protocol
- **Usability studies** with general populations
- **Reference implementations** (browser extension polyfill, server library, sample authorization application)
- **Accessibility audit** and recommendations
- **Standardization** via W3C, potentially in coordination with WebAuthn WG

---

## 12. Conclusion

This proposal addresses a genuine gap: secure cross-device credential delegation without platform gatekeeping. The protocol is simple (four endpoints, three token types, one human-verified binding), authentication-method agnostic, and provides strong guarantees against phishing and session confusion.

The urgency comes from converging trends: passkeys concentrating control in platform vendors, government digital identity initiatives requiring browser integration, and regulatory pressure for interoperability. A standardized, open protocol would serve users, relying parties, and the open web.

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
3. W3C Credential Management Level 1
4. FIDO Alliance: Client to Authenticator Protocol (CTAP) 2.1
5. OpenID Connect Client-Initiated Backchannel Authentication (CIBA)

---

*End of document.*