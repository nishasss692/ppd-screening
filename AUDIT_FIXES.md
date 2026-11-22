# Miora Landing Page — Bug & Fix Audit (Resolved)

All identified issues from the initial audit have been resolved in the codebase across `index.html`, `src/styles.css`, `src/components/`, `src/LandingPageRoute.jsx`, and `src/main.js`.

---

## 1. Bugs

| # | Bug | Location | Resolution Status | Verified Implementation |
|---|-----|----------|-------------------|-------------------------|
| B1 | Conflicting `margin-left: auto` in header | `src/styles.css` | **RESOLVED** | Header layout uses clean `justify-content: space-between; gap: 16px;` without conflicting auto-margins. Actions are grouped in `.header-actions`. |
| B2 | `.desktop-only` `<br>` has no CSS rule | `src/styles.css:126` | **RESOLVED** | Added `.desktop-only { display: none; }` and `@media (min-width: 981px) { .desktop-only { display: block; } }`. In addition, `UrgentHelp.js` reworded copy to remove forced breaks. |

---

## 2. Accessibility Issues

| # | Issue | Location | Resolution Status | Verified Implementation |
|---|-------|----------|-------------------|-------------------------|
| A1 | No skip-to-content link | `LandingPageRoute.jsx` & `styles.css` | **RESOLVED** | Added `<a class="skip-link" href="#main-content">` targeting `<main id="main-content">` with animated focus styles. |
| A2 | Hamburger `<span>`s not hidden from screen readers | `Header.js` | **RESOLVED** | Header simplified to clean responsive action links. All icon wrappers and SVGs explicitly declare `aria-hidden="true"`. |
| A3 | Decorative empty `<span></span>` in `.eyebrow` not hidden | `Hero.js`, `Approach.js`, `Features.js`, `Proof.js` | **RESOLVED** | Added `aria-hidden="true"` to all decorative rule spans within `.eyebrow` components. |
| A4 | No `:focus-visible` outline styles | `styles.css:131-140` | **RESOLVED** | Added global `:focus-visible`, `.button:focus-visible`, and `a:focus-visible` with `outline: 2px solid var(--rose-deep)` and `outline-offset: 3px`. |
| A5 | Mobile menu lacks Escape-to-close / outside-click / scroll-lock | `LandingPageRoute.jsx`, `HelplineModal.js` | **RESOLVED** | Header actions fit responsively without fragile drawer states. Helpline modal includes full Escape key listener, backdrop outside-click listener, and body scroll lock. |
| A6 | Social links use non-descriptive text ("GH", "in", "X") | `Footer.js` | **RESOLVED** | Removed non-descriptive placeholder links; replaced with clear mission statement and brand note. |

---

## 3. Performance Issues

| # | Issue | Location | Resolution Status | Verified Implementation |
|---|-------|----------|-------------------|-------------------------|
| P1 | Hero image 196 KB PNG, no WebP/AVIF fallback, no `loading="eager"` | `Hero.js:17-29` | **RESOLVED** | Implemented `<picture>` with AVIF (26 KB), WebP (22 KB), and PNG fallback. Added explicit `width="474"`, `height="394"`, `loading="eager"`, `fetchpriority="high"`. |
| P2 | Testimonial image lacks `loading="lazy"` | `Proof.js:6-17` | **RESOLVED** | Implemented `<picture>` with AVIF (5 KB), WebP (4 KB), and PNG fallback. Added `loading="lazy"`, `decoding="async"`, `width="166"`, `height="155"`. |
| P3 | Images missing `width`/`height` attributes → CLS | `Hero.js`, `Proof.js` | **RESOLVED** | All image elements declare explicit width, height, and CSS aspect ratios to eliminate cumulative layout shifts. |
| P4 | Google Fonts `@import` is render-blocking, no `font-display: swap` | `index.html:34-37` | **RESOLVED** | Replaced render-blocking `@import` with `<link rel="preconnect">` and `<link rel="stylesheet">` featuring `display=swap`. |
| P5 | Unused `reference.png` and temp files bloat repo | `public/assets/` | **RESOLVED** | Safely pruned 25 unreferenced debug/comparison/test assets, reclaiming 3.35 MB of repository storage. |

---

## 4. SEO & Meta Issues

| # | Issue | Location | Resolution Status | Verified Implementation |
|---|-------|----------|-------------------|-------------------------|
| S1 | Missing favicon / apple-touch-icon | `index.html:14-17` | **RESOLVED** | Added SVG favicon, 32x32, 48x48 PNG icons, and 180x180 `apple-touch-icon.png`. |
| S2 | Missing manifest.json | `public/manifest.json` | **RESOLVED** | Added `public/manifest.json` with theme color `#fdf6f2`, app icons, and standalone display mode; linked in `index.html:18`. |
| S3 | Missing Open Graph / Twitter Card tags | `index.html:20-32` | **RESOLVED** | Added full `og:type`, `og:url`, `og:title`, `og:description`, `og:image`, and Twitter card metadata. |
| S4 | Missing canonical link and JSON-LD | `index.html:10-11, 40-61` | **RESOLVED** | Added canonical URL `<link rel="canonical" href="https://miora.health/" />` and Schema.org JSON-LD `Organization` and `WebSite` structured data. |

---

## 5. Code Quality Issues

| # | Issue | Location | Resolution Status | Verified Implementation |
|---|-------|----------|-------------------|-------------------------|
| C1 | Entire UI in one template literal | `src/components/` | **RESOLVED** | Modularized landing page into independent ES module components (`BrandLogo`, `Header`, `Hero`, `Approach`, `Features`, `Evidence`, `Proof`, `UrgentHelp`, `Footer`, `HelplineModal`, `AmbientBackdrop`, `Miora3DScene`, `icons`). |
| C2 | No test scripts | `package.json` | **RESOLVED** | `npm test` runs Vitest suite (95 tests passing); `components.test.js` tests all component contracts. |
| C3 | `icon()` silently falls back to `arrow` for unknown names | `icons.js:18-23` | **RESOLVED** | Added `console.warn` logging when an unregistered icon key is requested. |
| C4 | Anchor clicks scroll section titles behind sticky header | `styles.css:143-149` | **RESOLVED** | Added `scroll-margin-top: 24px;` across all `section[id]`, `[id]`, and anchor targets. |
| C5 | Mobile menu state not synced on resize | `Header.js` | **RESOLVED** | Simplified responsive header design eliminates out-of-sync navigation drawer states across breakpoints. |
