# Asset credits

## Kenney (CC0 1.0 Universal)

3D models in LabLink's 3D Campus come from **Kenney** (https://www.kenney.nl), released under
**Creative Commons Zero (CC0)** — https://creativecommons.org/publicdomain/zero/1.0/
Attribution is not required but is given here.

| Pack | Version | Source | Used files (`frontend/public/assets/models/…`) |
|---|---|---|---|
| Mini Characters | 2.0 | https://kenney.nl/assets/mini-characters | `characters/character-{male,female}-{a,c,e}.glb` + `characters/Textures/colormap.png` |
| Building Kit | 1.0 | https://kenney.nl/assets/building-kit | `building/{wall, wall-window-square, wall-window-wide-square, wall-doorway-wide-square, wall-corner-column, column, floor, roof-flat-*, …}.glb` + `building/Textures/*.png` |

Only the small subset of GLB files actually used was copied (≈1.7 MB total); no full packs are committed.

Everything else in the scene (trees, terminals, kiosk, equipment stand-ins, paths, ground) is generated
procedurally from Three.js primitives. No other third-party models, textures, fonts or audio are used.
