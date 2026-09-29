# Reproduction (before the fix)

Tool: Playwright MCP (`@playwright/mcp`), viewport resized with `browser_resize`, page at http://localhost:3474/, measured with `browser_evaluate`.

Observed at 375x812:

1. Horizontal scroll. `document.documentElement.scrollWidth` was 1040 against a `clientWidth` of 375. The plan grid uses `repeat(3, 320px)`, so the three cards never wrap. The same overflow appears at 768 (scrollWidth 1040, clientWidth 768).
2. The price is clipped. Each `.price` element is 120px wide with `overflow: hidden; white-space: nowrap`, so `scrollWidth > clientWidth` on all 3 prices and "₱150,000" is cut off. This happens at every viewport width, including 1440.
3. The "Start a sprint" button measured 28px tall, well under the 44px tap-target guideline. Also at every width.

At 1440 the grid looks fine, which is why the layout bug is easy to miss on a desktop. Only the overflow depends on the viewport width.

# After the fix

Same viewports: `scrollWidth` equals `clientWidth` at 375, 768 and 1440, no price is clipped, and the buttons are 44px tall. The cards stack at 375, and sit in a flexible grid at the wider sizes.
