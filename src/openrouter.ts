import { OpenRouterRequest, OpenRouterResponse } from "./types.js";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouter(
  apiKey: string,
  payload: OpenRouterRequest,
  verbose?: boolean
): Promise<string> {
  if (!apiKey)
    throw new Error(
      "OpenRouter API key is required. Set --openrouter-key or ENV OPENROUTER_API_KEY."
    );

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter request failed: ${res.status} ${res.statusText} ${text}`
    );
  }
  const data = (await res.json()) as OpenRouterResponse;
  const content = data?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("No content in OpenRouter response.");
  if (verbose) {
    // eslint-disable-next-line no-console
    console.error("[openrouter] response length:", content.length);
  }
  return content;
}
