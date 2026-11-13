/**
 * Offline proof of the tool-image fix.
 *
 * Runs a fake Mistral server that records the request body, points the real
 * adapter at it, and streams one turn whose tool result carries an image block.
 * The test passes when the recorded body shows the tool message as text AND a
 * follow-up user message carrying the image as a base64 image_url part.
 */
import http from "node:http";
import { MistralVibeAdapter } from "../lib/index.js";

const recorded = [];

const server = http.createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    recorded.push(body);
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write('data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"seen"}}]}\n\n');
    response.write("data: [DONE]\n\n");
    response.end();
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const fakeAttachments = {
  readImageRequest: async (ref, target, signal) => ({
    data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xde, 0xad, 0xbe, 0xef]),
    mediaType: "image/png",
  }),
};

const ctx = {
  get(name) {
    return name === "attachments" ? fakeAttachments : undefined;
  },
};

const adapter = new MistralVibeAdapter(() => ({
  apiKey: "test-key",
  baseURL: `http://127.0.0.1:${port}/v1`,
}));
Object.defineProperty(adapter, "ctx", { value: ctx, enumerable: false });

const messages = [
  { role: "user", content: "Look at the screenshot." },
  {
    role: "assistant",
    content: [{ type: "tool-call", callId: "call_abc", name: "read_image", arguments: '{"path":"x.png"}' }],
  },
  {
    role: "tool",
    toolCallId: "call_abc",
    content: [
      { type: "text", text: "image/png image, 1280x800 px, 249800 bytes" },
      { type: "image", attachment: { id: "att-1", mediaType: "image/png" } },
    ],
  },
];

let streamError;
try {
  for await (const chunk of adapter.stream({
    model: "zai-glm-5-3-flash",
    system: "You are a test.",
    messages,
  })) {
    void chunk;
  }
} catch (error) {
  streamError = error;
}

server.close();

if (recorded.length === 0) {
  console.log("FAIL: no request reached the fake server");
  console.log("stream error:", streamError?.message ?? streamError);
  process.exit(1);
}

const wire = JSON.parse(recorded[0]);
console.log("wire messages:");
for (const message of wire.messages) {
  const shape = typeof message.content === "string" ? "string" : `${message.content.length} parts`;
  console.log(`  ${message.role}${message.tool_call_id ? ` (${message.tool_call_id})` : ""} [${shape}]`);
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === "text") console.log(`    text: ${JSON.stringify(part.text.slice(0, 90))}`);
      if (part.type === "image_url") {
        const url = String(part.image_url);
        console.log(`    image_url: ${url.slice(0, 40)}… (${url.length} chars, base64=${url.includes("base64,")})`);
      }
    }
  }
}

const toolMessage = wire.messages.find((m) => m.role === "tool");
const imageUser = wire.messages.find(
  (m) => m.role === "user" && Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"),
);
const adjacency = wire.messages.findIndex((m) => m === imageUser) - wire.messages.findIndex((m) => m === toolMessage);

const pass =
  toolMessage !== undefined &&
  imageUser !== undefined &&
  adjacency === 1 &&
  toolMessage.content.includes("1280x800");

console.log(pass ? "\nPASS: tool image rides in a user message right after the tool result" : "\nFAIL: shape wrong");
if (streamError !== undefined) console.log("(stream error after request, informational):", streamError.message ?? streamError);
process.exit(pass ? 0 : 1);
