# Technical Debt & Backlog

## High Priority

### 1. Edge Gradient Not Working
**Status:** Not Implemented
**File:** `src/components/canvas/edges/CustomEdge.tsx`

**Problem:**
SVG gradient (`<linearGradient>`) defined inside CustomEdge component is not accessible to the `<path>` element. When using `stroke="url(#gradient-id)"`, the browser can't find the gradient definition and renders black stroke instead.

**Expected Behavior:**
- When node is selected → its edges should show gradient from sourceColor to targetColor
- When visual group is active → edges inside group should show gradient
- Otherwise → gray muted edges

**Current Workaround:**
Using solid `sourceColor` instead of gradient.

**Possible Solutions:**
1. Use React Portal to render `<defs>` at SVG root level
2. Use global SVG defs container outside ReactFlow
3. Use `<svg>` wrapper with `overflow: visible` for defs
4. Try different approach: draw two overlapping paths with masks
5. Check if ReactFlow has built-in mechanism for SVG defs

**Related Code:**
```typescript
// CanvasViewer.tsx - passes showGradient flag
const showGradient = isSelected || (activeGroupNodeIds && isInActiveGroup);

// CustomEdge.tsx - should use gradient but uses solid color as workaround
stroke={showGradient ? sourceColor : INACTIVE_COLOR}
// Should be:
stroke={showGradient ? `url(#${gradientId})` : INACTIVE_COLOR}
```

---

## Medium Priority

### 2. [Reserved for future items]

---

## Low Priority

### 3. [Reserved for future items]

---

## Completed

_None yet_
