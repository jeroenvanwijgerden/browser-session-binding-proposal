# Out-of-Band Binding PoC - Firefox Extension

Demo extension for evaluating the OOB binding protocol. Review the code if you're curious - it's ~200 lines total.

## Installation

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select any file in this directory (e.g., `manifest.json`)
4. "Out-of-Band Binding PoC" should appear in the list

Note: Temporary add-ons are removed when Firefox closes. For persistent installation, the extension would need to be signed.

## Usage

The extension is always active. When a page calls `navigator.outOfBandBinding.request()`:

1. A window opens with session info to copy
2. Paste the JSON into your companion app
3. Enter the pairing code back into the popup
4. Click Complete

## Test report

2026-01-10: Manually tested on Firefox version 134.0.2 (64-bit) (64-bit) (Linux)
