# tokengratis

CLI + MCP server for [tokengratis.id](https://tokengratis.id) — the
aggregator directory of free-tier & free-credit LLM APIs for Indonesian
developers.

Zero runtime dependencies. Plain Node ESM (`node >= 20`). Fetches the live
directory at request time — no bundled/stale copy shipped in this package.

**tokengratis.id is an aggregator, not a verifier.** Every provider and every
answer from this tool carries provenance (`sources[]` + `syncedAt`) — where
the data came from and when it was last synced. You will never see the word
"Verified" here.

## Data source

1. Primary: `https://tokengratis.id/api/providers`
2. Fallback (if the API is unreachable): `https://raw.githubusercontent.com/raymondchins/tokengratis-id/main/data/providers.json`

Responses are cached in memory for the process and to a short-TTL (1 hour)
file in the OS temp dir, so repeated CLI invocations don't re-fetch every
time.

## Install

Not yet published to npm. Until it is, run it straight from the repo (see
[Running from source](#running-from-source) below), or once published:

```bash
npm install -g tokengratis
# or run one-off without installing:
npx -y tokengratis list
```

## CLI usage

```
tokengratis list [--modality <m>] [--min-context <ctx>] [--json]
tokengratis show <slug> [--json]
tokengratis search <query> [--json]
tokengratis models [--provider <slug>] [--json]
tokengratis --help
tokengratis --version
```

Examples:

```bash
tokengratis list
tokengratis list --modality vision
tokengratis list --min-context 128K --json
tokengratis show openrouter
tokengratis search llama
tokengratis models --provider groq
```

- Plain text output by default; add `--json` to any command for
  machine-readable output.
- Color is auto-disabled when stdout isn't a TTY, or when `NO_COLOR` is set.
- Exits non-zero on error (bad slug, network failure, etc.) with a
  human-readable message — never a raw stack trace.

## MCP server usage

`tokengratis-mcp` speaks the Model Context Protocol over stdio
(newline-delimited JSON-RPC 2.0), implemented by hand with no SDK. It
exposes four tools:

- `list_providers` — optional `modality` / `min_context` filters
- `get_provider` — full detail for one provider by `slug`, incl. provenance
- `search_models` — substring search across provider/model names and ids
- `list_models` — flat model list, optional `provider` slug scope

### Claude Code / Cursor config

Once published to npm:

```json
{
  "mcpServers": {
    "tokengratis": {
      "command": "npx",
      "args": ["-y", "tokengratis-mcp"]
    }
  }
}
```

### Running from source (works today, package isn't published yet)

Clone the repo, then point your MCP client straight at the local file with
plain `node` — no install step needed since there are zero dependencies:

```json
{
  "mcpServers": {
    "tokengratis": {
      "command": "node",
      "args": ["/absolute/path/to/tokengratis-id/packages/tokengratis/src/mcp-server.mjs"]
    }
  }
}
```

(Swap `/absolute/path/to/tokengratis-id` for wherever you cloned
`https://github.com/raymondchins/tokengratis-id`.)

Same trick works for the CLI without installing:

```bash
node /absolute/path/to/tokengratis-id/packages/tokengratis/src/cli.mjs list
```

## License

MIT
