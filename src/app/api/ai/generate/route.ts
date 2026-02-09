import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type ChatMessage } from '@/lib/ai/client';
import { GENERATE_CANVAS_PROMPT } from '@/lib/ai/prompts';
import { parseAICanvasResponse } from '@/lib/ai/schemas';

export async function POST(request: NextRequest) {
  try {
    const { prompt, locale = 'en' } = await request.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const localeInstruction = locale === 'ru'
      ? '\nОтвечай на русском языке (labels, descriptions).'
      : '\nRespond in English (labels, descriptions).';

    const userContent = `${GENERATE_CANVAS_PROMPT}${localeInstruction}\n\nArchitecture to visualize:\n${prompt.trim()}`;

    // Try up to 2 times if JSON parsing fails
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const messages: ChatMessage[] = [
          { role: 'user', content: attempt === 0
            ? userContent
            : userContent + '\n\nВАЖНО: предыдущий ответ содержал синтаксическую ошибку в JSON. Убедись что JSON валидный. Никакого текста кроме JSON.' },
        ];

        const responseText = await chatCompletion(messages);
        const { nodes, edges } = parseAICanvasResponse(responseText);

        const xs = nodes.map(n => n.position.x);
        const ys = nodes.map(n => n.position.y);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

        return NextResponse.json({
          nodes,
          edges,
          viewport: { x: -centerX + 400, y: -centerY + 300, zoom: 0.8 },
        });
      } catch (err: any) {
        lastError = err;
        console.error(`AI generate attempt ${attempt + 1} failed:`, err?.message);
        if (attempt < 1) continue;
      }
    }

    throw lastError;
  } catch (error: any) {
    console.error('AI generate error:', error);

    return NextResponse.json(
      { error: error?.message || 'Failed to generate canvas' },
      { status: 500 },
    );
  }
}
