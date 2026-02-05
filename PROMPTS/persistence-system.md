# Prompt: Implement Persistence & Auto-Save System

## Project Context
Architecture Visualizer - Next.js app for visualizing architecture.
- Stack: Next.js 15, React, TypeScript, Tailwind CSS, @xyflow/react, Zustand
- Path: `/Users/user/Desktop/communication/architecture-visualizer`
- State Management: Zustand store (`src/stores/canvasStore.ts`)

## Current Problem
All data (nodes, edges, documents, folders, visual groups) is stored only in memory (Zustand store). When user refreshes page, closes tab, or app crashes - ALL DATA IS LOST.

## Requirements

### 1. LocalStorage Persistence (Immediate)
- Auto-save Zustand state to localStorage on every change
- Auto-restore state from localStorage on app init
- Debounce saves (e.g., 500ms) to avoid performance issues
- Handle localStorage quota exceeded errors

### 2. IndexedDB for Large Data (Better)
- Use IndexedDB for larger data (full document content, images)
- LocalStorage has 5MB limit, IndexedDB has much more
- Consider using `idb` library for easier IndexedDB API

### 3. Auto-Save Indicators
- Show "Saving..." indicator when saving
- Show "Saved" with timestamp
- Show error if save fails

### 4. Export/Import Backup
- Export all data to JSON file
- Import from JSON file
- Useful for manual backups and sharing

### 5. Multiple Projects Support (Future)
- Save multiple projects separately
- Project switcher in UI
- Each project has its own state

## Technical Implementation Hints

### Zustand Persist Middleware
```typescript
import { persist } from 'zustand/middleware';

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      // ... existing state and actions
    }),
    {
      name: 'canvas-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        documents: state.documents,
        folders: state.folders,
        visualGroups: state.visualGroups,
      }),
    }
  )
);
```

### Key Files to Modify
- `src/stores/canvasStore.ts` - add persist middleware
- `src/components/canvas/CanvasViewer.tsx` - might need hydration handling
- Create new component for save status indicator

### Edge Cases to Handle
- SSR hydration mismatch (Next.js)
- localStorage not available (private browsing)
- Data migration when schema changes
- Concurrent tabs editing same data

## Acceptance Criteria
1. User creates nodes/documents → refreshes page → data is still there
2. User sees "Saved" indicator after changes
3. User can export/import data as JSON backup
4. Works in private browsing mode (graceful fallback)
5. No data loss on app crash or tab close

## References
- Zustand persist: https://docs.pmnd.rs/zustand/integrations/persisting-store-data
- idb library: https://github.com/jakearchibald/idb
