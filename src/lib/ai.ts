import type { AdminSettings } from "../types";

type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AICommandPayload = {
  instruction: string;
  context: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function endpointFor(settings: AdminSettings) {
  const baseUrl = settings.aiBaseUrl.trim().replace(/\/+$/g, "");
  if (!baseUrl) throw new Error("Set an AI API base URL first.");
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  return `${baseUrl}/chat/completions`;
}

function modelFor(settings: AdminSettings) {
  const model = settings.aiModel.trim();
  if (!model) throw new Error("Set an AI model first.");
  return model;
}

export async function runAICommand(settings: AdminSettings, payload: AICommandPayload) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (settings.aiApiKey.trim()) {
    headers.Authorization = `Bearer ${settings.aiApiKey.trim()}`;
  }

  const messages: AIMessage[] = [
    {
      role: "system",
      content:
        "You are a focused Markdown writing assistant for a personal Astro/Fuwari blog. Preserve Markdown structure. Return only the requested writing output, without explanations unless asked.",
    },
    {
      role: "user",
      content: `${payload.instruction}\n\n--- Current document context ---\n${payload.context}`,
    },
  ];

  const response = await fetch(endpointFor(settings), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelFor(settings),
      temperature: 0.7,
      messages,
    }),
  });

  const text = await response.text();
  let json: ChatCompletionResponse | null = null;

  try {
    json = text ? (JSON.parse(text) as ChatCompletionResponse) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(json?.error?.message || text || `AI request failed with ${response.status}.`);
  }

  const output = json?.choices?.[0]?.message?.content?.trim();
  if (!output) throw new Error("AI response did not include any text.");

  return output;
}
