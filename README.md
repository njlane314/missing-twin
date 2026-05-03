# Engram

Engram finds files a pull request probably forgot to change.

It learns from your repository's git history which files usually change together, then checks a PR for one-sided changes. If `openapi/customer.yaml` and `src/generated/customer-client.ts` have repeatedly changed in the same commits, and a new PR changes only the OpenAPI file, Engram reports that the generated client may be missing.

Engram is useful for catching omitted companion changes such as:

- generated clients after API or schema edits
- tests after source changes
- fixtures after parser or serializer changes
- docs after user-facing behavior changes
- migrations, config, or workflow updates that historically travel together

It is deterministic and local-first. It does not call an LLM, upload source code, or use telemetry.

## How It Works

Engram builds a repository-memory model from git history:

1. Reads recent non-merge commits.
2. Ignores configured authors, paths, and very large commits.
3. Counts file pairs that changed together.
4. Keeps strong relationships using support, confidence, and lift thresholds.
5. Compares the PR diff against those learned relationships.

When a changed file has a strong historical companion that is absent from the PR, Engram emits a finding.

## The Math

Engram treats each learned relationship as a directional rule:

```text
source file -> companion file
```

If `openapi/customer.yaml` and `src/generated/customer-client.ts` changed together in one commit, Engram records both directions:

```text
openapi/customer.yaml -> src/generated/customer-client.ts
src/generated/customer-client.ts -> openapi/customer.yaml
```

Direction matters. A generated file might often change when a schema changes, but a generated-file-only cleanup might not imply the schema should change.

### Commit Weights

Engram reads commits from newest to oldest. Recent commits count slightly more than older commits.

If there are `n` learned commits, commit `i` has this weight, where `i = 0` is the newest commit:

```text
weight_i = 1 - (i / (n - 1)) * 0.5
```

So the newest commit has weight `1.0`, the oldest commit has weight `0.5`, and commits between them are linearly spaced. If there is only one commit, its weight is `1.0`.

### Counts

For every file `A` and file `B`, Engram tracks:

```text
support(A -> B)
  The unweighted number of commits where A and B changed together.

source_support(A)
  The unweighted number of commits where A changed.

file_weight(A)
  The sum of commit weights for commits where A changed.

pair_weight(A -> B)
  The sum of commit weights for commits where A and B changed together.

total_commit_weight
  The sum of all learned commit weights.
```

### Confidence

Confidence answers: "When `A` changes, how often does `B` also change?"

```text
confidence(A -> B) = pair_weight(A -> B) / file_weight(A)
```

A confidence of `0.90` means that, weighted by recency, `B` changed in about 90% of the commits where `A` changed.

### Lift

Lift answers: "Is `B` specifically associated with `A`, or does `B` just change all the time?"

Engram first computes the background probability that `B` changes in any learned commit:

```text
background_probability(B) = file_weight(B) / total_commit_weight
```

Then it computes lift:

```text
lift(A -> B) = confidence(A -> B) / background_probability(B)
```

A lift of `1.0` means `B` is no more likely after `A` changes than it is in a normal commit. A lift of `3.0` means `B` is three times more likely when `A` changes than it is in the background history.

### Rule Filtering

A relationship becomes a rule only if it passes all configured thresholds:

```text
support(A -> B) >= min_support
confidence(A -> B) >= min_confidence
lift(A -> B) >= min_lift
```

With the default config, that means:

```text
support >= 4
confidence >= 0.7
lift >= 1.5
```

### Ranking Score

Rules that pass the thresholds get a stored model score:

```text
model_score = confidence * lift * ln(1 + support) * model_boost
```

`model_boost` is `1.25` when either file matches `boost_paths`; otherwise it is `1.0`.

During a scan, Engram applies the same kind of boost again when ranking candidates:

```text
scan_score = model_score * scan_boost
```

`scan_boost` is also `1.25` when either file matches `boost_paths`; otherwise it is `1.0`. Boosted paths do not bypass the thresholds. They only rank higher after they already pass support, confidence, and lift.

When scanning a PR, Engram looks at each changed file as a possible source. It reports a finding when:

```text
source changed in the PR
target did not change in the PR
source -> target passed the thresholds
```

The PR changed-file set comes from:

```text
git diff --name-only --diff-filter=ACMRT base...head
```

Ignored paths are removed before scanning. For each changed source file, Engram chooses the highest-scoring missing target for that source. It processes changed source files in path order and stops when it reaches `max_findings`.

