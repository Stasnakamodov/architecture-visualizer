# Задача: Исправить систему сохранения проектов — вечная загрузка и невозможность сохранить

Пиши на русском.

## Проект
`/Users/user/Desktop/communication/architecture-visualizer/` — Next.js 16 + React Flow (@xyflow/react) + Zustand (с persist + temporal middleware) + localStorage

## Главная проблема
Когда пользователь открывает уже сохранённый проект (из страницы Projects), в Header вечно крутится "Loading..." и кнопка Save заблокирована. Канвас при этом отображается нормально — видны ноды и связи.

## Архитектура хранения данных

### ДВЕ системы персистентности (это корень всех проблем):

**1. Auto-save (Zustand persist middleware)**
- Ключ localStorage: `arch-viz-canvas-state`
- Сохраняет: nodes, edges, documents, folders, visualGroups, viewport, viewMode
- Когда: Автоматически при каждом изменении state
- Настроен в: `src/stores/canvasStore.ts` → persist middleware

**2. Named save (ручное сохранение проектов)**
- Ключ localStorage: `arch-viz-canvases` (массив SavedCanvas)
- Сохраняет: name, nodes, edges, viewport, visualGroups
- Когда: Только при нажатии Save
- Настроен в: `src/lib/storage/localStorage.ts` → saveCanvas()/updateCanvas()

### Zustand middleware порядок:
```
create → devtools → temporal → persist
```

### Два источника правды для nodes/edges:
1. **React Flow** — `useNodesState()`/`useEdgesState()` в CanvasViewer (локальный стейт)
2. **Zustand store** — `store.nodes`/`store.edges` (глобальный стейт)

Синхронизация в CanvasViewer.tsx:
- **Local → Store** (строки ~178-185): `useEffect(() => { setStoreNodes(nodes) }, [nodes])` — синхронизирует каждое изменение обратно в store
- **Store → Local** (строки ~142-149): Восстановление из store при гидратации (однократно)
- **Store → Local** (строки ~187-203): Синхронизация data-изменений от PropertyPanel

## Ключевые файлы

### 1. `src/stores/canvasStore.ts` — Zustand store
**Критические поля:**
- `_hasHydrated: boolean` — НЕ персистится, начинается как `false`, должен стать `true` после гидратации
- `isDirty: boolean` — НЕ персистится, отслеживает несохранённые изменения для именованного сохранения
- `isCanvasOpen: boolean` — НЕ персистится, true когда канвас открыт
- `saveStatus: SaveStatus` — НЕ персистится, статус auto-save
- `currentCanvasId/currentCanvasName` — НЕ персистятся

**Текущая логика гидратации (проблемная):**
```typescript
// onRehydrateStorage (строка ~742):
onRehydrateStorage: () => () => {
  useCanvasStore.setState({ _hasHydrated: true });
},

// Fallback (строки ~762-775):
if (typeof window !== 'undefined') {
  if (useCanvasStore.persist.hasHydrated()) {
    setHydrated();
  }
  useCanvasStore.persist.onFinishHydration(setHydrated);
}
```

**Потенциальная проблема:** `useCanvasStore.persist` может быть недоступен из-за обёртки `temporal` middleware. Если `temporal` не проксирует `.persist` API, то fallback код на строках 762-775 падает с ошибкой и `_hasHydrated` никогда не становится true.

**Текущая логика partialize (недавно изменена):**
```typescript
partialize: (state) => {
  if (!state.isCanvasOpen) {
    return { nodes: [], edges: [], ... }; // Пустые данные когда канвас закрыт
  }
  return { nodes: state.nodes, ... }; // Реальные данные когда канвас открыт
},
```
Это значит: при закрытии канваса в localStorage записываются ПУСТЫЕ массивы. При следующей загрузке страницы auto-save пуст.

### 2. `src/components/layout/Header.tsx` — Верхняя панель
```typescript
const renderSaveStatus = () => {
  if (!_hasHydrated) return "Loading...";     // ← ВЕЧНО ТУТ ЗАСТРЕВАЕТ
  if (saveStatus === 'saving') return "Saving...";
  if (isDirty) return "Unsaved";
  if (lastNamedSaveAt) return "Saved HH:MM";
  return "Not saved";
};
// Save button disabled: disabled={!isDirty}
```

### 3. `src/app/import/page.tsx` — Главная страница канваса
**Загрузка проекта:**
```typescript
const handleLoadCanvas = useCallback((canvas: SavedCanvas) => {
  setCanvasData({ nodes, edges, viewport }); // Локальный React state
  setVisualGroups(canvas.visualGroups || []);  // Zustand update
  setCurrentCanvas(canvas);                    // Локальный React state
  markClean();                                 // isDirty = false
  openCanvas(canvas.id, canvas.name);          // isCanvasOpen = true
}, [...]);
```

**Загрузка из Projects page (через sessionStorage):**
```typescript
useEffect(() => {
  if (!_hasHydrated) return;
  const canvasIdToOpen = sessionStorage.getItem('open-canvas-id');
  if (canvasIdToOpen) {
    sessionStorage.removeItem('open-canvas-id');
    const canvasToOpen = getAllCanvases().find(c => c.id === canvasIdToOpen);
    if (canvasToOpen) handleLoadCanvas(canvasToOpen);
  }
}, [_hasHydrated, handleLoadCanvas]);
```
**Проблема:** Если `_hasHydrated` никогда не станет true, канвас из Projects page НИКОГДА не загрузится через этот useEffect. Но канвас ВСЁ РАВНО отображается — значит он загружается другим путём (напрямую через Recent или автоматически).

