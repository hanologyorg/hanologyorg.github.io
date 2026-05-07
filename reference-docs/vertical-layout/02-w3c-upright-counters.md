# W3C: Upright Counters in Vertical Text — Key Learnings

Source: https://www.w3.org/International/questions/qa-upright-counters-in-vertical.en.html

## Problem
In vertical text, list counters (1, 2, 3...) appear lying on their side by default.

## Solutions

### 1. Custom counter styles (cross-browser)
```css
@counter-style circled-decimal {
  system: fixed 0;
  symbols: '⓪' '①' '②' ... '㊿';
  suffix: '';
}
li { list-style-type: circled-decimal; }
```
- Works everywhere, but limited to predefined count (e.g., 50 items max)

### 2. text-combine-upright on ::marker (Blink/Gecko only)
```css
@counter-style upright-decimal {
  system: extends decimal;
  suffix: '';
}
li { list-style-type: upright-decimal; }
li::marker { text-combine-upright: all; }
```
- NOT supported by WebKit (Safari)
- Supports unlimited list length

### 3. text-combine-upright: digits (NOT YET SUPPORTED)
```css
li::marker { text-combine-upright: digits; }
```
- Would allow rotated parens with upright digits
- No browser support yet

## Key Takeaway for Our App
- Use `text-combine-upright: all` for list counters in vertical text
- For section numbers (01, 02, etc.) in vertical mode, wrap in `<span style="text-combine-upright: all">` to keep them upright
- Fullwidth characters (①②③) are always upright by default — useful for numbered sections
