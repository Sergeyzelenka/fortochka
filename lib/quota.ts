// Учёт расхода квот ИИ-провайдеров.
// Groq: парсим x-ratelimit-* из заголовков (точные значения от провайдера).
// Gemini / APIYI: считаем сами с момента старта процесса (грубо, но видно).
// При перезапуске npm run dev счётчики сбрасываются.

interface GroqSnapshot {
  remainingRequests: number | null;
  limitRequests: number | null;
  remainingTokens: number | null;
  limitTokens: number | null;
  resetRequestsAt: string | null;
  resetTokensAt: string | null;
  updatedAt: string;
}

interface CountSnapshot {
  calls: number;
  errors: number;
  sinceProcessStart: string;
}

const startedAt = new Date().toISOString();

const groqByModel = new Map<string, GroqSnapshot>();
const counters = {
  gemini: { calls: 0, errors: 0, sinceProcessStart: startedAt } as CountSnapshot,
  apiyi:  { calls: 0, errors: 0, sinceProcessStart: startedAt } as CountSnapshot
};

function intOrNull(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function recordGroqResponse(model: string, res: Response) {
  const h = res.headers;
  groqByModel.set(model, {
    remainingRequests: intOrNull(h.get('x-ratelimit-remaining-requests')),
    limitRequests:     intOrNull(h.get('x-ratelimit-limit-requests')),
    remainingTokens:   intOrNull(h.get('x-ratelimit-remaining-tokens')),
    limitTokens:       intOrNull(h.get('x-ratelimit-limit-tokens')),
    resetRequestsAt:   h.get('x-ratelimit-reset-requests'),
    resetTokensAt:     h.get('x-ratelimit-reset-tokens'),
    updatedAt: new Date().toISOString()
  });
}

export function recordCall(provider: 'gemini' | 'apiyi', ok: boolean) {
  const c = counters[provider];
  c.calls += 1;
  if (!ok) c.errors += 1;
}

export function getSnapshot() {
  return {
    startedAt,
    groq: Object.fromEntries(groqByModel),
    gemini: counters.gemini,
    apiyi: counters.apiyi
  };
}
