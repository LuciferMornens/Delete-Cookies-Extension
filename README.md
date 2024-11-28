# Cookie Cleaner Chrome Extension

This Chrome extension automatically deletes cookies when you close a tab. It helps maintain privacy by ensuring that websites can't track you across sessions.

## Features

- Automatically deletes cookies when you close a tab
- Toggle on/off functionality via extension popup
- Works for all websites
- State persistence (remembers if you had it enabled/disabled)
- Runs in the background

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the folder containing this extension
5. The extension will be active immediately

## Usage

1. Click the extension icon in your Chrome toolbar to open the popup
2. Use the toggle switch to enable or disable the cookie cleaning functionality
3. When enabled, cookies will be automatically deleted when you close a tab
4. When disabled, cookies will remain untouched

## Note

- You'll need to sign in again to websites when revisiting them if the extension is enabled and you've closed their tabs
- The extension's state (enabled/disabled) persists across browser sessions
- You can toggle the functionality at any time through the extension popup

## Privacy

This extension only handles cookie deletion and doesn't collect or transmit any personal data. 