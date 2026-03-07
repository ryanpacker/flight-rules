---
name: web-prototype
description: >
  Create multiple distinct design variations of a web page as HTML/CSS/JS prototypes.
  Use this skill whenever the user wants to create web prototypes, page mockups, design
  variations, HTML page concepts, landing page options, or explore different visual
  directions for a page. Also trigger when the user asks to "try different designs",
  "show me options for a page", "create page variations", or anything involving generating
  multiple visual alternatives of a web page. Even if the user just says "prototype this
  page" or "mock up a landing page", this skill applies.
---

# Web Prototype Generator

Create multiple visually distinct variations of a web page so the user can compare
design directions side by side. Each variation is a standalone HTML file with inline
CSS and JavaScript — no frameworks, no build steps, just open in a browser.

## How it works

1. Understand what the user wants the page to do and look like
2. Check or create the project config (`.web-prototype.json`)
3. Generate N variations (default 5), each as different as possible
4. Inject a shared navigation bar so the user can flip between variants

## Step 1: Understand the request

Ask the user (if not already clear):
- What is this page? (landing page, dashboard, portfolio, form, etc.)
- What content should it include?
- Any specific features? (see Feature Library below)
- Any brand constraints? (colors, fonts, tone)
- How many variations? (default: 5)

Give the page a short kebab-case name for the folder (e.g., `landing-page`, `pricing`,
`signup-flow`). Confirm the name with the user if it's ambiguous.

## Step 2: Project configuration

Look for `.web-prototype.json` in the project root. If it doesn't exist, create it:

```json
{
  "outputRoot": "prototypes",
  "pages": {}
}
```

Ask the user if `prototypes/` is the right output directory. If they want something
different, use their preference.

When generating a new page, add an entry to `pages`:

```json
{
  "outputRoot": "prototypes",
  "pages": {
    "landing-page": {
      "variants": 5,
      "created": "2026-03-07",
      "description": "Main marketing landing page"
    }
  }
}
```

The output structure is:
```
{outputRoot}/
  {page-name}/
    variant-1.html
    variant-2.html
    ...
    variant-N.html
```

## Step 3: Generate variations

For each variation, use the `frontend-design` skill to produce a distinctive,
production-grade design. The critical goal is **maximum visual diversity** — each
variant should feel like it came from a different designer with a different aesthetic
philosophy.

### Diversity strategy

Before generating, plan N distinct design directions. Vary these dimensions across
the set so that no two variants share the same combination:

- **Layout**: single-column, split-screen, asymmetric grid, full-bleed sections,
  card-based, editorial/magazine, bento grid
- **Visual tone**: minimal/stark, bold/maximalist, organic/soft, geometric/precise,
  editorial/typographic, dark/moody, light/airy, retro/vintage, futuristic/glassmorphic
- **Color approach**: monochromatic, complementary, analogous, high-contrast,
  muted/earthy, vibrant/saturated, dark mode, light mode
- **Typography**: large display type, classic serif, geometric sans, mixed type scales,
  monospace accents, handwritten touches
- **Motion/interaction**: static, subtle hover effects, scroll-triggered animations,
  parallax, micro-interactions
- **Spacing/density**: generous whitespace, dense/information-rich, mixed rhythm

Write out your plan (which direction each variant will take) before generating code.
Present it to the user for approval. Then generate each variant.

### Per-variant requirements

Each variant must be:
- A single, self-contained HTML file with all CSS and JS inline
- Responsive (works on mobile and desktop)
- Production-grade visual quality — not a wireframe, not a generic template
- Populated with realistic placeholder content (not lorem ipsum — write real-sounding
  headlines, descriptions, and data)

### Using the frontend-design skill

For each variant, invoke the frontend-design skill with clear direction about the
specific aesthetic you're targeting for that variant. Tell it the design direction
(e.g., "Create a bold maximalist landing page with large typography and vibrant
complementary colors") so that each invocation produces a genuinely different result.

## Step 4: Inject the variant navigation bar

Every generated HTML file must include the variant navigation bar. This is a floating
pill-shaped bar at the bottom-right of the viewport that lets the user click between
variants.

### Navigation bar HTML and CSS

Insert this exactly at the end of `<body>`, before `</body>`. Replace `{N}` with the
total variant count and set the correct `href` values and `active` class.

```html
<!-- Variant Navigation -->
<nav class="variant-nav" aria-label="Design variants">
  <a href="variant-1.html" class="active" aria-current="page">1</a>
  <a href="variant-2.html">2</a>
  <a href="variant-3.html">3</a>
  <!-- ... up to N -->
</nav>
<style>
  .variant-nav {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    gap: 4px;
    padding: 6px;
    background: rgba(20, 20, 20, 0.55);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.18),
      0 2px 8px rgba(0, 0, 0, 0.1),
      inset 0 0.5px 0 rgba(255, 255, 255, 0.2);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    transition: opacity 0.3s ease;
  }
  .variant-nav:hover {
    background: rgba(20, 20, 20, 0.7);
  }
  .variant-nav a {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: rgba(255, 255, 255, 0.7);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    background: transparent;
    border: 1px solid transparent;
  }
  .variant-nav a:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.95);
    border-color: rgba(255, 255, 255, 0.08);
  }
  .variant-nav a.active {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    font-weight: 600;
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.15),
      inset 0 0.5px 0 rgba(255, 255, 255, 0.25);
  }
</style>
```

This dark-tinted glass style is intentionally designed to be legible on any background —
light pages, dark pages, images, gradients, anything. Do not modify the nav bar styles
to match the page design. The nav bar should look identical across all variants.

Set `aria-current="page"` and the `active` class on whichever variant number matches
the current file (variant-1.html gets `active` on the "1" link, etc.).

## Feature Library

When the user mentions any of these features by name, you already know what they mean.
Apply the implementation details described here without requiring further explanation
from the user.

### Scrolling Parallax

**Trigger phrases**: "parallax", "scrolling parallax", "web parallax", "parallax scrolling",
"depth scrolling"

Multi-layer parallax scrolling where background elements move at different speeds than
foreground content during scroll, creating an illusion of depth.

**Implementation approach** (choose based on complexity needs):

**CSS-only (simpler, good for 2-3 layers):**
```css
.parallax-container {
  perspective: 1px;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
}
.parallax-layer-back {
  transform: translateZ(-2px) scale(3);
}
.parallax-layer-mid {
  transform: translateZ(-1px) scale(2);
}
.parallax-layer-front {
  transform: translateZ(0);
}
```

**JavaScript (smoother, more control, good for complex effects):**
- Use `requestAnimationFrame` for smooth 60fps updates
- Track scroll position with a passive scroll listener
- Apply `transform: translate3d(0, Ypx, 0)` to layers at different rates (e.g.,
  background at 0.3x scroll speed, midground at 0.6x, foreground at 1x)
- Use `will-change: transform` on animated elements for GPU acceleration
- Consider `IntersectionObserver` to only animate visible sections

**Design considerations:**
- Parallax works best with distinct visual sections/bands
- Use high-quality background images or gradient layers
- Ensure content remains readable — parallax is decoration, not the content itself
- Disable or reduce parallax on mobile (`prefers-reduced-motion` media query)
- Add `@media (prefers-reduced-motion: reduce)` to disable parallax for accessibility

---

## Notes

- If the user asks for more variants of an existing page, read the config to find the
  current count, generate additional variants, and update the nav bar in ALL files to
  include the new total.
- If the user wants to iterate on a specific variant, make edits to that file directly
  rather than regenerating from scratch.
- Always confirm the output path with the user before writing files.
