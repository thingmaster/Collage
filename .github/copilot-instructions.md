# Copilot / AI agent instructions — Collage

This file helps an AI coding agent become productive quickly in this repository. The repo currently has minimal contents; run the discovery steps below and update this file with project-specific details once code is present.

1) Quick repo discovery (run first)
- `git ls-files` — see tracked files
- `git status --porcelain` — check unstaged work
- `find . -maxdepth 3 -type f -name 'package.json' -o -name 'pyproject.toml' -o -name 'go.mod' -o -name 'Cargo.toml'` — locate language manifests
- `grep -R --line-number "main\(|if __name__ == '__main__'|package main" . || true` — find likely entrypoints

2) Identify language & build/test commands
- If `package.json` exists: use `npm install` then `npm test` / `npm run build`.
- If `pyproject.toml` / `requirements.txt` exists: use `python -m venv .venv && .venv/bin/pip install -r requirements.txt` or `pip install -e .` then `pytest -q`.
- If `go.mod` exists: `go test ./...` and `go build ./...`.
- If `Cargo.toml` exists: `cargo test` and `cargo build`.

3) Architecture discovery checklist
- Look for top-level dirs: `cmd/`, `internal/`, `pkg/`, `src/`, `server/`, `client/`, `api/`, `services/`.
- Search for configuration files: `Dockerfile`, `docker-compose.yml`, `.env`, `config/`, `settings/`.
- Search CI: `.github/workflows/` to learn pipeline steps and test commands.
- Note any generated-code markers (e.g. `// Code generated`, `@generated`) to avoid editing generated files.

4) Integration & runtime signals
- Search for env variables (`grep -R --line-number "ENV\(|process.env|os.Getenv|DATABASE_URL|AWS_"`) to find external integrations.
- Check `README.md`, `docs/`, or `.env.example` for service endpoints and required secrets.

5) Conventions to follow here
- Keep changes small and focused; prefer minimal, test-backed diffs.
- If the repo contains a `Makefile` or `task` targets, prefer those commands for CI parity.
- Respect generated code locations; run generators only when tests or build require it.

6) PR & commit guidance
- Use descriptive commits; include the problem, solution, and test notes.
- Run the repository's tests and linters before proposing a PR.

7) If you update this file
- After discovering concrete project files (language, build, CI), replace the generic sections above with exact commands and examples (e.g., `npm test` -> `npm run test:ci`).

If anything here is unclear or you'd like me to detect and populate the concrete commands automatically, tell me and I'll run the discovery commands and update this file.
