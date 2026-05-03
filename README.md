# Missing Twin

Find the file, test, doc, generated client, fixture, or config change this PR probably forgot.

A repository-memory engine that detects likely omitted companion changes in a PR. It runs locally by default, emits deterministic JSON and Markdown, writes a GitHub Step Summary when used as an action, and can update one stable PR comment when requested.

## Install

```bash
pnpm add -D missing-twin
```

Run locally:

```bash
pnpm missing-twin scan --base origin/main --head HEAD --config .github/missing-twin.yml --format markdown
pnpm missing-twin scan --base origin/main --head HEAD --format json
```

## GitHub Actions

Use `actions/checkout` with full history so git comparisons are available.

```yaml
name: Missing Twin

on:
  pull_request:

jobs:
  missing_twin:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: Eidetic-Research/missing-twin@v1
        with:
          mode: warn
          comment: true
          since: 18 months ago
```

Use `mode: fail` when findings should block the check. In `warn` mode, findings are reported but the action exits successfully unless a runtime error occurs.

## Config

Create `.github/missing-twin.yml`:

```yaml
missing_twin:
  since: "18 months ago"
  min_support: 4
  min_confidence: 0.7
  min_lift: 1.5
  max_files_per_commit: 80
  max_findings: 10
  ignore_authors:
    - "dependabot[bot]"
    - "renovate[bot]"
  ignore_paths:
    - "node_modules/**"
    - "dist/**"
    - "coverage/**"
  boost_paths:
    - "db/migrations/**"
    - "openapi/**"
    - "schema.graphql"
    - ".github/workflows/**"
```

## Example JSON

```json
{
  "tool": "missing-twin",
  "version": "0.1.3",
  "base": "origin/main",
  "head": "HEAD",
  "mode": "warn",
  "summary": {
    "findings": 1,
    "errors": 0,
    "warnings": 1
  },
  "findings": [
    {
      "id": "missing-twin:example",
      "severity": "warning",
      "title": "Example finding",
      "message": "openapi/customer.yaml changed, but src/generated/customer-client.ts did not.",
      "evidence": {},
      "recommendation": "Regenerate the client, commit the companion change, or ignore if intentionally server-only."
    }
  ]
}
```

## Example Markdown

```markdown
Missing Twin found 1 likely omission.

1. openapi/customer.yaml changed, but src/generated/customer-client.ts did not.
   Evidence: these files changed together in 17 of the last 19 relevant commits.
   Recommendation: regenerate the client, or ignore this warning if the API change is intentionally server-only.
```

## Notes

- No telemetry.
- No LLM calls.
- No source-code upload.
- No external network calls except GitHub API calls for optional PR comments.
- The hidden PR comment marker is `<!-- missing-twin-report -->`.

## License

Missing Twin is licensed under the Business Source License 1.1. Evaluation, development, testing, security review, and use in public open-source repositories are allowed. Commercial use, including private/internal CI use, managed services, resale, hosted services, or competing products, requires a paid commercial license from Eidetic Research.

Each version converts to Apache-2.0 on the earlier of its configured Change Date or the fourth anniversary of that version's first public distribution. See [LICENSE](LICENSE).

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm build:action
```

The action bundle is written to `dist/index.js` with `@vercel/ncc`. Marketplace publication notes are in [MARKETPLACE.md](MARKETPLACE.md).
