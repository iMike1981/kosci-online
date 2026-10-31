# Third-party notices

## flag-icons

- Library: flag-icons (version 7.6.0, 4x3 SVG set)
- URL: https://github.com/lipis/flag-icons
- Copyright (c) 2013 Panayiotis Lipiridis
- Licence: MIT. Full text in [LICENSES/flag-icons-MIT.txt](LICENSES/flag-icons-MIT.txt)
- Use here: `flags.svg` is derived from flag-icons. The 4x3 flag SVGs were minified and combined into one sprite. Flags with detailed coats of arms are stored as small embedded raster images.

## Firebase JavaScript SDK

- Library: Firebase JS SDK (version 12.6.0: `firebase-app`, `firebase-auth`, `firebase-firestore-lite`)
- URL: https://github.com/firebase/firebase-js-sdk
- Copyright Google LLC
- Licence: Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0)
- Use here: not bundled. The modules are loaded on demand from `https://www.gstatic.com/firebasejs/` only when the optional player account window is opened, or when this device is already logged in. They provide login/password sign-in and storage of achievements and stats.
