import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type ChatMessage } from '@/lib/ai/client';
import { GENERATE_STEPS_PROMPT, GENERATE_SCENARIOS_PROMPT } from '@/lib/ai/prompts';
import { parseAIStepsResponse, parseAIScenariosResponse } from '@/lib/ai/schemas';

export async function POST(request: NextRequest) {
  try {
    const { nodes, edges, mode = 'steps', locale = 'en' } = await request.json();

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json({ error: 'Nodes array is required' }, { status: 400 });
    }

    const localeInstruction = locale === 'ru'
      ? '\nОтвечай на русском языке (names, descriptions).'
      : '\nRespond in English (names, descriptions).';

    const inputData = JSON.stringify({
      nodes: nodes.map((n: any) => ({
        id: n.id,
        type: n.type,
        label: n.data?.label,
        description: n.data?.description,
      })),
      edges: (edges || []).map((e: any) => ({
        source: e.source,
        target: e.target,
        label: e.data?.label || e.label || '',
      })),
    });

    const systemPrompt = mode === 'scenarios' ? GENERATE_SCENARIOS_PROMPT : GENERATE_STEPS_PROMPT;

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `${systemPrompt}${localeInstruction}\n\nArchitecture data:\n${inputData}`,
      },
    ];

    const responseText = await chatCompletion(messages);

    const validNodeIds = new Set<string>(nodes.map((n: any) => n.id));
    const allNodeIds = nodes.map((n: any) => n.id);

    if (mode === 'scenarios') {
      const scenarios = parseAIScenariosResponse(responseText, validNodeIds, allNodeIds);
      return NextResponse.json({ scenarios });
    } else {
      const steps = parseAIStepsResponse(responseText, validNodeIds);
      return NextResponse.json({ steps });
    }
  } catch (error: any) {
    console.error('AI stepper error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate steps' },
      { status: 500 },
    );
  }
}
