import { OpenRouterRequest, OpenRouterResponse } from "./types.js";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_TIMEOUT_MS = 30_000;

interface TimeoutHandle {
  reset: () => void;
  clear: () => void;
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function setupTimeout(controller: AbortController): TimeoutHandle {
  let timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
  return {
    reset() {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
    },
    clear() {
      clearTimeout(timer);
    },
  };
}

async function readStreamedContent(
  res: Response,
  onActivity: () => void
): Promise<string> {
  const body = res.body;
  if (!body) {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let done = false;
  let eventLines: string[] = [];

  const flushEvent = () => {
    if (eventLines.length === 0) {
      return;
    }
    const raw = eventLines.join("");
    eventLines = [];
    if (!raw) {
      return;
    }
    if (raw === "[DONE]") {
      done = true;
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        choices?: Array<{
          delta?: { content?: string };
          message?: { content?: string };
        }>;
      };
      const delta =
        parsed.choices?.[0]?.delta?.content ??
        parsed.choices?.[0]?.message?.content ??
        "";
      if (delta) {
        content += delta;
      }
    } catch {
      // ignore malformed chunks
    }
  };

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) {
      buffer += decoder.decode();
      break;
    }
    onActivity();
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const trimmed = line.replace(/\r$/, "");
      if (trimmed.trim() === "") {
        flushEvent();
      } else if (trimmed.startsWith("data:")) {
        eventLines.push(trimmed.slice(5).trimStart());
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  if (buffer.length > 0) {
    const finalLine = buffer.replace(/\r$/, "");
    if (finalLine.trim() === "") {
      flushEvent();
    } else if (finalLine.startsWith("data:")) {
      eventLines.push(finalLine.slice(5).trimStart());
      flushEvent();
    }
  } else {
    flushEvent();
  }

  return content;
}

export interface OpenRouterClient {
  call(
    apiKey: string,
    payload: OpenRouterRequest,
    verbose?: boolean
  ): Promise<string>;
}

export function createOpenRouterClient(fetchImpl: FetchLike = fetch): OpenRouterClient {
  const call = async (
    apiKey: string,
    payload: OpenRouterRequest,
    verbose?: boolean
  ): Promise<string> => {
    if (!apiKey)
      throw new Error(
        "OpenRouter API key is required. Set --openrouter-key or ENV OPENROUTER_API_KEY."
      );

    const controller = new AbortController();
    const timeout = setupTimeout(controller);
    const wantsStream = payload.stream !== false;
    const requestPayload = wantsStream ? { ...payload, stream: true } : payload;

    try {
      const res = await fetchImpl(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      timeout.reset();

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `OpenRouter request failed: ${res.status} ${res.statusText} ${text}`
        );
      }

      const content = wantsStream
        ? await readStreamedContent(res, timeout.reset)
        : await (async () => {
            const data = (await res.json()) as OpenRouterResponse;
            return data?.choices?.[0]?.message?.content ?? "";
          })();

      if (!content) throw new Error("No content in OpenRouter response.");
      if (verbose) {
        // eslint-disable-next-line no-console
        console.error("[openrouter] response length:", content.length);
      }
      return content;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.message === "The operation was aborted")
      ) {
        throw new Error(
          `OpenRouter request timed out after ${OPENROUTER_TIMEOUT_MS}ms.`
        );
      }
      throw error;
    } finally {
      timeout.clear();
    }
  };

  return { call };
}

const defaultClient = createOpenRouterClient();

export const callOpenRouter = defaultClient.call;
