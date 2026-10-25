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

## World mode (`src/js/world.js`)

The home terminal is a monitor in a 3D warehouse. **Jack out** (button, `exit`, or `/#world`)
pulls the camera back from the screen; Esc, the back button, "Jack back in" or clicking the
monitor returns.

- three.js `0.170.0` from jsDelivr via an import map (home page only). `world.js` is imported
  in the background ~1 s after the boot finishes, only on capable devices (WebGL2, no
  Save-Data, `deviceMemory` >= 4 when reported). The button shows `syncing… / ready`.
- The live terminal DOM is moved onto the monitor with `CSS3DRenderer` (still clickable and
  typeable in 3D). The monitor is sized to the viewport's aspect and the camera starts exactly
  where the screen fills the window, so the handoff is seamless at any size (portrait monitor
  on phones).
- Everything in `buildWarehouse()` is placeholder geometry. Replace it with a GLTF load of the
  Blender scene; keep `shapeMonitor()` (or put a named screen plane in the GLB and size the
  CSS object to it) and the hotspot contract (`userData.hotspot = { label, href | action, highlight() }`).

## Rules of thumb

- The text is never themed: proportional serif, ~68ch, no effects on body copy. Terminal
  flavour goes in the top bar, kicker line, headings' `##`, and footer.
- Every terminal command has a normal link equivalent; the home page works with JS off.
- The boot animation runs once per tab session and never with reduced motion.
- `/reading/` still points at the live three.js shelf on dhr.vn.
