January 2026. I propose an extension of the specification for web browers to provide a standardized, highly secure yet acceptably ergonomic way for cross-device authentication, where the browser is completely agnostic of 1) the method of authentication (password-based, passkey-based; anything), 2) the cross-device authentication application used, and 3) the service that is being logged into. This would make cross-device login in web browsers in line with an Open Web, regardless of the degree to which any chosen authentication protocol is in line with the Open Web.

A webpage initiates a login flow by the browser. The browser handles the login flow completely sandboxed from the webpage. When the login flow has completed (resulting in a success or a failure), as was chosen by the webpage upon initiation, the browser either sets an authentication cookie and redirects, or exposes authentication data to the webpage and resumes execution of the webpage.

When starting a login flow, the browser provides the user with a native, trusted UI. It exposes 


This is particularly interesting given the rise of passkeys, which currently do not allow for sovereign cross-device authentication. Any authentication protocol would be usable for cross-device authentication with any combination of three compliant parties being a browser, a cross-device passkey authentication application and a remote service (which would be logged in to). The proposed extension would  the protocol would allow passkeys (and any other authentical protocol) to be more in-line with an Open Web, whithout compromising on safety.

The protocol makes impossible both phishing and over-the-shoulder attacks, while optionally making impossible cross-site scripting attacks. A cross-device login using this protocol would require the user to perform as many manual steps as  for cross-device login using the DigiD authentication app, which has been a proven concept for the general population in The Netherlands for over eight years, since March 2017. For a service's software developers, the browser would support both a refesh-based login, which would entirely prevent cross-site scripting attacks, and an SPA-friendly non-refresh-based login, which would exopse a login token to the service's client-side application. The service's server would require some short-lived state--although the statefull aspect of the protocol can reasonably be containerized and provided as e.g. a standardized Docker image.

Definitions:
The client: The service's in-browser application, e.g. JavaScript contained in a webpage.
The browser: A browser-native user interface, sandboxed from the client.
The app: The cross-device passkey authentication app.
The server: The service's HTTP server.

I first walk through the happy path of the protocol, to provide a basic understanding of the protocol. I do this first purely from the user's point of view, then again with internal details of the client, browser, app and server. Afterwards I elaborate on divergences and failure modes. I end with a discussion of the protocol.

It is assumed that all HTTP requests use the HTTPS protocol, and that the app has registered a passkey with the server prior to the login attempt. Although I mention a QR code and a text input field, I do this for brevity; both are just ways to move information between browser and app, and different options could be offered, e.g. USB or third-party browser extensions.

## Happy path, user POV

The user browses a website and clicks on "Login using another device". A special login window opens, clearly distinct from the website. It shows the name of the service, a QR code, "Scan the QR code using the app on the other device. You must login to the service in the app on the other device", and a spinner.

Using the app, the user scans the QR code. The app shows the name of the service and asks the user to confirm logging in. The user confirms and is shown "Wait for the other device to claim login. Afterwards, enter two digits provided by browser below.", an input field for digits, and a disabled button stating "Approve the other device's claim to login".

A few seconds later, the browser shows "I succesfully claimed the login. Enthese these two digits into the application on the other device. Afterwards I can finalize the login", and a spinner.

In the app the user enters the two digits. The button "Approve the other device's claim to login" becomes enabled; the uses presses it. Afterwards, the app shows "Claim approved. The other device can now finalize the login."

After a few seconds, the browser briefly shows "Login finalized. You are now logged in." The user is taken back to the client.

To summarize, besides clicking "Login", opening the app and confirming the login, the user performs these steps specific to this protocol:
- Scan QR code
- Enter digits
- Approve

## Happy path, technical details

