# dhr.vn: terminal edition

The fast, accessible base layer of dhr.vn: a terminal-styled home page plus a calm
reader layout for posts and pages. The 3D warehouse ("world mode") is planned to load
on top of this later; nothing here depends on it.

The existing site in `../DHR.vn` is untouched. Content was copied from it once.

## Run

```bash
npm run dev      # build + serve http://127.0.0.1:4321, rebuilds on change
npm run build    # writes dist/ (deploy this folder)
```

No dependencies. Node 20+.

## Layout

| Path | What |
|------|------|
| `content/posts/*.html` | Blog posts. HTML fragment with a JSON comment on top (`title`, `date`, `description`, optional `cover`, `excerpt`, `draft`). File name = slug. |
| `content/pages/*.html` | Regular pages (`about`, `contact`). Same format; `nav` = which nav item to highlight. |
| `build.mjs` | Templates + build + dev server. |
| `src/css/base.css` | Tokens (night / paper themes), footer. |
| `src/css/reader.css` | Posts, pages, blog index, contact form. |
| `src/css/terminal.css` | Home terminal. |
| `src/js/terminal.js` | Boot animation + command prompt (progressive enhancement). |
| `src/js/theme.js` | auto / paper / night toggle on reader pages. |
| `public/` | Copied to `dist/` as-is (images, `_headers`). |

## New post

Create `content/posts/my-post.html`:

```html
<!--
{
  "title": "My post",
  "date": "2026-11-01",
  "description": "One line for search results.",
  "cover": "/images/blog/whatever.jpg",
  "excerpt": "Shown on the blog index."
}
-->
<p>Body HTML…</p>
```

Footnotes use the same markup as the old site (`<sup><a href="#fn1" id="ref1">1</a></sup>` + `<div class="footnotes">`).

## World mode (`src/js/uplink.js`, `src/js/world.js`)

Every page has a place in a 3D warehouse (`data-place` on `<html>`, `PLACES` in world.js):
home → desk monitor, blog/posts → centre screen of the wall, about → evidence board,
contact → lounge, reading → bookshelf (hands off to the `/reading/` app).

- **`uplink.js`** (every page): loads `world.js` in the background on capable devices
  (WebGL2, no Save-Data, `deviceMemory` >= 4 when reported) and wires every `[data-jack]`
  button. The terminal narrates it via `DHRUplink.on()`; reader pages just show the button.
- **Jack out from home:** the live terminal DOM moves onto the monitor (`CSS3DRenderer`), the
  camera starts where it fills the window and pulls back; a plug yanks out of the desk socket.
- **Jack out from any other page:** the live `<main>` becomes a floating **datapad** (starts
  full-screen, glides to a panel) while the room fades in and the camera settles on its place.
- **In the world:** HUD buttons, hotspots, datapad links and terminal `cd` commands fly between
  places and fetch pages into the datapad (no reloads; URL follows with `#world`).
  "Jack in" on the datapad opens that page normally. Esc closes the datapad, then returns to
  the page you started on (same as the back button / "Jack back in").
- three.js `0.170.0` from jsDelivr via an import map. Everything in `buildWarehouse()` is
  placeholder geometry: replace with GLTF loads, keep `shapeMonitor()`, `link` and the hotspot
  contract (`userData.hotspot = { label, visit | action, highlight() }`).

## Rules of thumb

- The text is never themed: proportional serif, ~68ch, no effects on body copy. Terminal
  flavour goes in the top bar, kicker line, headings' `##`, and footer.
- Every terminal command has a normal link equivalent; the home page works with JS off.
- The boot animation runs once per tab session and never with reduced motion.
- `/reading/` still points at the live three.js shelf on dhr.vn.
