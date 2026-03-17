# Docker Build Performance Improvements

This document summarizes the Docker build optimizations currently present in the repository and explains where the remaining bottlenecks still are.

## Goal

The objective of these changes is to reduce the time spent rebuilding Docker images during development and testing by improving cache reuse, reducing build context size, and making build duration visible from the normal project workflow.

## Improvements Currently Active

### 1. Reduced Docker Build Context

The Docker build context is now whitelist-based in [.dockerignore](../.dockerignore).

What this changes:

- Only the `app/` source tree and `docker/` definitions are sent to Docker during builds.
- Large unrelated directories from the repository are excluded from context transfer.
- Local artifacts such as `node_modules`, build outputs, coverage data, logs, and environment files are kept out of the context.

Why it matters:

- Smaller context means less I/O before the build even starts.
- Fewer irrelevant file changes invalidate Docker cache layers.

### 2. Multi-Stage Production Image

The production backend image in [docker/Dockerfile.backend](../docker/Dockerfile.backend) now uses a staged build layout:

1. `build-base`: prepares Node and pnpm.
2. `deps`: installs native build dependencies and resolves Node dependencies.
3. `build`: copies application code, builds NestJS, and prunes dev dependencies.
4. `production`: copies only the runtime artifacts into the final image.

Why it matters:

- The runtime image is smaller and cleaner.
- Dependency installation can be reused independently from application source changes.
- Rebuilds after source-only edits avoid repeating the whole dependency pipeline when cache is warm.

### 3. BuildKit Cache Mounts for Faster Dependency Steps

The production Dockerfile uses BuildKit features with cache mounts for:

- Alpine package cache
- pnpm store cache
- node-gyp cache

Key commands currently used:

- `pnpm fetch --frozen-lockfile`
- `pnpm install --frozen-lockfile --offline`

Why it matters:

- Dependencies are fetched once and reused across builds.
- Native module rebuild overhead is reduced.
- Lockfile-driven installs become much more predictable.

### 4. Explicit Build Timing in the Makefile

The Makefile now includes timed build targets:

- [Makefile](../Makefile) target `docker-build`
- [Makefile](../Makefile) target `docker-build-prod`

These targets:

- capture the start and end time of the image build
- print a human-readable elapsed duration
- work through `docker buildx` when available

Why it matters:

- Build duration becomes visible in the standard workflow.
- It is easier to compare cold-cache and warm-cache behavior.
- Regressions become easier to spot during development.

### 5. Persistent Local Build Cache

When `docker buildx` is available, the Makefile stores cache data under `.docker/buildx-cache/`.

How it works:

- the previous cache is loaded with `--cache-from`
- the updated cache is exported with `--cache-to`
- the cache directory is persisted locally between builds

Why it matters:

- warm rebuilds become significantly faster than cold builds
- the improvement survives across repeated local build runs

The cache directory is ignored in [.gitignore](../.gitignore) so it does not pollute version control.

### 6. `docker-up` Uses the Timed Build Path First

The standard development startup target `docker-up` now depends on `docker-build` in [Makefile](../Makefile).

Why it matters:

- normal local startup goes through the optimized build wrapper
- developers do not need to remember a separate benchmark command

## Commands Available

Typical commands for inspecting build performance are:

```bash
make docker-build
make docker-build-prod
DOCKER_PROGRESS=plain make docker-build
```

`DOCKER_PROGRESS=plain` is useful when you want detailed BuildKit output in CI-style logs.

## Current Limitation

Two previously edited files were reverted afterward:

- [docker/Dockerfile.dev](../docker/Dockerfile.dev)
- [docker-compose.dev.yml](../docker-compose.dev.yml)

That means the following dev-specific optimizations are not currently active:

- the cache-mounted development Dockerfile variant
- explicit `image:` naming in the dev compose service to align `docker buildx build --load` with compose startup

Practical consequence:

- the production image path is optimized
- the Makefile timing and cache orchestration remain in place
- the development container definition is partially back on the older implementation, so some dev rebuild benefits are currently weaker than they could be

## Net Effect

The improvements already in place target the highest-value Docker bottlenecks:

- less context transfer
- better dependency-layer reuse
- faster warm builds through BuildKit local cache
- explicit timing for every build run
- cleaner production image output through multi-stage builds

## Recommended Next Step

To complete the optimization work, restore the dev-side Docker changes so the timed `docker-build` target and `docker compose` service use the same local image contract. That would make the development loop benefit from the same cache strategy as the production path.