## Example

Suppose your repository has many recent commits, and these are the commits involving `openapi/customer.yaml`:

| Commit | Files changed |
| --- | --- |
| `api client 1` | `openapi/customer.yaml`, `src/generated/customer-client.ts` |
| `api client 2` | `openapi/customer.yaml`, `src/generated/customer-client.ts` |
| `api client 3` | `openapi/customer.yaml`, `src/generated/customer-client.ts` |
| `api client 4` | `openapi/customer.yaml`, `src/generated/customer-client.ts` |
| `api client 5` | `openapi/customer.yaml`, `src/generated/customer-client.ts` |
| `api server only` | `openapi/customer.yaml` |

Assume the generated client is otherwise rare: it appears in only a few commits outside this API history. In simplified unweighted terms:

```text
source_support(openapi/customer.yaml) = 6
support(openapi/customer.yaml -> src/generated/customer-client.ts) = 5
confidence = 5 / 6 = 0.833

background_probability(src/generated/customer-client.ts) = 0.20
lift = 0.833 / 0.20 = 4.165
```

That passes the default thresholds:

```text
support >= 4
confidence >= 0.7
lift >= 1.5
```

Now a PR changes only:

```text
openapi/customer.yaml
```

Engram reports:

```markdown
Engram found 1 finding.

1. openapi/customer.yaml changed, but src/generated/customer-client.ts did not.
   Evidence: these files changed together in 5 of the last 6 relevant commits
   Recommendation: Commit the companion change, regenerate derived files, or ignore this warning if the omission is intentional.
```

That finding does not prove the PR is wrong. It points reviewers to a likely omission based on the repository's own memory.

## Install

```bash
pnpm add -D engram
```

## Run Locally

```bash
pnpm engram scan --base origin/main --head HEAD --config .github/engram.yml --format markdown
pnpm engram scan --base origin/main --head HEAD --format json
```

You can also precompute a model and reuse it:

```bash
pnpm engram learn --ref origin/main --since "18 months ago" --out .engram/model.json
pnpm engram scan --base origin/main --head HEAD --model .engram/model.json
```

## GitHub Actions

Use `actions/checkout` with full history so git comparisons are available.

```yaml
name: Engram

on:
  pull_request:

jobs:
  engram:
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
      - uses: Eidetic-Research/engram@v1
        with:
          mode: warn
          comment: true
          since: 18 months ago
```

Use `mode: fail` when findings should block the check. In `warn` mode, findings are reported but the action exits successfully unless a runtime error occurs.

## Config

Engram looks for `.github/engram.yml` by default. The file can either contain the config directly or under an `engram:` key.

```yaml
engram:
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

Important thresholds:

- `min_support`: how many commits must show the relationship.
- `min_confidence`: how often the companion changed when the source changed.
- `min_lift`: how much stronger the relationship is than ordinary background change frequency.
- `max_files_per_commit`: skips broad commits that would create noisy relationships.
- `max_findings`: caps the number of PR findings.

## JSON Output

```json
{
  "tool": "engram",
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
      "id": "engram:example",
      "severity": "warning",
      "title": "Likely omitted companion change",
      "message": "openapi/customer.yaml changed, but src/generated/customer-client.ts did not.",
      "evidence": {
        "source": "openapi/customer.yaml",
        "target": "src/generated/customer-client.ts",
        "support": 17,
        "source_commits": 19,
        "confidence": 0.895,
        "lift": 3.214,
        "summary": "these files changed together in 17 of the last 19 relevant commits"
      },
      "recommendation": "Commit the companion change, regenerate derived files, or ignore this warning if the omission is intentional."
    }
  ]
}
```

## Markdown Output

```markdown
Engram found 1 finding.

1. openapi/customer.yaml changed, but src/generated/customer-client.ts did not.
   Evidence: these files changed together in 17 of the last 19 relevant commits
   Recommendation: Commit the companion change, regenerate derived files, or ignore this warning if the omission is intentional.
```

## Notes

- No telemetry.
- No LLM calls.
- No source-code upload.
- No external network calls except GitHub API calls for optional PR comments.
- The hidden PR comment marker is `<!-- engram-report -->`.

## License

Engram is licensed under the Business Source License 1.1. Evaluation, development, testing, security review, and use in public open-source repositories are allowed. Commercial use, including private/internal CI use, managed services, resale, hosted services, or competing products, requires a paid commercial license from Eidetic Research.

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
