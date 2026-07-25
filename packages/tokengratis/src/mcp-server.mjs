#!/usr/bin/env node
// tokengratis-mcp — Model Context Protocol server for the tokengratis.id
// free-tier LLM API directory, implemented by hand over stdio
// (newline-delimited JSON-RPC 2.0). Zero dependencies, no SDK.
//
// HARD RULE: nothing but JSON-RPC may ever touch stdout. All logging /
// diagnostics go to stderr, always.

import { readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import { getProviders, DataFetchError } from "./lib/data.mjs";
import { filterByModality, filterByMinContext, searchProviders, listModels } from "./lib/filters.mjs";
import {
  formatProviderListText,
  formatProviderText,
  formatModelListText,
  formatSearchResultsText,
} from "./lib/render.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

const SERVER_NAME = "tokengratis-mcp";
const SERVER_VERSION = pkg.version;
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

const TOOLS = [
  {
    name: "list_providers",
    description:
      "List free-tier LLM API providers from the tokengratis.id directory (Indonesia-focused, community-aggregated — this is an aggregator, not an authority that checks each claim). Optional filters by modality and minimum context window. Each result carries model counts; use get_provider for full detail + provenance.",
    inputSchema: {
      type: "object",
      properties: {
        modality: {
          type: "string",
          description:
            "Filter by capability, e.g. text, vision, image, audio, video, code, embeddings, reranking.",
        },
        min_context: {
          type: "string",
          description: "Minimum context window, e.g. '128K' or '1M'.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_provider",
    description:
      "Get full detail for one tokengratis.id provider by slug: base URL, free-tier limit description, its models, and provenance (which source(s) contributed the data and when each was synced). This is an aggregator, not a verifier.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Provider slug, e.g. 'openrouter'. Use list_providers to discover slugs.",
        },
      },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  {
    name: "search_models",
    description:
      "Search tokengratis.id providers and models by substring match against provider name/slug and model name/id.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text, e.g. 'llama' or 'groq'." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_models",
    description: "Flat list of models across all tokengratis.id providers, optionally scoped to one provider slug.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", description: "Optional provider slug to scope results to." },
      },
      additionalProperties: false,
    },
  },
];

class ToolInputError extends Error {}
class ToolNotFoundError extends Error {}

function textResult(text) {
  return { content: [{ type: "text", text }] };
}

async function callTool(name, rawArgs) {
  const args = rawArgs && typeof rawArgs === "object" ? rawArgs : {};
  const { providers } = await getProviders();

  switch (name) {
    case "list_providers": {
      let list = providers;
      list = filterByModality(list, args.modality);
      list = filterByMinContext(list, args.min_context);
      return textResult(formatProviderListText(list));
    }
    case "get_provider": {
      if (!args.slug || typeof args.slug !== "string") {
        throw new ToolInputError("Parameter 'slug' wajib diisi (string).");
      }
      const p = providers.find((x) => x.slug === args.slug);
      if (!p) {
        throw new ToolInputError(`Provider dengan slug "${args.slug}" tidak ditemukan.`);
      }
      return textResult(formatProviderText(p));
    }
    case "search_models": {
      if (!args.query || typeof args.query !== "string") {
        throw new ToolInputError("Parameter 'query' wajib diisi (string).");
      }
      const results = searchProviders(providers, args.query);
      return textResult(formatSearchResultsText(results, args.query));
    }
    case "list_models": {
      const rows = listModels(providers, typeof args.provider === "string" ? args.provider : undefined);
      return textResult(formatModelListText(rows));
    }
    default:
      throw new ToolNotFoundError(`Unknown tool: ${name}`);
  }
}

// ---- JSON-RPC plumbing -----------------------------------------------

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  send({ jsonrpc: "2.0", id, error });
}

/** @param {any} msg */
async function handleMessage(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
    // Not a valid single JSON-RPC object. We have no id to reply against
    // meaningfully, but report a parse/invalid-request error anyway.
    sendError(null, -32700, "Parse error: expected a JSON object");
    return;
  }

  const hasId = Object.prototype.hasOwnProperty.call(msg, "id");
  const { method } = msg;

  // Notifications (no "id") never get a response, per JSON-RPC 2.0 / MCP.
  if (!hasId) {
    if (method !== "notifications/initialized") {
      console.error(`[${SERVER_NAME}] notification: ${method}`);
    }
    return;
  }

  try {
    switch (method) {
      case "initialize": {
        const requested = msg.params && msg.params.protocolVersion;
        sendResult(msg.id, {
          protocolVersion: typeof requested === "string" ? requested : DEFAULT_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        });
        return;
      }
      case "ping": {
        sendResult(msg.id, {});
        return;
      }
      case "tools/list": {
        sendResult(msg.id, { tools: TOOLS });
        return;
      }
      case "tools/call": {
        const params = msg.params || {};
        try {
          const result = await callTool(params.name, params.arguments);
          sendResult(msg.id, result);
        } catch (err) {
          if (err instanceof ToolNotFoundError) {
            sendError(msg.id, -32601, err.message);
          } else if (err instanceof ToolInputError || err instanceof DataFetchError) {
            // Tool-level failure: valid JSON-RPC response, but flagged as an
            // error result so the model sees it as text, not a protocol error.
            sendResult(msg.id, { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
          } else {
            sendError(msg.id, -32603, err && err.message ? err.message : String(err));
          }
        }
        return;
      }
      default:
        sendError(msg.id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    sendError(msg.id, -32603, err && err.message ? err.message : String(err));
  }
}

function main() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  // Tool calls are async (they fetch over the network). If stdin closes
  // while one is still in flight — e.g. a client that writes its requests
  // and immediately closes the pipe — we must NOT exit until every
  // in-flight response has actually been written to stdout, or replies
  // silently vanish.
  let pending = 0;
  let closing = false;
  const maybeExit = () => {
    if (closing && pending === 0) process.exit(0);
  };

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      sendError(null, -32700, "Parse error: invalid JSON");
      return;
    }

    // Be tolerant of JSON-RPC batch arrays even though MCP stdio normally
    // sends one message per line.
    const messages = Array.isArray(msg) ? msg : [msg];
    for (const m of messages) {
      pending++;
      handleMessage(m)
        .catch((err) => {
          console.error(`[${SERVER_NAME}] unhandled error:`, err);
        })
        .finally(() => {
          pending--;
          maybeExit();
        });
    }
  });

  rl.on("close", () => {
    closing = true;
    maybeExit();
  });

  console.error(`[${SERVER_NAME}] v${SERVER_VERSION} ready (stdio, JSON-RPC 2.0)`);
}

main();
