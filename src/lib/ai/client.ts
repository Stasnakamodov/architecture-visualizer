/**
 * GigaChat API Client (Сбер)
 * OAuth 2.0 + Chat Completions
 *
 * Сертификаты Минцифры не входят в стандартный trust store Node.js,
 * поэтому используем https.Agent с rejectUnauthorized: false
 */
import https from 'https';

const GIGACHAT_AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const GIGACHAT_API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';

const GIGACHAT_CREDENTIALS = process.env.GIGACHAT_CREDENTIALS || '';
const GIGACHAT_MODEL = process.env.GIGACHAT_MODEL || 'GigaChat';

// HTTPS agent без проверки сертификата (Минцифры)
const agent = new https.Agent({ rejectUnauthorized: false });

// Кэш токена
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Обёртка для HTTPS-запросов с кастомным agent
 */
function httpsRequest(url: string, options: {
  method: string;
  headers: Record<string, string>;
  body?: string;
}): Promise<{ status: number; data: any; text: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: options.headers,
      agent,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let data;
        try { data = JSON.parse(body); } catch { data = null; }
        resolve({ status: res.statusCode || 0, data, text: body });
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Получение OAuth токена с кэшированием
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const response = await httpsRequest(GIGACHAT_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': crypto.randomUUID(),
      'Authorization': `Basic ${GIGACHAT_CREDENTIALS}`,
    },
    body: 'scope=GIGACHAT_API_PERS',
  });

  if (response.status !== 200) {
    throw new Error(`GigaChat auth failed (${response.status}): ${response.text}`);
  }

  cachedToken = response.data.access_token;
  tokenExpiresAt = response.data.expires_at || (Date.now() + 30 * 60 * 1000);

  return cachedToken!;
}

/**
 * Вызов GigaChat Chat Completions API
 */
export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const token = await getAccessToken();

      const response = await httpsRequest(`${GIGACHAT_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: GIGACHAT_MODEL,
          messages,
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (response.status === 401) {
        cachedToken = null;
        tokenExpiresAt = 0;
        lastError = new Error('GigaChat: token expired');
        continue;
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`GigaChat error ${response.status}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
      }

      if (response.status !== 200) {
        throw new Error(`GigaChat API error (${response.status}): ${response.text}`);
      }

      const content = response.data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('GigaChat: empty response');
      }

      return content;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError || new Error('GigaChat: unknown error');
}
