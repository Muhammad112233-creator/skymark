<div align="center">
# SKYMARK — a real-estate studio site template

A dark, scroll-driven one-pager for a property developer, built as a plain static
site — no frameworks, no build step, nothing to install.

</div>

```
index.html        the front page (loader → 3D map → six chapters)
about.html        the story, the method, the numbers
projects.html     selected work
careers.html      open roles
contact.html      offices + how to reach a human
news.html         newsroom
```

## What's inside

- **Pixel-letter loader** — the wordmark assembles itself from squares, bars and
  drawn strokes while assets load.
- **A 3D map of the city** (WebGL via [three.js](https://threejs.org)) —
  procedurally generated blocks, a river, drifting motes and a glowing brand
  cube. Grab it and drag while the first chapter is on screen.
- **Six scroll chapters** — sticky full-height scenes with character-by-character
  headline reveals, and a camera that flies between four worlds: the city, a
  ridged terrain with flowing light lines, a constellation field and a
  breathing grid of cubes.
- **The chrome** — beveled panels and buttons (with the dual trail that races
  around the border on hover), scramble-decode text, a chapter rail on the left,
  a bottom bar with progress, sound toggle and a chat link, and a full menu
  overlay.
- **Sound** — everything is synthesised in WebAudio (ambient hum, hover blips,
  clicks). No audio files, nothing copyrighted. Off by default via the toggle;
  first click anywhere enables it.

## Run it

Because it uses ES modules, serve it over HTTP instead of opening the file
directly:

```bash
cd skymark
python3 -m http.server 8000
# → http://localhost:8000
```

Any static host works — GitHub Pages, Netlify, Cloudflare Pages, a folder on
nginx. There is no build step; upload the folder as-is.

## Make it yours

| What                            | Where                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Brand name / chapters / copy    | `js/home.js` → `SECTIONS` (and the loader letters in `js/app.js` → `LETTERS`) |
| Wordmark logo                   | the `<path>` inside `.logo-word` in each html file                            |
| District markers (name + count) | `js/home.js` → `DISTRICTS` (anchors are in `js/webgl.js` → `DISTRICTS`)       |
| Colours                         | `css/style.css` → `:root` (`--dark-blue`, `--off-blue`, hairlines)            |
| Fonts                           | `fonts/` + `css/fonts.css` (Space Grotesk & Commit Mono, both OFL)            |
| WhatsApp link                   | `index.html` → the `Talk to us` anchor (placeholder number — change it)       |
| Login button                    | `index.html` → currently points at `contact.html`; wire it to your portal     |

The 3D city is generated from a handful of constants (district centres, river
curve, block density) at the top of `js/webgl.js` — move the district anchors
there and the map markers follow.

## Credits & licences

- [GSAP](https://gsap.com) + ScrollTrigger + SplitText + ScrambleText — GreenSock standard licence (free)
- [Lenis](https://lenis.darkroom.engineering) — MIT
- [three.js](https://threejs.org) — MIT
- [Space Grotesk](https://github.com/floriankarsten/space-grotesk) — SIL OFL 1.1
- [Commit Mono](https://commitmono.com) — SIL OFL 1.1

See `LICENSES.md`. All imagery is generated in-code; there are no third-party
photos, audio or models in this repository.

<div align="center">
⭐ If this template is useful, please leave a star! ⭐
</div>
