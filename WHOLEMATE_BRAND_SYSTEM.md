# WholeMate Brand System

Status: Production artwork generated and integrated; physical-device visual validation pending

## Brand idea

The single rounded path combines an open embrace with a subtle `W`. It represents whole-body context and a companion that helps interpret it. The mark intentionally avoids medical crosses, hearts, ECG lines, wearable hardware, and running-only imagery.

## Core palette

| Token | Value | Use |
| --- | --- | --- |
| WholeMate Navy | `#17324D` | Launcher background, primary wordmark, high-contrast brand surfaces |
| Recovery Teal | `#48BFAE` | Master mark, health/recovery emphasis, positive guidance |
| Soft Sky | `#3A9FD1` | Supporting product accent only; not required inside the master mark |
| Cloud | `#F4F8FC` | Splash and light brand background |
| White | `#FFFFFF` | Monochrome mark and high-contrast foreground |

## Asset rules

- Keep the master mark as one open, continuous rounded path.
- Preserve at least 12.5% clear space around the mark.
- Use the teal mark on Navy or Cloud; use the white mono mark on dark or photographic surfaces.
- Do not rotate, close the top opening, add a heart/ECG line, or apply shadows inside the mark.
- At small sizes, use the mark alone. Use the `WholeMate` wordmark only when the available width is at least three times the mark width.
- Internal filenames may retain `runmate` where Android or stored-data compatibility benefits from keeping them unchanged.

## Source assets

- `resources/logo.svg`: canonical mark used by the Capacitor asset generator.
- `resources/wholemate-mark-mono.svg`: one-color white mark for notification and dark surfaces.
- `resources/wholemate-lockup.svg`: horizontal mark and wordmark reference.
- `public/wholemate-mark.svg`: in-app mark.
- `public/icons/*.webp`: PWA launcher set from 48 px through 512 px.
- `android/app/src/main/res/mipmap-*`: legacy, round, and adaptive launcher assets.
- `android/app/src/main/res/drawable-*-*/splash.png`: light and dark portrait/landscape splash assets.
- `android/app/src/main/res/drawable/ic_stat_runmate.xml`: monochrome Android notification mark; the compatibility filename is intentionally unchanged.
- `src/lib/shareCanvasRenderer.ts`: deterministic canvas version of the mark for exported share pictures.

## Validation status

- Source SVG and generated raster assets have been visually inspected at master and Android splash sizes.
- Web manifest paths and MIME types are locked by an automated identity contract.
- Physical-device launcher masking, update-install continuity, notification rendering, and OLED dark-splash behavior remain release-gate checks.
