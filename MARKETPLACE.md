# GitHub Marketplace Publishing Notes

Release title: PatchProof Missing Twin v0.1.2

Primary category: Code quality
Secondary category: Testing

Short description:
Find omitted companion changes from repository history.

Release notes:

PatchProof Missing Twin is a local-first GitHub Action and CLI from PatchProof. It produces JSON, Markdown, GitHub Step Summary output, and optional stable PR comments. It supports warn/fail modes, explicit base/head refs, and repository-local configuration.

This release prepares the action for GitHub Marketplace publication:

- single root action metadata file: action.yml
- no workflow files in the action repository
- bundled Node 20 action entrypoint in dist/index.js
- source-available BUSL-1.1 commercial licensing
- versioned CLI and action output: 0.1.2
- public open-source repository use allowed; commercial/private use requires a paid license

Suggested listing summary:
Find omitted companion changes from repository history.

Suggested listing body:
Use Missing Twin when pull requests need evidence before merge. The action runs locally on the checked-out repository, avoids telemetry and LLM calls, and only uses the GitHub API for optional PR comments. Configure it under .github/missing-twin.yml and choose warn mode for advisory checks or fail mode for blocking checks.
