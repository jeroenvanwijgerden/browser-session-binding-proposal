# Out-of-Band Binding PoC - Chrome Extension

Demo extension for evaluating the OOB binding protocol. Review the code if you're curious - it's ~200 lines total.

## Installation

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this directory
4. "Out-of-Band Binding PoC" should appear in your extensions list

## Usage

The extension is always active. When a page calls `navigator.outOfBandBinding.request()`:

1. A window with session info to copy (click the extension icon to open it manually)
2. Paste the JSON into your companion app
3. Enter the pairing code back into the side panel
4. Click Complete

# Test report

2026-01-10: Manually tested on Chrome version 140.0.7339.207 (Official Build) (64-bit) (Linux)
