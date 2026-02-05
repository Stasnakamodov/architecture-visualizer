# Architecture Visualizer - Roadmap & Spec

## Project Context
- **Path**: `/Users/user/Desktop/communication/architecture-visualizer`
- **Stack**: Next.js 16, React Flow (@xyflow/react), Zustand, TypeScript, Tailwind
- **Purpose**: Визуализация и редактирование архитектурных диаграмм, импорт из Obsidian Canvas

---

## Phase 1: Critical Bug Fixes (HIGH PRIORITY)

### 1.1 Edge Creation (onConnect)
**Problem**: Нельзя создавать связи между нодами - отсутствует обработчик `onConnect`

**Solution**:
```typescript
// CanvasViewer.tsx
const onConnect = useCallback(
  (connection: Connection) => {
    setEdges((eds) => addEdge({
      ...connection,
      type: 'custom',
      data: { edgeType: 'arrow', lineStyle: 'solid' },
    }, eds));
  },
  [setEdges]
);

// В ReactFlow добавить:
<ReactFlow onConnect={onConnect} ... />
```

**Files**: `src/components/canvas/CanvasViewer.tsx`

---

### 1.2 Delete Nodes/Edges
**Problem**: Удаление нод и связей не работает (нет обработчика delete)

**Solution**:
```typescript
// CanvasViewer.tsx
const onNodesDelete = useCallback(
  (deleted: AppNode[]) => {
    const deletedIds = new Set(deleted.map(n => n.id));
    setEdges((eds) => eds.filter(
      (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)
    ));
  },
  [setEdges]
);

// В ReactFlow добавить:
<ReactFlow
  deleteKeyCode={['Backspace', 'Delete']}
  onNodesDelete={onNodesDelete}
  ...
/>
```

**Files**: `src/components/canvas/CanvasViewer.tsx`

---

### 1.3 ShapeNode Label Persistence
**Problem**: При редактировании текста в ShapeNode он не сохраняется в store

**Solution**:
```typescript
// ShapeNode.tsx - добавить вызов store action в handleBlur
const { updateShapeProperties } = useCanvasStore();

const handleBlur = useCallback(() => {
  setIsEditing(false);
  if (editValue !== data.label) {
    updateShapeProperties(id, { label: editValue });
  }
}, [editValue, data.label, id, updateShapeProperties]);
```

**Files**: `src/components/canvas/nodes/ShapeNode.tsx`

---

## Phase 2: Undo/Redo System

### 2.1 Install zustand-temporal
```bash
npm install zundo
```

### 2.2 Integrate with Store
```typescript
// canvasStore.ts
import { temporal } from 'zundo';

export const useCanvasStore = create<CanvasState>()(
  devtools(
    persist(
      temporal(
        (set, get) => ({
          // ... existing store
        }),
        {
          partialize: (state) => ({
            nodes: state.nodes,
            edges: state.edges,
          }),
          limit: 50, // Max history entries
        }
      ),
      { ... }
    )
  )
);

// Usage:
const { undo, redo, pastStates, futureStates } = useCanvasStore.temporal.getState();
```

### 2.3 Add Keyboard Shortcuts
```typescript
// CanvasViewer.tsx - в useEffect handleKeyDown
case 'z':
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    if (e.shiftKey) {
      useCanvasStore.temporal.getState().redo();
    } else {
      useCanvasStore.temporal.getState().undo();
    }
  }
  break;
```

### 2.4 UI Indicators
- Добавить кнопки Undo/Redo в toolbar
- Показывать disabled state когда история пуста

**Files**:
- `src/stores/canvasStore.ts`
- `src/components/canvas/CanvasViewer.tsx`
- New: `src/components/canvas/HistoryControls.tsx`

---

## Phase 3: Property Panel (Sidebar)

### 3.1 Create PropertyPanel Component
```typescript
// src/components/canvas/PropertyPanel.tsx
interface PropertyPanelProps {
  selectedNode: AppNode | null;
  onUpdate: (id: string, properties: Partial<ShapeNodeData>) => void;
}

// Features:
// - Color pickers for fillColor, borderColor
// - Border style selector (solid, dashed, none)
// - Label input
// - Node type display
// - Position (x, y) - optional
```

### 3.2 Layout
- Панель справа, 280px width
- Показывается только при выделении ноды
- Collapsible для мобильных устройств

### 3.3 Color Picker
Использовать `react-colorful` (lightweight) или native input[type=color]

**Files**:
- New: `src/components/canvas/PropertyPanel.tsx`
- Update: `src/components/canvas/CanvasViewer.tsx` (layout)

---

## Phase 4: Layout Improvements

### 4.1 Reset to Original Positions
**Requirement**: Сохранять позиции до layout, кнопка "Reset"

```typescript
// canvasStore.ts
interface CanvasState {
  // ...
  preLayoutPositions: Map<string, { x: number; y: number }> | null;

  savePreLayoutPositions: () => void;
  resetToPreLayout: () => void;
}
```

### 4.2 Groups as Blocks
При layout группы двигаются как единый блок, дети сохраняют относительные позиции.

```typescript
// algorithms.ts - update applyLayout
// 1. Собрать группы и их bounding box
// 2. Применить layout к группам как к большим нодам
// 3. Сместить детей вместе с группой
```

### 4.3 Import Dialog
После импорта Obsidian Canvas показывать диалог:
- "Keep original positions"
- "Apply Hierarchical layout"
- "Apply Grid layout"

**Files**:
- `src/lib/layout/algorithms.ts`
- `src/stores/canvasStore.ts`
- `src/components/canvas/LayoutToolbar.tsx`
- New: `src/components/canvas/ImportDialog.tsx`

---

## Phase 5: Polish & UX

### 5.1 Validation
- [ ] Edge creation работает между всеми типами нод
- [ ] Delete работает для нод и edges отдельно
- [ ] ShapeNode label сохраняется после blur и Enter
- [ ] Undo/Redo работает для всех операций
- [ ] Property panel обновляет ноду в реальном времени
- [ ] Layout reset возвращает точные позиции

### 5.2 Performance
- Debounce property panel updates
- Virtualize large canvases (>100 nodes)
- Optimize re-renders with React.memo

### 5.3 Accessibility
- Keyboard navigation between nodes
- Focus indicators
- Screen reader labels

---

## Implementation Order

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| 1 | Bug: Edge creation | HIGH | 15min |
| 2 | Bug: Delete nodes/edges | HIGH | 15min |
| 3 | Bug: ShapeNode label | HIGH | 10min |
| 4 | Undo/Redo (zundo) | HIGH | 1hr |
| 5 | Property Panel | MEDIUM | 2hr |
| 6 | Layout reset | MEDIUM | 30min |
| 7 | Groups as blocks | LOW | 1hr |
| 8 | Import dialog | LOW | 1hr |

---

## Dependencies to Add

```json
{
  "zundo": "^2.1.0",
  "react-colorful": "^5.6.1"
}
```

---

## Notes from Interview

1. **Usage**: Ежедневное использование - качество критично
2. **Goals**: И визуализация Obsidian, и редактор с нуля
3. **Undo**: Полный undo/redo для всех операций
4. **Panel**: Справа, sidebar
5. **Edges**: Стандартный drag от handle
6. **Groups**: При layout двигать как блок
7. **Import**: Диалог с выбором layout после импорта
