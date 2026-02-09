import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type ChatMessage } from '@/lib/ai/client';
import { DESCRIBE_NODES_PROMPT } from '@/lib/ai/prompts';
import { parseAIDescriptionsResponse } from '@/lib/ai/schemas';

export async function POST(request: NextRequest) {
  try {
    const { nodes, edges, nodeId, node, locale = 'en' } = await request.json();

    const localeInstruction = locale === 'ru'
      ? '\nОтвечай на русском языке.'
      : '\nRespond in English.';

    let inputData: string;

    if (nodeId && node) {
      inputData = JSON.stringify({
        nodes: [{ id: nodeId, type: node.type, label: node.label, connections: node.connections }],
        edges: [],
      });
    } else if (nodes && Array.isArray(nodes)) {
      inputData = JSON.stringify({
        nodes: nodes.map((n: any) => ({
          id: n.id,
          type: n.type,
          label: n.data?.label,
        })),
        edges: (edges || []).map((e: any) => ({
          source: e.source,
          target: e.target,
          label: e.data?.label || e.label || '',
        })),
      });
    } else {
      return NextResponse.json({ error: 'Nodes data is required' }, { status: 400 });
    }

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `${DESCRIBE_NODES_PROMPT}${localeInstruction}\n\nArchitecture data:\n${inputData}`,
      },
    ];

    const responseText = await chatCompletion(messages);
    const descriptions = parseAIDescriptionsResponse(responseText);
    return NextResponse.json({ descriptions });
  } catch (error: any) {
    console.error('AI describe error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate descriptions' },
      { status: 500 },
    );
  }
}
