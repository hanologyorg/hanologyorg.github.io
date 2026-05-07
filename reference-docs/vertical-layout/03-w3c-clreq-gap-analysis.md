# W3C: Chinese Layout Gap Analysis — Key Learnings

Source: https://w3c.github.io/clreq/gap-analysis/

## Overview
Documents gaps in Chinese script support on the Web (HTML, CSS, eBooks).

## Relevant Sections for Our App

### Text Direction
- `writing-mode: vertical-rl` well supported
- Bidirectional text in vertical context has some edge cases

### Punctuation & Inline Features
- Emphasis dots (着重號) — CSS `text-emphasis` property
- Inline notes & annotations — no standard CSS solution; requires custom markup
- Abbreviation, ellipsis — ellipsis character (…) well supported

### Line & Paragraph Layout
- Line breaking: CJK allows breaks between any characters; browsers handle this
- Text alignment: `text-align: justify` works well for CJK
- Text spacing: letter-spacing works but may need adjustment for punctuation
- Lists/counters: upright counters still have gaps (see upright-counters doc)

### Page & Book Layout
- **Page turning direction**: In vertical CJK, pages turn left-to-right (content flows right-to-left)
- Grids & tables: generally well supported
- Footnotes/endnotes: no CSS standard; requires custom implementation

### Critical Gap: Page Progression
- CSS doesn't natively support "start scroll from right" for horizontal scroll in vertical-rl context
- `direction: rtl` on scroll container is the workaround but has quirks
- No standard way to translate wheel events to horizontal scroll direction respecting writing mode

## Key Takeaway for Our App
- Vertical text rendering itself is well-supported
- The UX of horizontal scrolling in vertical mode (RTL, wheel translation) requires custom JavaScript
- Annotations/tooltips in vertical text need custom positioning logic
- Page progression direction is NOT handled by CSS alone
