# Contributing to mini-baas

Contribution guide for the backend-only repository.

## Getting Started

```bash
git clone git@github.com:Univers42/mini-baas.git || git clone https://github.com/Univers42/mini-baas.git
cd mini-baas
cp .env.example .env
make
```

Create your branch from `develop`:

```bash
git checkout develop && git pull
git checkout -b feature/my-change
```

## Daily Commands

| Command | Description |
|---|---|
| `make dev` | Start backend development services |
| `make test` | Run backend tests |
| `make lint` | Run ESLint |
| `make typecheck` | Run TypeScript checks |
| `make shell` | Open shell in dev container |
| `make help` | Show available targets |

## Repository Structure

```text
mini-baas/
├── apps/
│   └── backend/
├── packages/
│   └── shared/
├── docker/
├── vendor/
└── .github/
```

## Workflow

- Branch from `develop`.
- Keep PRs focused and small.
- Run `make lint typecheck test` before opening a PR.
- Squash-merge into `develop`.

## Commit Convention

Use Conventional Commits:

- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for internal cleanup
- `docs:` for documentation updates
- `test:` for test changes
- `chore:` for maintenance tasks

Examples:

- `feat(auth): add JWT refresh rotation`
- `fix(rate-limit): enforce tenant key fallback`

## Pull Requests

A good PR includes:

- Clear summary of what changed and why
- Linked issue/task if applicable
- Risk notes and rollback approach if needed
- Confirmation that lint, typecheck, and tests pass

## Security

Never commit credentials or secrets. Follow [SECURITY.md](SECURITY.md) for vulnerability reporting.

## AI Usage

AI assistance is allowed for scaffolding, debugging, and documentation. Every generated change must be reviewed and understood before merge.