The browser exposes an API for the client to invoke a login attempt. Doing so requires the client to provide the browser with four URLs (without an origin. The URLs are for the app to authenticate with the server; the browser to make a claim for a authenticated login; the app to approve a claim; the browser to finalize the login and receive credentials.

Upon invocation, the browser constructs full URLs out of the provided partial URLs by combining them with the origin of the client. The browser also generates a long randomized session id. The URLs and session id are embedded in the QR code. 

The browser starts polling the claim URL every two seconds, providing the session id. The serves is unable to fetch from its store of authenticated logins an entry corresponding to the session id. The sercer responds to the browser that claiming was not possible (but could be in the future).

The app uses the login URL to initiate authentication with the server using the standard passkey protocol. Upon success the server adds to its store of authenticated logins an entry containg the authenticated identity and the session id. This entry expires shortly, in 30 seconds. The server also generates a long randomized string to be used a approve token, and to its store of to-be-approved logins adds an entry containing the authenticated login entry and the approve token. The server responds to the app with the approve token. The app securely stores the approve token.

Upon the next poll of the browser, the server is able to fetch from its store of authenticated logins the entry corresponding to the session id. The server generates two digits and a long randomized string to be used as finalize token. The server adds to its store of claimed logins an entry containing the approved login, the two digits and the finalize token. This entry expires shortly, in 30 seconds. The server responds to the browser with the finalize token. The browser securely stores the finalize token.

The browser starts polling the finalize URL every two seconds, providing the finalize token. The server is unable to fetch from its store of to-be-finalized logins an entry corresponding to the finalize token. The server responds to the browser that finalization was not yet possible.

Upon approving, the app sends to the approve URL the approve token and the two digits. The server fetches the authenticated login corresponding to the approve token. The server verifies that there is exactly one claim corresponding to this authenticated login, and that the two digits match. The server to its store of to-be-finalized logins adds an entry containing the authenticated login and the sole claim's finalize token. The server responds to the app that the login can now be finalized.

Upon the next poll of the browser to the finalize URL, the server is able to fetch from its store of to-be-finalized logins an authenticated login corresponding to the finalize token. The server responds to the browser with data to be used as proof of ownership of the authenticated login.

The browser securely stores the proof of ownership of the authenticated login, and hands control back to the client. The login flow has been completed.

To summarize, here is an overview of states:

The browser stores:
- claim URL
- finalize URL
- session id
- claim token
- finalize token

The app stores:
- login URL
- approve URL
- session id
- approve token

The server stores:
- authenticated logins
- to-be-approved logins
- claimed logins
- to-be-finalized logins

Besides expiring after a certain time, some entries can be removed upon specific events:
- Upon a succesful approval, regardless if time, the server can remove all relevant entries in its store of authenticated logins, its store of to-be-approved logins, and its store of claimed logins.
- For the store of to-be-approved logins, there is no need to expire these entries based on time; such an entry containing an authenticated login can be removed when the last entry in authenticated logins or claimed login expires that contains the same authenticated login.

## Core idea

The core idea is that ultimately the browser retrieves from the server some proof of authentication (a session cookie or bearer token), where the authentication was negationated between the app and server.

## Divergences & failure modes

optionally a display name for the service
The client chooses what happens after the login flow has ended: navigate to a webpage provided by the client (in which case additional URLs must be provided); navigate to a webpage provided by the server; or receive a result and resume execution.

Server could have any amount of time for expiration, and inform the app and browser of this by inserting it in the appropriate responses.

For the browser to claim and to finalize, instead of polling or other prolonged connection, there could be an explicit button, to save compute and bandwith; at the cost of an extra manual step. Leave it up to service: upon starting the flow, client can choose.

## Discussion

An authenticated login is coupled to a specific browser-generated session id, and can only be claimed when providing that session id. If an authenticated login is claimed multiple times, either: some browser issued two claims, in which case that browser does not implement the specification correctly; or two browsers are each in a seperate login flow but for the same service, where the expiration windows of both authenticed logins happen to overlap, and both browsers happen to have generated the same session id; or the session id was stolen by an attacker. If the specification for the session id is long and randomized enough, two browsers accidentally clashing practically never happens, making multiple claims to an authenticed login reason to assume an attack.

The server should allow multiple claims to the same authenticated login coexist. So upon approval there are three relevant cases. In case of no claims, the user didn't follow instructions ("Approve only after browser has made a claim)"): the user can be reminded to follow instructions and the flow can continue safely. In case of one claim, if the user followed instructions, that claim is the the correct one to approve. In case of more than one claim, if the user followed instructions, the user is under attack; the user should be informed of this and the login flow should be terminated.

The user-initiated approval is necessary to prevent an attacker claiming first. If the user approve after the browser has made a claim, the approval is guaranteed to be safe: either there was only one claim, which is certainly the user's browser, and the flow continues (where the user's browser can finalize using the finalize token, a secret shared between browser and server), or an attacker caused multiple claims, in which case the user is notified of an attack and the login flow is terminated.

The two digits that 'unlock' the approve button aren't technically required, but act as 1) a strong prevention of muscle memory or autopilot approval, which is a vulnerability (an attacker might make the first claim), and 2) compelling evidence for the user's browser to indeed have made a claim. With 

## Closing words


