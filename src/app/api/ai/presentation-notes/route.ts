import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type ChatMessage } from '@/lib/ai/client';
import { GENERATE_CAPTIONS_PROMPT, GENERATE_SPEAKER_NOTES_PROMPT, GENERATE_NODE_CAPTIONS_PROMPT, GENERATE_NODE_SPEAKER_NOTES_PROMPT } from '@/lib/ai/prompts';
import { extractJSON } from '@/lib/ai/schemas';

export async function POST(request: NextRequest) {
  try {
    const { steps, nodes, edges, mode, locale = 'en', includeNodeSlides = false } = await request.json();

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: 'Steps array required' }, { status: 400 });
    }

    const localeInstruction = locale === 'ru'
      ? '\nОтвечай на русском языке.'
      : '\nRespond in English.';

    // Resolve node IDs to labels for context
    const nodeMap = new Map(
      (nodes || []).map((n: { id: string; label?: string; type?: string; description?: string }) => [n.id, n])
    );

    const stepsWithLabels = steps.map((s: { scenarioId: string; stepId: string; name: string; description: string; nodeIds: string[]; subSlideNodeIds?: string[] }) => ({
      ...s,
      key: `${s.scenarioId}:${s.stepId}`,
      nodeLabels: s.nodeIds
        .map((id: string) => {
          const node = nodeMap.get(id);
          return node ? `${(node as { label?: string }).label || id} (${(node as { type?: string }).type || 'node'})` : id;
        }),
      // Per-node keys for sub-slide generation
      ...(includeNodeSlides ? {
        nodeKeys: s.nodeIds.map((id: string) => ({
          nodeId: id,
          key: `${s.scenarioId}:${s.stepId}:${id}`,
          label: (() => {
            const node = nodeMap.get(id);
            return node ? (node as { label?: string }).label || id : id;
          })(),
          type: (() => {
            const node = nodeMap.get(id);
            return node ? (node as { type?: string }).type || 'node' : 'node';
          })(),
          description: (() => {
            const node = nodeMap.get(id);
            return node ? (node as { description?: string }).description || '' : '';
          })(),
        })),
      } : {}),
    }));

    const inputData = JSON.stringify({
      steps: stepsWithLabels,
      edges: (edges || []).slice(0, 50),
      includeNodeSlides,
    });

    // Choose prompt based on mode and whether node slides are included
    let prompt: string;
    if (mode === 'captions') {
      prompt = includeNodeSlides ? GENERATE_NODE_CAPTIONS_PROMPT : GENERATE_CAPTIONS_PROMPT;
    } else {
      prompt = includeNodeSlides ? GENERATE_NODE_SPEAKER_NOTES_PROMPT : GENERATE_SPEAKER_NOTES_PROMPT;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: prompt + localeInstruction },
      { role: 'user', content: inputData },
    ];

    const responseText = await chatCompletion(messages);
    const json = JSON.parse(extractJSON(responseText));

    return NextResponse.json({ notes: json.notes || {} });
  } catch (error: unknown) {
    console.error('AI presentation notes error:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err?.message || 'Failed to generate presentation notes' },
      { status: 500 },
    );
  }
}