**handleSave callback (после SaveDialog):**
```typescript
const handleSave = (canvas: SavedCanvas) => {
  setCurrentCanvas(canvas);
  setRecentCanvases(getRecentCanvases(3));
  openCanvas(canvas.id, canvas.name);
  markClean();
};
```

### 4. `src/components/canvas/CanvasViewer.tsx` — React Flow канвас
**Инициализация:**
```typescript
const effectiveInitialNodes = hasHydrated && storeNodes.length > 0 ? storeNodes : initialNodes;
const [nodes, setNodes, onNodesChange] = useNodesState(effectiveInitialNodes);
```
Используется `useHydration()` hook (отдельный от `_hasHydrated` в store) — свой локальный state.

**markDirty вызывается:**
- `handleNodesChange` — для type !== 'dimensions' && !== 'select'
- `handleEdgesChange` — для type !== 'select'
- `onConnect` — при создании связи
- `onPaneClick` (при создании shape)
- `onPaneDoubleClick` (при создании comment)

**ПРОБЛЕМА: markDirty() вызывается при initial 'position' changes от fitView!**
Когда канвас загружается, React Flow делает `fitView` и обновляет позиции нод. Это генерирует 'position' change events. `handleNodesChange` считает их пользовательскими и вызывает `markDirty()`. В результате `isDirty` сразу становится `true` даже когда пользователь ничего не менял.

### 5. `src/hooks/useHydration.ts` — Хук гидратации
```typescript
export function useHydration() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const hasHydrated = useCanvasStore.getState()._hasHydrated;
    if (hasHydrated) { setHydrated(true); return; }
    const unsubscribe = useCanvasStore.subscribe((state) => {
      if (state._hasHydrated) setHydrated(true);
    });
    return () => unsubscribe();
  }, []);
  return hydrated;
}
```

### 6. `src/components/canvas/SaveDialog.tsx`
Получает `nodes` и `edges` как пропсы. В import/page.tsx:
```typescript
<SaveDialog
  nodes={storeNodes.length > 0 ? storeNodes : canvasData.nodes}
  edges={storeEdges.length > 0 ? storeEdges : canvasData.edges}
  ...
/>
```

### 7. `src/lib/storage/localStorage.ts`
```typescript
interface SavedCanvas {
  id: string; name: string; createdAt: string; updatedAt: string;
  nodes: AppNode[]; edges: AppEdge[];
  viewport: { x: number; y: number; zoom: number };
  visualGroups?: VisualGroup[];
}
```
Функции: `saveCanvas()`, `updateCanvas()`, `getCanvas()`, `getAllCanvases()`, `deleteCanvas()`, `getRecentCanvases()`

### 8. `src/app/projects/page.tsx`
```typescript
const handleOpen = (canvas: SavedCanvas) => {
  sessionStorage.setItem('open-canvas-id', canvas.id);
  router.push('/import');
};
```

## КОНКРЕТНЫЕ БАГИ

### БАГ 1 (КРИТИЧЕСКИЙ): `_hasHydrated` не становится true → вечный "Loading..."
**Симптом:** Header показывает "Loading..." навсегда, Save заблокирован.
**Вероятная причина:** `useCanvasStore.persist` API не доступен из-за обёртки `temporal` middleware, и fallback код на строках 762-775 молча падает. Или `onRehydrateStorage` не вызывается.
**Нужно:** Гарантировать что `_hasHydrated` ВСЕГДА станет true. Проверить доступность `.persist` API. Добавить robust fallback.

### БАГ 2: `markDirty()` вызывается при fitView → isDirty сразу true после загрузки
**Симптом:** Сразу после загрузки сохранённого проекта показывает "Unsaved", хотя ничего не менялось.
**Причина:** React Flow при `fitView` генерирует 'position' change events. `handleNodesChange` (строка ~320) считает position changes пользовательскими и вызывает `markDirty()`.
**Нужно:** Игнорировать position changes в течение ~500ms после загрузки канваса. Или добавить флаг `isInitialLoad` который блокирует markDirty.

### БАГ 3: Циклическая синхронизация React Flow ↔ Zustand
**Место:** CanvasViewer.tsx строки 178-185 и 142-149
```
Local nodes → setStoreNodes(nodes) → storeNodes changes → setNodes(storeNodes) → nodes changes → setStoreNodes(nodes) → ...
```
**Нужно:** Разорвать цикл. Добавить ref-guard чтобы sync effect не триггерил обратный sync.

### БАГ 4: partialize возвращает пустые данные при isCanvasOpen=false
**Проблема:** При закрытии канваса в localStorage записываются пустые массивы. При следующей загрузке store rehydrates с пустыми данными. Это ломает "Current Session" recovery и может вызвать unexpected state.
**Нужно:** Решить — нужен ли auto-save вообще? Если нет — убрать. Если да — не затирать данные при закрытии.

## ЧТО ДОЛЖНО РАБОТАТЬ ПОСЛЕ ИСПРАВЛЕНИЯ

1. ✅ Открыл сохранённый проект → статус "Saved HH:MM", Save заблокирован, НЕТ "Loading..."
2. ✅ Изменил что-то (подвинул ноду, добавил связь) → статус "Unsaved", Save активен
3. ✅ НЕ менял ничего — просто открыл и смотрю → НЕ показывает "Unsaved"
4. ✅ Нажал Save → обновился тот же проект, статус "Saved HH:MM"
5. ✅ Save as new → создался новый проект, currentCanvasId обновился
6. ✅ Назад без сохранения с изменениями → предупреждение "Unsaved changes"
7. ✅ Назад после сохранения → уходит без предупреждения
8. ✅ Коллекции (visualGroups) привязаны к проекту

## Запуск
```bash
cd /Users/user/Desktop/communication/architecture-visualizer
npm run dev
```
