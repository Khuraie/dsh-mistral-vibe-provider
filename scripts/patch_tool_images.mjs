/**
 * Tool-result images: Mistral's `role:"tool"` content is text-only, so the
 * upstream adapter flattened every image a tool returned into nothing. Feed
 * them back as a follow-up user message instead.
 */
import { readFileSync, writeFileSync } from "node:fs";

const HOST = new URL("../lib/index.js", import.meta.url);
const PKG = new URL("../package.json", import.meta.url);

function readText(url) {
  const raw = readFileSync(url, "utf8");
  return { text: raw.split("\r\n").join("\n"), crlf: raw.includes("\r\n") };
}
function writeText(url, text, crlf) {
  writeFileSync(url, crlf ? text.split("\n").join("\r\n") : text);
}
function replaceOnce(text, label, from, to) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: ${count} matches, expected 1`);
  return text.replace(from, to);
}

const host = readText(HOST);
let h = host.text;

/* 1. shared image-block -> content-part helper, next to the wire builders. */
h = replaceOnce(
  h,
  "helper",
  "/** Convert the harness transcript into Mistral chat messages. */",
  `/**
 * One image block -> one Mistral content part, or a text note when the bytes
 * cannot be read. Shared by the user-message path and the tool-result path.
 */
async function imageBlockToPart(block, attachments, signal) {
  const ref = block.attachment;
  if (typeof attachments?.readImageRequest !== "function") {
    return { type: "text", text: "\\n[image omitted: this route is text only]\\n" };
  }
  try {
    const image = await attachments.readImageRequest(ref, IMAGE_REQUEST_TARGET, signal);
    const bytes = image?.data;
    if (bytes === undefined || bytes === null) throw new Error("empty image");
    const base64 = Buffer.from(bytes).toString("base64");
    return {
      type: "image_url",
      image_url: \`data:\${image.mediaType ?? ref?.mediaType ?? "image/png"};base64,\${base64}\`,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { type: "text", text: \`\\n[image could not be read: \${reason.slice(0, 120)}]\\n\` };
  }
}

/** Convert the harness transcript into Mistral chat messages. */`,
);

/* 2. the user path now uses the shared helper. */
h = replaceOnce(
  h,
  "user path",
  `      if (block.type !== "image") continue;
      const ref = block.attachment;
      if (typeof attachments?.readImageRequest !== "function") {
        parts.push({ type: "text", text: "\\n[image omitted: this route is text only]\\n" });
        continue;
      }
      try {
        const image = await attachments.readImageRequest(ref, IMAGE_REQUEST_TARGET, signal);
        const bytes = image?.data;
        if (bytes === undefined || bytes === null) throw new Error("empty image");
        const base64 = Buffer.from(bytes).toString("base64");
        parts.push({
          type: "image_url",
          image_url: \`data:\${image.mediaType ?? ref?.mediaType ?? "image/png"};base64,\${base64}\`,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        parts.push({ type: "text", text: \`\\n[image could not be read: \${reason.slice(0, 120)}]\\n\` });
      }`,
  `      if (block.type !== "image") continue;
      parts.push(await imageBlockToPart(block, attachments, signal));`,
);

/* 3. buffer tool images; flush them as one user message before the next turn. */
h = replaceOnce(
  h,
  "flush setup",
  `  for (const message of options.messages ?? []) {
    if (message === null || typeof message !== "object") continue;
    const role = message.role;`,
  `  /**
   * Images returned by tool calls.
   *
   * Mistral's tool message is text-only, so the images cannot ride in the
   * tool result itself. They are buffered here and flushed as one user
   * message right before the next non-tool message (or at the end of the
   * transcript), which keeps every tool result adjacent to its assistant
   * tool_calls block -- the adjacency strict servers check.
   */
  const pendingToolImages = [];
  const flushToolImages = () => {
    if (pendingToolImages.length === 0) return;
    out.push({
      role: "user",
      content: [
        { type: "text", text: "[image(s) returned by the preceding tool call(s)]" },
        ...pendingToolImages.splice(0),
      ],
    });
  };

  for (const message of options.messages ?? []) {
    if (message === null || typeof message !== "object") continue;
    const role = message.role;
    if (role !== "tool") flushToolImages();`,
);

h = replaceOnce(
  h,
  "tool branch",
  `    if (role === "tool") {
      const callId = message.toolCallId ?? message.source?.callId;
      out.push({
        role: "tool",
        tool_call_id: shortId(callId),
        content: blocksToText(message.content, false),
      });
    }`,
  `    if (role === "tool") {
      const callId = message.toolCallId ?? message.source?.callId;
      const toolId = shortId(callId);
      out.push({
        role: "tool",
        tool_call_id: toolId,
        content: blocksToText(message.content, false),
      });
      // The same image blocks the user path reads; buffered, not dropped.
      const images = Array.isArray(message.content)
        ? message.content.filter((block) => block !== null && typeof block === "object" && block.type === "image")
        : [];
      for (const block of images) {
        pendingToolImages.push(await imageBlockToPart(block, attachments, signal));
      }
    }`,
);

h = replaceOnce(
  h,
  "final flush",
  `  if (system.length > 0) out.unshift({ role: "system", content: system });
  return out;`,
  `  flushToolImages();
  if (system.length > 0) out.unshift({ role: "system", content: system });
  return out;`,
);

h = replaceOnce(h, "build stamp", 'const BUILD = "0.1.2+vibe-code";', 'const BUILD = "0.1.3+vibe-code";');
writeText(HOST, h, host.crlf);

const pkg = readText(PKG);
writeText(PKG, replaceOnce(pkg.text, "version", '"version": "0.1.2"', '"version": "0.1.3"'), pkg.crlf);

console.log("tool-image patch applied");
