/**
 * Offline checks for the wire options: stop mapping and the reasoning-effort
 * fallback for stored (live-discovered) models.
 */
import http from "node:http";
import { MistralVibeAdapter, rememberStoredRow } from "../lib/index.js";

const recorded = [];

const server = http.createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    recorded.push(JSON.parse(body));
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write('data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"ok"}}]}\n\n');
    response.write("data: [DONE]\n\n");
    response.end();
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const ctx = { get: () => undefined };
function makeAdapter(config) {
  const adapter = new MistralVibeAdapter(() => config);
  Object.defineProperty(adapter, "ctx", { value: ctx, enumerable: false });
  return adapter;
}

async function drain(adapter, options) {
  try {
    for await (const chunk of adapter.stream(options)) void chunk;
  } catch {
    // The fake stream's shape is not a full Mistral SSE stream; the recorded
    // request body is what this test asserts, not the reply parsing.
  }
}

/* 1. stop sequences reach the wire. */
const stopAdapter = makeAdapter({ apiKey: "k", baseURL: `http://127.0.0.1:${port}/v1` });
await drain(stopAdapter, {
  model: "mistral-medium-2604",
  messages: [{ role: "user", content: "Count: one, two, three." }],
  stop: ["three", "five"],
});
const stopBody = recorded.at(-1);
console.log("stop mapped:", JSON.stringify(stopBody.stop), stopBody.stop ? "PASS" : "FAIL");

/* 2. a stored model without a wire map still gets reasoning_effort. */
rememberStoredRow({
  id: "labs-invented-1",
  name: "Invented 1",
  contextWindow: 262144,
  maxTokens: 32000,
  inputModalities: ["text"],
  reasoning: true,
  levels: ["low", "high"],
  discovered: true,
});
const storedAdapter = makeAdapter({ apiKey: "k", baseURL: `http://127.0.0.1:${port}/v1` });
await drain(storedAdapter, {
  model: "labs-invented-1",
  messages: [{ role: "user", content: "Think hard." }],
  reasoningEffort: "high",
});
const storedBody = recorded.at(-1);
console.log(
  "stored-model effort:",
  JSON.stringify(storedBody.reasoning_effort),
  storedBody.reasoning_effort === "high" ? "PASS" : "FAIL",
);

/* 3. a shipped model keeps its explicit wire map. */
const shippedAdapter = makeAdapter({ apiKey: "k", baseURL: `http://127.0.0.1:${port}/v1` });
await drain(shippedAdapter, {
  model: "zai-glm-5-3-flash",
  messages: [{ role: "user", content: "Think." }],
  reasoningEffort: "max",
});
const shippedBody = recorded.at(-1);
console.log(
  "shipped-model effort:",
  JSON.stringify(shippedBody.reasoning_effort),
  shippedBody.reasoning_effort === "max" ? "PASS" : "FAIL",
);

/* 4. "off" maps to Mistral's "none" for a stored model that declares it. */
rememberStoredRow({
  id: "labs-switchable-1",
  name: "Switchable 1",
  contextWindow: 131072,
  maxTokens: 32000,
  inputModalities: ["text"],
  reasoning: true,
  levels: ["off", "high"],
  discovered: true,
});
const offAdapter = makeAdapter({ apiKey: "k", baseURL: `http://127.0.0.1:${port}/v1` });
await drain(offAdapter, {
  model: "labs-switchable-1",
  messages: [{ role: "user", content: "Hi" }],
  reasoningEffort: "off",
});
const offBody = recorded.at(-1);
console.log(
  "off -> none:",
  JSON.stringify(offBody.reasoning_effort),
  offBody.reasoning_effort === "none" ? "PASS" : "FAIL",
);

server.close();
