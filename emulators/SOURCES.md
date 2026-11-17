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

**Quick guide:** `astera/titan-tube/quickguide-v2-2022-08-11.pdf` (printed quick guide, version 2.0, issued 2022-08-11; EN/DE/IT/ES/FR/CN). Its screen drawings are vector art, so they need a PDF renderer (poppler) to view; only its text has been used so far.
- §7 Reset: "RESET to unlink CRMX. Sets Input Select to AUTO and runtime to 5h."
- §8 Charging: the display shows the charging status while the power cable is connected (not emulated yet).

**Titan screen photos:** `astera/titan-tube/screens/`, taken on a real Titan Tube in 2026-11. The light runs newer firmware than the 2020 manual, so where they disagree the photos were followed.
- `status-crmx-no-link.jpg`: the status screen is `CRMX: NO LINK` with no second line. The top row shows `100%` and a battery icon at the right, and nothing on the left.
- `menu-NN-*.jpg`: main menu order. Two entries are not in the manual: **TURN BY 180** and **UNBOND BLUETOOTH**, after DMX SETTINGS. The photos of UNPAIR CRMX, RUNTIME and INFO were caught mid-scroll and can't be read; their positions were confirmed by the photographer.
- `menu-transition-midscroll.jpg`: the text slides vertically between entries.
- `palette-1-hsi-*.jpg`: the selected row is shown in inverse video across the full width. CCT defaults to 5500 K.
- `palette-2-static-color.jpg`: title `Static Color:`.
- `palette-3-gel-lee-tungsten.jpg`: the gel page shows `LEE Tungsten` (selected) / `#002` / `Rose Pink`, with no "Color Gel:" title.
- `brightness-runtime.jpg`: `Runtime : 3h`, with spaces around the colon. The brightness line can't be read.
- All photos: light-cyan pixel font on black. `UNBOND BLUETOOTH` exactly fills the width, which confirms 16 characters.

Unused shots (unreadable, mid-scroll or duplicates) are still in `astera/astera_photos/`.

**Helios panel photo:** `astera/helios-tube/panel.png`. It shows the Helios status screen: APP CONTROL / Helios 3 / 69%.

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
- Status line text when a DMX input has no signal: "XLR-DMX: NO LINK" and "ART3: NO LINK" ("CRMX: NO LINK" is confirmed). Whether the manual's "SET:001 DMX:001" second line appears once there is a signal.
- **TURN BY 180.** Assumed to be an OFF/ON setting that flips the pixel order; the screens inside it are invented.
- **UNBOND BLUETOOTH.** That ENTER unbonds straight away and shows "DONE".
- **Gel type names** other than "LEE Tungsten", and their order.
- **Brightness line** on the brightness page (shown as "Brightness: 100%").
- **UNPAIR CRMX.** The confirmation text ("DONE") and how long it shows.
- **RESET SETTINGS.** Which of NO/YES is selected first.
- **Step sizes:**
  - CCT steps of 50 K
  - Green range ±1.00 in steps of 0.01
  - Standalone SPEED steps
- **Palette button.** That a fourth press loops back to the HSI screen.
- **Gel list.** The manual points to a list on "page 55", which isn't in the manual. The emulator uses a subset of real LEE / Rosco numbers.
- **"AX1 Compatibility"** is 17 characters, so it gets cut off at 16. The real light may abbreviate it instead.
- **Blue Mode.** The screen during Blue Mode isn't documented.
- **Helios status line.** The Helios photo shows "APP CONTROL / Helios 3", but the Titan manual shows "SET:001 DMX:001" there. Newer firmware may show the light's name.
- **Pixel counts.** Helios 1/2/4/8 and Hyperion 1/4/8/16 are guesses.

When a real light disagrees:
1. Fix `astera-fp.js`.
2. Add a button-sequence case to `test/emulator/astera.test.js`.
3. Remove the matching `guess` text.
