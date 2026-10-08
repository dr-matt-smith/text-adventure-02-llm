import type { LlmRequest } from "../adventure/Translator.ts";

// LmStudio - asks the LLM running in LM Studio, on this computer
//
// LM Studio's server speaks the same "chat completions" language as OpenAI's, and so do Ollama
// and most other local LLM tools - so to use one of those instead, change URL and MODEL below.
//
// Before playing, start LM Studio's server with CORS turned on (the game page is a file on disk,
// and without CORS the browser won't let it talk to the server). The console has a button for it:
//
//     lms server start --cors

export const LLM_ENABLED = true;   // false: the game only understands its own commands
const URL = "http://127.0.0.1:1234/v1/chat/completions";
const MODEL = "qwen/qwen3.6-35b-a3b";
const TIMEOUT = 60_000;            // milliseconds to wait for an answer before giving up

// the parts of LM Studio's reply we read
interface ChatReply {
  choices?: { message?: { content?: string; reasoning_content?: string } }[];
}

// An AskLlm (see Translator.ts): sends the request, and returns the LLM's answer.
export async function askLmStudio(request: LlmRequest): Promise<string> {
  const response = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,              // the same answer every time, rather than a creative one
      max_tokens: 300,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      // Make the LLM answer in exactly this shape. (It also skips the slow "thinking" step.)
      response_format: {
        type: "json_schema",
        json_schema: { name: "reply", strict: true, schema: request.schema },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`LM Studio replied ${response.status}: ${await response.text()}`);
  }
  const reply = await response.json() as ChatReply;
  const message = reply.choices?.[0]?.message;
  // A "thinking" model like Qwen sometimes puts its answer in reasoning_content instead.
  return message?.content || message?.reasoning_content || "";
}
