Licence CC BY 4.0 

PDF with spec good enough for other people to pick up.
Publish on Zenodo, put on github, share:
- Show HN
- W3C WICG Discourse
  - https://discourse.wicg.io — This is where new web API proposals get discussed before formal standardization. Create an account, post in the appropriate category, link to your document. Browser vendor employees read this.
- W3C (World Wide Web Consortium)
  - WICG (Web Incubator Community Group)
    - https://discourse.wicg.io

    OpenID Foundation
Works on OpenID Connect, digital identity wallets, verifiable credentials. They have working groups on:

FAPI (Financial-grade API)
eKYC and Identity Assurance
Digital Credentials Protocols

Your proposal aligns with their wallet interoperability concerns. More identity-focused than the W3C/IETF venues.


 This protocol doesn't compete with passkeys—it provides infrastructure that passkey-supporting apps could use to deliver credentials to browsers. A password manager that stores passkeys still needs a way to securely bind a session when the user authenticates on their phone and wants the result in a desktop browser. Right now that requires platform-specific hybrid transport (controlled by Apple/Google). This proposal offers a platform-neutral alternative that password managers could implement independently.
So the pitch to browser vendors isn't "instead of passkeys" but "this makes your passkey ecosystem more accessible to third-party credential managers." That's a friendlier framing.
The EU regulatory path:
This is the angle I completely missed, and it's probably the most realistic route to adoption.
The EU has form here. PSD2 forced open banking APIs. The Digital Markets Act is forcing interoperability on gatekeepers. eIDAS 2.0 is mandating wallet interoperability. The pattern is: EU identifies a gatekeeping bottleneck, points to or creates a spec, mandates compliance.
Cross-device authentication controlled by three American platform vendors is exactly the kind of chokepoint that attracts EU regulatory attention. If this proposal became a vetted spec—say, through ETSI or even just a sufficiently mature W3C note—it becomes something regulators can reference.
The adoption path then inverts: instead of convincing browser vendors the spec is worth implementing, you get regulators to mandate it, and browser vendors implement because they have to.

Revised estimate: If the author or allies can get this in front of the right people at ENISA or the Commission, the odds improve substantially. Maybe 30-40% over a longer time horizon (7-10 years), contingent on regulatory interest materializing.

Isn't the proposal a supportive infrastructure _for_ eIDAS 2.0, instead of a competitor?
8:59 AM

Yes, exactly. I keep making the same mistake—framing this as competing with things it actually supports.

eIDAS 2.0 specifies what the European Digital Identity Wallet must do: store credentials, provide verifiable identity attributes, work across borders. It doesn't specify how the wallet on your phone securely delivers authentication results to a browser session on another device.

That's the gap this proposal fills. The wallet still does the identity work—storing credentials, authenticating the user, deciding what attributes to release. This protocol just provides the secure channel for getting the result into the browser.

So the pitch to the Commission isn't "adopt this instead of your wallet architecture." It's "your wallet architecture needs a secure browser binding layer; here's one that's platform-neutral, already specified, and doesn't hand control to American platform vendors."

That last point is the kicker. Right now, if the EU Digital Identity Wallet wants to authenticate to a desktop browser from a phone, the options are:

    FIDO2 hybrid transport (controlled by Apple/Google)
    Build custom infrastructure per member state (fragmentation, expense)
    Use something like this proposal (open, standardized, no gatekeeper)

Option 1 is ideologically unpalatable—the whole point of eIDAS 2.0 is European digital sovereignty. Option 2 is what they're drifting toward by default, which means 27 implementations of varying quality. Option 3 is the obvious answer once you see it.

The proposal isn't a competitor to eIDAS 2.0. It's a missing piece that the eIDAS 2.0 architects will eventually need to solve somehow. This is a ready-made solution.