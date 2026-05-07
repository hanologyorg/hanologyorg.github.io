# W3C: Styling Vertical CJK Text — Key Learnings

Source: https://www.w3.org/International/articles/vertical-text/

## Basic Setup

- `writing-mode: vertical-rl` — Chinese/Japanese vertical text, lines progress right to left
- `writing-mode: vertical-lr` — Mongolian vertical text, lines progress left to right
- `text-orientation: mixed` — default; Han upright, Latin rotated 90° clockwise
- `text-orientation: upright` — forces all characters upright (including Latin)

## Character Orientation

- Han characters are always upright by default in vertical text
- Latin characters rotate 90° clockwise by default
- Use `text-orientation: upright` on `<span>` to keep embedded Latin upright
- Use `text-transform: full-width` as alternative (fullwidth chars auto-upright)
- `text-combine-upright: all` — horizontal-in-vertical (tate chu yoko) for short runs
- `text-combine-upright: digits 2` — auto-detect 2-digit numbers (NOT YET SUPPORTED in browsers)

## Important for Our Implementation

1. **Line progression**: In `vertical-rl`, lines go right-to-left. This means scroll containers should naturally scroll rightward (content starts at right edge).
2. **Logical properties**: Use `inline-start`/`inline-end`/`block-start`/`block-end` instead of left/right/top/bottom for direction-agnostic styling.
3. **Tables in vertical**: Rows run down, columns across. Text in cells is vertical by default.
4. **Lists in vertical**: Counter at top of line, content flows down. Use `text-combine-upright: all` on `::marker` for upright counters.
5. **Forms in vertical**: Controls flow down the page, lines progress right-to-left.

## Browser Support

- `writing-mode: vertical-rl` — full support all major browsers
- `text-orientation` — full support
- `text-combine-upright` — Blink/Gecko support `all` value; `digits` NOT supported
- Logical properties — mostly supported, some gaps in WebKit

## Sideways Values

- `sideways-rl` — all chars on right side (including Han), not for normal CJK
- `sideways-lr` — all chars on left side, not for normal CJK
- These are for captions, table headers, UI elements in horizontal-first scripts
