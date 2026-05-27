import OpenAI from "openai";
import type { ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export interface LlmEnv {
  DEEPSEEK_API_KEY?: string;
  AIMLAPI_KEY?: string;
  GLM_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

interface Provider {
  name: string;
  baseURL: string;
  apiKey: string | undefined;
  model: string;
  extraHeaders?: Record<string, string>;
}

function getProviders(env: LlmEnv): Provider[] {
  return [
    {
      name: "deepseek",
      baseURL: "https://api.deepseek.com/v1",
      apiKey: env.DEEPSEEK_API_KEY,
      model: "deepseek-chat"
    },
    {
      name: "aimlapi",
      baseURL: "https://api.aimlapi.com/v1",
      apiKey: env.AIMLAPI_KEY,
      model: "claude-sonnet-4-6"
    },
    {
      name: "glm",
      baseURL: "https://api.z.ai/api/coding/paas/v4",
      apiKey: env.GLM_API_KEY,
      model: "glm-4.6"
    },
    {
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      model: "anthropic/claude-sonnet-4.6",
      extraHeaders: {
        "HTTP-Referer": "https://longtailscout.com",
        "X-Title": "LongTail Scout"
      }
    }
  ].filter(p => p.apiKey);
}

export interface LlmCallOpts {
  system: string;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  toolChoice?: "auto" | "required";
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
}

export interface LlmResult {
  response: ChatCompletion;
  provider: string;
  model: string;
}

export async function llmCall(env: LlmEnv, opts: LlmCallOpts): Promise<LlmResult> {
  const providers = getProviders(env);
  if (providers.length === 0) {
    throw new Error("No LLM provider configured (set OPENROUTER_API_KEY, AIMLAPI_KEY, or GLM_API_KEY)");
  }

  const errors: string[] = [];
  for (const p of providers) {
    try {
      const client = new OpenAI({
        apiKey: p.apiKey!,
        baseURL: p.baseURL,
        defaultHeaders: p.extraHeaders
      });
      const payload: Parameters<typeof client.chat.completions.create>[0] = {
        model: p.model,
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
        max_tokens: opts.maxTokens ?? 4096
      };
      if (opts.tools && opts.tools.length > 0) {
        payload.tools = opts.tools;
        payload.tool_choice = opts.toolChoice ?? "auto";
      }
      if (opts.responseFormat === "json_object") {
        payload.response_format = { type: "json_object" };
      }
      const resp = await client.chat.completions.create(payload);
      return { response: resp as ChatCompletion, provider: p.name, model: p.model };
    } catch (err) {
      errors.push(`${p.name}: ${(err as Error).message}`);
    }
  }
  throw new Error(`All LLM providers failed: ${errors.join(" | ")}`);
}
