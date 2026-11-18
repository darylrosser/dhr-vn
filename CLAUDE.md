# dhr.vn

Daryl's personal site. **README.md** = how the site is laid out, how posts and pages work. **VISION.md** = where it's going (the 3D warehouse / world mode) and what must keep working; read its "Handoff" section before touching `src/js/world.js`, `warehouse.js`, `uplink.js` or `blender/`.

## How a change goes live

**Pushing to `main` is the deploy.** Netlify builds every push (`node build.mjs`, publishes `dist/`; see `netlify.toml`) and dhr.vn updates a minute or two later. A build that fails leaves the old site up.

1. `git pull --ff-only` first: the other Mac may have pushed.
2. Edit. If node is available, `npm run build` before pushing (no dependencies, Node 20+); it catches broken templates / JSON headers.
3. Small fix → commit on `main` and push. Bigger or visual change → push a branch and open a PR: Netlify posts a deploy preview link on it, which you can check on a phone before merging.

## Where it lives

| | **Dev Mac** (laptop) | **Media Mac** (always on, used over SSH from the phone) |
|---|---|---|
| Repo | `~/Documents/Personal/Dev Projects/DHR.vn` | `~/dhr-vn` |
| Extras | `drafts/` (post drafts + screenshots), Blender cache / renders, `.psd`s: none of it in git | just what's in git |
| Node | yes | not installed: can't build locally, rely on Netlify (PR deploy preview for anything non-trivial) |

On the media Mac it's not served from the checkout, so nothing goes live until pushed. Still, don't leave work uncommitted there; commit and push (or push a branch) when done.

## Rules

- Commit only when asked, or when finishing a change that was asked to go live.
- Keep pages plain HTML first; world mode is progressive enhancement on top (VISION.md).
- Big binaries (renders, videos, Blender output) don't go in git; `blender/out` and `blender/cache` are ignored on purpose.
