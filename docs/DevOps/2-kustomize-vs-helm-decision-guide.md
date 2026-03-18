# mini-baas - Kustomize vs Helm Decision Guide

> This document compares Kustomize and Helm for `mini-baas` Kubernetes orchestration and provides a decision framework aligned with a multi-repo platform.

## 1. Why This Decision Matters

`mini-baas` is moving from Docker Compose orchestration to Kubernetes across multiple services:

- `api-gateway`
- `auth-service`
- `dynamic-api`
- `schema-service`
- `shared-library` (usually build-time only)

The delivery model chosen now affects:

- how quickly environments are created,
- how easy it is to review deployment changes,
- how much template complexity teams maintain long-term.

---

## 2. Executive Summary

- Use **Kustomize** when you want clear YAML overlays, low abstraction, and easier manifest review.
- Use **Helm** when you need reusable package distribution, stronger parameterization, and chart ecosystems.
- For `mini-baas`, a pragmatic approach is:
  - start with an **infra structure independent of both tools**,
  - begin with **Kustomize for first environment rollout**,
  - introduce **Helm only if chart reuse and packaging needs become clear**.

---

## 3. Side-by-Side Comparison

| Topic | Kustomize | Helm |
| --- | --- | --- |
| Core model | Overlay/patch native YAML | Template engine + values + release manager |
| Learning curve | Lower if team knows Kubernetes YAML | Higher due to template language and chart concepts |
| Readability of output | Very high (mostly plain manifests) | Variable (templates can become complex) |
| DRY reuse | Moderate (bases/overlays/components) | High (templates/functions/subcharts) |
| Parametrization | Limited but explicit | Strong and dynamic |
| Debugging | Straightforward (`kustomize build`) | Needs template rendering and values tracing |
| Ecosystem | Built into `kubectl` | Large chart ecosystem and packaging workflows |
| Release history/rollback | External tooling required | Native release revision tracking |
| Governance/review | Diff-friendly, declarative patches | Can hide complexity behind templates |
| Best fit | Platform teams favor explicit manifests | Product/platform teams distributing reusable charts |

---

## 4. Pros and Cons

## Kustomize Pros

- Keeps Kubernetes manifests close to upstream native resources.
- Overlay model is easy to reason about for `local`, `staging`, and `production`.
- Better pull request readability for infrastructure changes.
- No template language lock-in.
- Built into `kubectl`, fewer moving parts.

## Kustomize Cons

- Limited parameterization can lead to duplication for complex permutations.
- Reuse patterns are weaker than Helm in large, shared chart scenarios.
- No built-in release object lifecycle like Helm revisions.

## Helm Pros

- Strong templating and value-driven configuration at scale.
- Excellent for reusable service packaging and versioned distribution.
- Strong ecosystem (existing charts for dependencies and operators).
- Native release metadata and rollback behavior.

## Helm Cons

- Template complexity can become hard to maintain.
- Rendered output is not always obvious from templates alone.
- Harder PR review when logic is hidden in helpers and conditions.
- Risk of over-abstracting too early.

---

## 5. Project-Specific Fit for mini-baas

Signals that favor Kustomize first:

- You are in research/architecture phase and need transparent manifests.
- Service count is moderate and domain still evolving.
- Team needs quick comprehension over packaging sophistication.

Signals that favor Helm first:

- You plan to distribute standardized charts across many teams/projects.
- You need heavy configuration matrices per environment/tenant.
- You need chart version lifecycle as a first-class concern immediately.

Recommended initial choice for this phase:

- Start with **Kustomize overlays** for speed and clarity.
- Keep repository structure tool-agnostic so migration to Helm is low-friction.

---

## 6. Decision Criteria Checklist

Use this checklist before committing to one tool:

- Do we need advanced templating now, or just per-environment overlays?
- Will multiple independent teams consume our deployment packages?
- Is manifest review readability a current bottleneck?
- Do we require native release rollback metadata from day one?
- Can the team support Helm template maintenance long-term?

If most answers are "clarity now" and "single platform team," choose Kustomize first.
If most answers are "reuse at scale" and "package distribution," choose Helm.

---

## 7. Low-Risk Adoption Strategy

1. Create a neutral `mini-baas-infra` layout not tied to Helm or Kustomize.
2. Define canonical service contracts (ports, probes, env keys, labels).
3. Implement one deployment path first (Kustomize or Helm).
4. Keep a compatibility lane for the second tool under separate tooling folders.
5. Validate with one E2E flow (`api-gateway` -> `auth-service`) before scaling.

---

## 8. Final Recommendation (Current Stage)

At the current maturity level, choose:

- **Primary path:** Kustomize-first rollout for local and staging.
- **Structure:** tool-agnostic infra repository.
- **Future option:** add Helm packaging only when chart reuse pressure appears.

This avoids premature complexity while preserving a clean migration path.
