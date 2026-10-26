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

## World mode (`src/js/uplink.js`, `world.js`, `warehouse.js`, `seat.js`, `arm.js`)

Every page has a place in a 3D workshop, seen from your spot behind its desk: the desk monitor
is your browser (home, blog, about, posts), the phone shows contact, the books hand off to
the `/reading/` app. The TV wall (blog), the evidence board (about) and the rest are things
you click to open their page in place.

- **`uplink.js`** (every page): loads `world.js` in the background on capable devices
  (WebGL2, no Save-Data, `deviceMemory` >= 4 when reported) and wires every `[data-jack]`
  button. The terminal narrates it via `DHRUplink.on()`; reader pages just show the button.
- **Jack out:** the live terminal, or the page's live `<main>`, moves onto the monitor
  (`CSS3DRenderer`, sized to the window) and the camera starts where it fills the window; the
  robot arm (`arm.js`) yanks the plug out of your neck and you get up from the desk.
- **In the world** you stand and look around (`seat.js`: drag, or the arrow keys); the
  monitor runs a screensaver (JACK IN TO ENTER). Going into the screen is always jacking in:
  clicking the monitor, or a thing that opens a page, sits you down, the arm plugs you in and
  you dive into the page (the origin page with no reload, any other loads for real). For the
  phone you sit down and it lifts up with the contact page. Esc puts the phone down, or jacks
  you back into the page you started on.
- **`warehouse.js`** loads the room (GLB from `src/models/`, built by `blender/`, see
  VISION.md) and owns the live props: monitor (`shapeMonitor`), link (arm, plug, cable,
  sparks), the phone, what the screens and TVs show, the hazy view out of the window, neon
  flicker, the sunbeam.
- three.js `0.170.0` from jsDelivr via an import map (KTX2 transcoder and Meshopt decoder come
  from the same place).

## Rules of thumb

- The text is never themed: proportional serif, ~68ch, no effects on body copy. Terminal
  flavour goes in the top bar, kicker line, headings' `##`, and footer.
- Every terminal command has a normal link equivalent; the home page works with JS off.
- The boot animation runs once per tab session and never with reduced motion.
- `/reading/` still points at the live three.js shelf on dhr.vn.
