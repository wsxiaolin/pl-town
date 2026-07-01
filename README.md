# MiniCity — Portfolio

An interactive top-down miniature city as a portfolio navigation system.

## Run locally

```bash
cd MiniCity
npx serve .
```

Or with Python:

```bash
python3 -m http.server 8080
```

Then open http://localhost:3000 (or 8080 for Python).

> **Note:** The page navigates between routes like `/about`, `/projects`, etc. — these only work correctly with a static server that supports directory index files (both `npx serve` and Python's http.server handle this correctly). Opening `index.html` directly as a `file://` URL won't navigate the sub-pages.

## Customise

- **Your name:** Search for `Your Name` in `index.html` and replace it.
- **Building links:** The `href` on each `.building` anchor in `index.html` — swap `/about`, `/projects`, etc. for real URLs.
- **Stub pages:** Fill in `about/index.html`, `projects/index.html`, `experiments/index.html`, `contact/index.html` with your real content.
- **NPC count/speed:** Adjust `duration` values and `waypoints` array in `main.js`.

## Structure

```
MiniCity/
├── index.html          # Main city scene
├── style.css           # All styles (day/night, buildings, people, layout)
├── main.js             # GSAP animations (NPCs, cursor, transitions, theme)
├── stub.css            # Shared styles for sub-pages
├── about/index.html
├── projects/index.html
├── experiments/index.html
└── contact/index.html
```
