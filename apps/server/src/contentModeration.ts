export type ModerationDecision = {
  requestId: string | null;
  rejected: boolean;
  riskTypes: string[];
};

type ModerationResponse = {
  request_id?: unknown;
  result_list?: unknown;
};

const parseDecision = (payload: ModerationResponse): ModerationDecision => {
  if (!Array.isArray(payload.result_list)) throw new Error('Moderation response is missing result_list');
  const risks = new Set<string>();
  for (const result of payload.result_list) {
    if (!result || typeof result !== 'object') throw new Error('Moderation response contains an invalid result');
    const riskTypes = (result as { risk_type?: unknown }).risk_type;
    if (riskTypes == null) continue;
    if (!Array.isArray(riskTypes) || !riskTypes.every((risk) => typeof risk === 'string')) {
      throw new Error('Moderation response contains invalid risk_type data');
    }
    riskTypes.map((risk) => risk.trim()).filter(Boolean).forEach((risk) => risks.add(risk));
  }
  return {
    requestId: typeof payload.request_id === 'string' ? payload.request_id.slice(0, 200) : null,
    rejected: risks.size > 0,
    riskTypes: [...risks],
  };
};

export async function moderateText(input: {
  text: string;
  apiKey: string;
  url: string;
  timeoutMs: number;
}): Promise<ModerationDecision> {
  const response = await fetch(input.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'moderation', input: input.text }),
    signal: AbortSignal.timeout(input.timeoutMs),
  });
  if (!response.ok) throw new Error(`Moderation API returned HTTP ${response.status}`);
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new Error('Moderation API returned invalid JSON'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Moderation API returned an invalid response');
  return parseDecision(payload as ModerationResponse);
}
