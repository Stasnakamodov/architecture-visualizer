import { useStore } from 'zustand';
import { useCanvasStore } from '@/stores/canvasStore';

export const useTemporalStore = () => {
  const temporalStore = useCanvasStore.temporal;

  const pastStates = useStore(temporalStore, (state) => state.pastStates);
  const futureStates = useStore(temporalStore, (state) => state.futureStates);
  const undo = useStore(temporalStore, (state) => state.undo);
  const redo = useStore(temporalStore, (state) => state.redo);
  const clear = useStore(temporalStore, (state) => state.clear);

  return { pastStates, futureStates, undo, redo, clear };
};
