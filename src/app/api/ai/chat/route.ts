import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type ChatMessage } from '@/lib/ai/client';

const CHAT_SYSTEM_PROMPT = `You are an AI assistant embedded in Architecture Visualizer — a tool for creating and presenting software architecture diagrams.

You have access to the user's current canvas state (nodes and edges). The user may select one or several nodes/edges — pay close attention to the "SELECTED" section, it shows exactly which elements the user is asking about.

Your capabilities:
- Answer questions about the architecture
- Suggest improvements or additions
- Explain relationships between components
- Help with naming and descriptions
- Analyze uploaded files (.canvas, .json, text)
- Provide architecture best practices

Guidelines:
- Keep responses concise — displayed in a narrow side panel
- Use short paragraphs and bullet points
- Be specific about node names when referencing the architecture
- When nodes/edges are selected, focus your answer on those specific elements
- If the user uploads a .canvas file, analyze its structure and content`;

export async function POST(request: NextRequest) {
  try {
    const { message, files, context, history, locale = 'en' } = await request.json();

    if (!message && (!files || files.length === 0)) {
      return NextResponse.json({ error: 'Message or files required' }, { status: 400 });
    }

    const localeInstruction = locale === 'ru'
      ? '\nОтвечай на русском языке.'
      : '\nRespond in English.';

    // Build context string
    let contextStr = '';
    if (context?.nodes?.length) {
      contextStr += `\n\nCurrent canvas (${context.nodes.length} nodes):\n`;
      contextStr += context.nodes
        .map((n: { label?: string; id: string; type: string; description?: string }) =>
          `- ${n.label || n.id} (${n.type}${n.description ? ': ' + n.description : ''})`)
        .join('\n');
    }
    if (context?.edges?.length) {
      contextStr += `\n\nConnections (${context.edges.length}):\n`;
      contextStr += context.edges
        .map((e: { source: string; target: string; label?: string; sourceLabel?: string; targetLabel?: string }) =>
          `- ${e.sourceLabel || e.source} → ${e.targetLabel || e.target}${e.label ? ' (' + e.label + ')' : ''}`)
        .join('\n');
    }

    // Selected elements — this is what the user is focused on
    const hasSelectedNodes = context?.selectedNodes?.length > 0;
    const hasSelectedEdges = context?.selectedEdges?.length > 0;
    const hasSelectedNode = !!context?.selectedNode;
    const hasSelectedEdge = !!context?.selectedEdge;

    if (hasSelectedNodes || hasSelectedEdges || hasSelectedNode || hasSelectedEdge) {
      contextStr += `\n\n--- SELECTED (user is asking about these) ---`;
    }

    if (hasSelectedNodes) {
      contextStr += `\nSelected nodes (${context.selectedNodes.length}):`;
      for (const n of context.selectedNodes) {
        contextStr += `\n  * ${n.label || n.id} (${n.type}${n.description ? ': ' + n.description : ''})`;
      }
    } else if (hasSelectedNode) {
      contextStr += `\nSelected node: ${context.selectedNode.label} (${context.selectedNode.type})`;
    }

    if (hasSelectedEdges) {
      contextStr += `\nSelected edges (${context.selectedEdges.length}):`;
      for (const e of context.selectedEdges) {
        contextStr += `\n  * ${e.sourceLabel || e.source} → ${e.targetLabel || e.target}${e.label ? ' (' + e.label + ')' : ''}`;
      }
    } else if (hasSelectedEdge) {
      contextStr += `\nSelected edge: ${context.selectedEdge.sourceLabel || context.selectedEdge.source} → ${context.selectedEdge.targetLabel || context.selectedEdge.target}${context.selectedEdge.label ? ' (' + context.selectedEdge.label + ')' : ''}`;
    }

    // Build file contents
    let fileStr = '';
    if (files?.length) {
      fileStr = '\n\nAttached files:\n';
      for (const f of files) {
        const preview = f.content.length > 8000 ? f.content.slice(0, 8000) + '\n...(truncated)' : f.content;
        fileStr += `--- ${f.name} ---\n${preview}\n`;
      }
    }

    // Build messages array for GigaChat (system + history + user)
    const messages: ChatMessage[] = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT + localeInstruction },
    ];

    if (history?.length) {
      for (const h of history) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    const userContent = [message, fileStr, contextStr].filter(Boolean).join('\n');
    messages.push({ role: 'user', content: userContent });

    const responseText = await chatCompletion(messages);

    return NextResponse.json({ message: responseText });
  } catch (error: unknown) {
    console.error('AI chat error:', error);

    const err = error as { status?: number; message?: string };
    if (err?.message?.includes('auth failed')) {
      return NextResponse.json({ error: 'GigaChat: ошибка авторизации. Проверьте GIGACHAT_CREDENTIALS.' }, { status: 401 });
    }
    if (err?.message?.includes('429')) {
      return NextResponse.json({ error: 'Превышен лимит запросов. Попробуйте позже.' }, { status: 429 });
    }

    return NextResponse.json(
      { error: err?.message || 'Failed to process chat message' },
      { status: 500 },
    );
  }
}
