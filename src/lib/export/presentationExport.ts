import { toPng } from 'html-to-image';
import { buildNodeTraversalOrder } from '@/lib/presentation/graphTraversal';
import type { Presentation, Step } from '@/types/canvas';
import type { Scenario } from '@/stores/canvasStore';

interface ExportOptions {
  includeCaptions?: boolean;
  includeSpeakerNotes?: boolean;
  includeNodeSlides?: boolean;
}

interface PNGExportOptions {
  includeNodeSlides?: boolean;
}

/**
 * Callback to apply a step to the canvas before capture.
 * Must set node highlights, viewport, and positions synchronously
 * so the canvas reflects the step visually.
 */
export type ApplyStepForExport = (step: Step, scenarioId: string) => void;

/**
 * Get the React Flow container element for screenshot capture
 */
function getReactFlowElement(): HTMLElement | null {
  return document.querySelector('.react-flow') as HTMLElement | null;
}

/**
 * Wait for render to stabilize
 */
function waitForRender(ms = 600): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Capture the current React Flow canvas as a PNG data URL
 */
async function captureCanvas(): Promise<string> {
  const el = getReactFlowElement();
  if (!el) throw new Error('React Flow container not found');

  return toPng(el, {
    width: 1920,
    height: 1080,
    backgroundColor: '#111827', // gray-900
    style: {
      transform: 'none',
    },
  });
}

interface FlatExportSlide {
  step: Step;
  scenarioId: string;
  scenarioName: string;
  key: string;
  nodeId?: string;      // For node slides
  nodeLabel?: string;    // For naming
  isNodeSlide: boolean;
}

/**
 * Flatten presentation scenarios into ordered slides for export
 */
function flattenSlides(
  presentation: Presentation,
  scenarios: Scenario[],
  includeNodeSlides: boolean,
): FlatExportSlide[] {
  const result: FlatExportSlide[] = [];

  for (const scenarioId of presentation.scenarioIds) {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario || scenario.steps.length === 0) continue;

    const sorted = [...scenario.steps].sort((a, b) => a.order - b.order);
    for (const step of sorted) {
      // Overview slide
      result.push({
        step,
        scenarioId,
        scenarioName: scenario.name,
        key: `${scenarioId}:${step.id}`,
        isNodeSlide: false,
      });

      // Node slides (if enabled)
      if (includeNodeSlides && step.nodeIds.length > 0) {
        const { useCanvasStore } = require('@/stores/canvasStore');
        const edges = useCanvasStore.getState().edges;
        const nodes = useCanvasStore.getState().nodes;
        const { orderedNodeIds } = buildNodeTraversalOrder(step.nodeIds, edges, step.nodePositions);

        for (const nodeId of orderedNodeIds) {
          const node = nodes.find((n: { id: string }) => n.id === nodeId);
          result.push({
            step,
            scenarioId,
            scenarioName: scenario.name,
            key: `${scenarioId}:${step.id}:${nodeId}`,
            nodeId,
            nodeLabel: node?.data?.label || nodeId,
            isNodeSlide: true,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Export presentation as PNG images in a ZIP file
 */
export async function exportPresentationPNG(
  presentation: Presentation,
  scenarios: Scenario[],
  applyStep?: ApplyStepForExport,
  options: PNGExportOptions = {},
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const { includeNodeSlides = false } = options;

  const slides = flattenSlides(presentation, scenarios, includeNodeSlides);

  for (let i = 0; i < slides.length; i++) {
    if (applyStep) {
      applyStep(slides[i].step, slides[i].scenarioId);
    }
    await waitForRender(800);

    try {
      const dataUrl = await captureCanvas();
      const base64 = dataUrl.split(',')[1];
      const paddedIndex = String(i + 1).padStart(3, '0');
      const scenarioSafe = slides[i].scenarioName.replace(/[^a-zA-Z0-9]/g, '_');
      const suffix = slides[i].isNodeSlide
        ? (slides[i].nodeLabel || '').replace(/[^a-zA-Z0-9]/g, '_')
        : 'overview';

      zip.file(
        `slide_${paddedIndex}_${scenarioSafe}_${suffix}.png`,
        base64,
        { base64: true }
      );
    } catch (err) {
      console.error(`Failed to capture slide ${i + 1}:`, err);
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Export presentation as PDF
 */
export async function exportPresentationPDF(
  presentation: Presentation,
  scenarios: Scenario[],
  options: ExportOptions = {},
  applyStep?: ApplyStepForExport,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080] });

  const { includeCaptions = true, includeSpeakerNotes = false, includeNodeSlides = false } = options;
  const slides = flattenSlides(presentation, scenarios, includeNodeSlides);

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) pdf.addPage([1920, 1080], 'landscape');

    if (applyStep) {
      applyStep(slides[i].step, slides[i].scenarioId);
    }
    await waitForRender(800);

    try {
      const dataUrl = await captureCanvas();
      pdf.addImage(dataUrl, 'PNG', 0, 0, 1920, 1080);

      const notes = presentation.notes[slides[i].key];

      // Add caption bar at bottom
      if (includeCaptions && notes?.caption) {
        pdf.setFillColor(30, 30, 30);
        pdf.rect(0, 1000, 1920, 80, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(24);
        pdf.text(notes.caption, 960, 1045, { align: 'center', maxWidth: 1600 });
      }

      // Add speaker notes as a separate page
      if (includeSpeakerNotes && notes?.speakerNotes) {
        pdf.addPage([1920, 1080], 'landscape');
        pdf.setFillColor(17, 24, 39); // gray-900
        pdf.rect(0, 0, 1920, 1080, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(32);
        const title = slides[i].isNodeSlide
          ? `${slides[i].scenarioName} — ${slides[i].step.name} — ${slides[i].nodeLabel}`
          : `${slides[i].scenarioName} — ${slides[i].step.name}`;
        pdf.text(title, 100, 100);

        pdf.setTextColor(156, 163, 175); // gray-400
        pdf.setFontSize(20);
        pdf.text(notes.speakerNotes, 100, 180, { maxWidth: 1720 });
      }
    } catch (err) {
      console.error(`Failed to capture slide ${i + 1}:`, err);
    }
  }

  return pdf.output('blob');
}
