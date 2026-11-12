# Emulator sources

Reference material behind the control-panel emulators in `pwa/emulator/`.
In the app, the "Where am I? / Is this accurate?" box shows this per screen.

## Folder layout

One folder per brand, then one per model, named like the fixture database (lowercase, hyphens):

```
emulators/<brand>/<model>/
  manual-<version or date>.pdf   user / technical manual; put the firmware version or date in the name
  panel.jpg|png                  straight-on photo of the control panel
  screens/                       photos of real screens, to check menus against
```

None of this is deployed; only `pwa/` is. Panel photos stay here, not in `photos/`, which is the app's gallery.

## Astera FP-series (Titan, Helios, Hyperion): `pwa/emulator/fixtures/astera-fp.js`

**Source:** `astera/titan-tube/manual-v1-2020-08-26.pdf` ("FP1 Titan Tube Technical Reference Manual V1", dated 2020-08-26).
- §7.8–7.24: control panel and menus.
- §9: menu overview diagram.

**Panel photo:** `astera/helios-tube/panel.png`. It shows the Helios status screen: APP CONTROL / Helios 3 / 69%.

The Helios and Hyperion use the Titan's menus without changes. Nothing has been checked on a real Helios or Hyperion yet.

### Where the manual contradicts itself (the text was followed)
- **Input Select names.** The text uses AUTO / STANDALONE / APP CONTROL / Wired DMX / ART3 DMX / CRMX wirel. DMX. The §9 diagram is older and uses "Astera wirel. DMX", "XLR DMX" and "REMOTE CONTROL".
- **DMX profile menu name.** The text says "DMX PROFILE"; the diagram says "DMX TABLE".
- **BLACK color.** It's in the §7.13.1 colour table but not in the diagram.
- **Strobe options.** §8.15.2 mentions single and multiple strobe, but the diagram only shows ON/OFF.

### Assumed, needs checking on a light
- Whether values apply as you scroll, or only when you press ENTER.
- Screen titles for sub-screens the manual doesn't picture:
  - Index color, Custom color R/G/B
  - DMX ADDRESS value format
  - Pixels / DMX Profile / Strobe
  - Standalone sub-items
- Status line text when a DMX input has no signal: "CRMX: NO LINK" and "XLR-DMX: NO LINK".
- **UNPAIR CRMX.** The confirmation text ("DONE") and how long it shows.
- **RESET SETTINGS.** Which of NO/YES is selected first.
- **Step sizes:**
  - CCT steps of 50 K
  - Green range ±1.00 in steps of 0.01
  - Standalone SPEED steps
- **Palette button.** That a fourth press loops back to the HSI screen.
- **Gel list.** The manual points to a list on "page 55", which isn't in the manual. The emulator uses a subset of real LEE / Rosco numbers.
- **Display width.** Assumed to be 16 characters, based on "DO NOT STEAL THI". "AX1 Compatibility" (17 characters) gets cut off.
- **Blue Mode.** The screen during Blue Mode isn't documented.
- **Helios status line.** The Helios photo shows "APP CONTROL / Helios 3", but the Titan manual shows "SET:001 DMX:001" there. Newer firmware may show the light's name.
- **Pixel counts.** Helios 1/2/4/8 and Hyperion 1/4/8/16 are guesses.

When a real light disagrees:
1. Fix `astera-fp.js`.
2. Add a button-sequence case to `test/emulator/astera.test.js`.
3. Remove the matching `guess` text.
