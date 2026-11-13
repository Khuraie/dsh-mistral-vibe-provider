/**
 * DeepSeek V4.1 Flash 1017 readiness check.
 *
 * The model is tier-gated on a free plan, so inference cannot be tested until
 * the subscription is active. Everything the adapter decides BEFORE the call can
 * still be verified: catalogue metadata, advertised modalities (with the
 * attachment service present, as in the real host), reasoning levels and their
 * wire mapping, and the exact request body the route would send.
 */
import http from "node:http";
import { MistralVibeAdapter } from "../lib/index.js";

const recorded = [];
const server = http.createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    recorded.push(JSON.parse(body));
    response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    response.write('data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"ok"}}]}\n\n');
    response.write("data: [DONE]\n\n");
    response.end();
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

/* The real host mounts the attachment service; mirror it so modalities are the
 * true production answer rather than the "no service" fallback. */
const fakeAttachments = {
  readImageRequest: async () => ({ data: Buffer.from([0x89, 0x50, 0x4e, 0x47]), mediaType: "image/png" }),
};
const ctx = { get: (name) => (name === "attachments" ? fakeAttachments : undefined) };
const adapter = new MistralVibeAdapter(() => ({ apiKey: "test-key", baseURL: `http://127.0.0.1:${port}/v1` }));
Object.defineProperty(adapter, "ctx", { value: ctx, enumerable: false });

const MODEL = "deepseek-v4-1-flash-1017";
const info = await adapter.resolveModel("mistral-vibe", MODEL);
console.log("resolveModel:", JSON.stringify(info));

const checks = [];
checks.push(["id matches", info.id === MODEL]);
checks.push(["context 1,048,576", info.context?.contextWindow === 1048576]);
checks.push(["default output 65536 (adapter clamp, inside harness range)", info.defaultMaxTokens === 65536]);
checks.push(["image modality advertised", (info.inputModalities ?? []).includes("image")]);
const efforts = (info.reasoning?.efforts ?? []).map((e) => e.id);
checks.push(["effort ladder off/low/high/max", JSON.stringify(efforts) === JSON.stringify(["off", "low", "high", "max"])]);
checks.push(["default effort off", info.reasoning?.defaultEffort === "off"]);

/* The exact body the route would send for a reasoning + image + tools turn. */
const message = [
  {
    role: "user",
    content: [
      { type: "text", text: "What is in this screenshot?" },
      { type: "image", attachment: { id: "att-1", mediaType: "image/png" } },
    ],
  },
];

/** Stream one turn against the fake server and return the recorded body. */
async function send(overrides) {
  try {
    for await (const chunk of adapter.stream({ model: MODEL, messages: message, ...overrides })) void chunk;
  } catch {
    // Fake stream is not a full Mistral SSE payload; the recorded body is what matters.
  }
  return recorded.at(-1);
}

const body = await send({
  reasoningEffort: "high",
  maxTokens: 4096,
  temperature: 0.3,
  tools: [
    { name: "read_file", description: "Read a file", parameters: { type: "object", properties: { path: { type: "string" } } } },
  ],
});
console.log("\nwire body:");
console.log(JSON.stringify({
  model: body.model,
  stream: body.stream,
  reasoning_effort: body.reasoning_effort,
  max_tokens: body.max_tokens,
  temperature: body.temperature,
  tools: (body.tools ?? []).map((t) => t.function.name),
  tool_choice: body.tool_choice,
  parallel_tool_calls: body.parallel_tool_calls,
  message_shapes: body.messages.map((m) => ({ role: m.role, parts: Array.isArray(m.content) ? m.content.map((p) => p.type) : "string" })),
}, null, 1));

checks.push(["reasoning_effort high -> high", body.reasoning_effort === "high"]);
checks.push(["max_tokens capped at catalogue", body.max_tokens === 4096]);
checks.push(["temperature forwarded", body.temperature === 0.3]);
checks.push(["tool declared", (body.tools ?? []).length === 1]);
checks.push(["image part on the wire", JSON.stringify(body.messages).includes("image_url")]);
const wide = await send({ maxTokens: 100000 });
checks.push(["explicit 100k maxTokens passes the 128k catalogue ceiling", wide.max_tokens === 100000]);
const over = await send({ maxTokens: 999999 });
checks.push(["maxTokens above the catalogue ceiling is clamped to 128000", over.max_tokens === 128000]);

let failed = 0;
console.log("\nchecks:");
for (const [label, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
}
console.log(failed === 0 ? "\nDEEPSEEK READY (everything decidable before the tier gate passes)" : `\n${failed} CHECK(S) FAILED`);
server.closeAllConnections?.();
server.close();
setTimeout(() => process.exit(failed === 0 ? 0 : 1), 100);
