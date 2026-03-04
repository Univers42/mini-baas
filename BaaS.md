# Planning

## Key concepts
- Tenant: In the context of backend as a service (BaaS), a tenant refers to a user or group of users that share a single instance of a software application while having their data and configurations isolated from other tenants. This architecture allows multiple tenants to utilize the same backend resources efficiently while ensuring data privacy and security.

## **Multi-Tenant Isolation Strategy**

### Common Isolation Models

- **Shared DB + Shared Schema**

   * Every tenant share the same tables.
   * Isolation per `tenant_id` in each query.
   * Cheaper, but more risk on data leakage in case of filtering logic failure. ([xappifai.com][2])

- **Shared DB + Separate Schemas**

   * Same physical database.
   * Each tenants has its own logical *schema*.
   * Strong isolation with lower costs. ([xappifai.com][2])

- **Database per Tenant**

   * Each tenant has its own database.
   * Greater isolation and security.
   * More expensive in operations and connections. ([xappifai.com][2])

---

## **Control Plane vs Data Plane (SaaS Architecture)**

### **Control Plane**

Manages:

* Tenant management (onboarding/offboarding)
* Access policies
* Global configurations
* Billing and plans
  This plane should not handle sensitive tenant data directly. ([wild.codes][4])

### **Data Plane**

Handles:

* Data requests
* CRUD and specific logic
* DB connections per tenant
  And must scale independently from the control plane. ([wild.codes][4])

---

## **Permissions and Authorization**

* **RBAC** — Fixed roles (admin, editor, user).
* **ABAC** — Attribute-based policy (role *and* business conditions).
* **ReBAC** — Relationship-based (e.g., owners and resources).

In multi-tenant, the separation of roles and permissions must respect the *tenant boundary*.

---

## **Scalability and Performance**

### Cache and tenant-aware caching

* Cache per tenant → prevents data contamination. ([UMA Technology][6])

### API Gateway multitenancy

* **Rate limiting per tenant**
* **CORS and WAF per tenant**
* **Tenant-scoped metrics** for observability. ([UMA Technology][6])

---

## **Multi-Tenant Observability**

* Store metrics *per tenant* (p95, errors)
* Log with tenant ID for auditing
* Implement distributed traces with tenant context

This will allow us to react to bottlenecks per client. ([Coretus Technologies][5])

---

## **Billing & Usage Metering**

Mature SaaS architecture not only serves data, it also:

* Counts API calls per tenant
* Calculates storage used per tenant
* Generates plans and limits by tiers
* Produces reports and invoices
  In other words: you must have *usage events* and *accumulators* in the control plane. ([Coretus Technologies][5])

---

## **Schema Evolution and Metadata Versioning**

Key concepts:

* **Metadata versioning:** each schema change must be associated with a *version tag*.
* **Metadata backups and rollback:** you'll need mechanisms to revert to a previous state.
* **Event-triggered migrations:** you can apply global or per-tenant migrations.

This topic is usually found in advanced books and articles on SaaS architecture and data engineering (e.g., O'Reilly on SaaS). ([O'Reilly Media][7])

---

## **Query Abstraction vs DSL**

A real BaaS usually requires:

* Basic CRUD
* Complex filters (AND/OR)
* Joins and relationships
* Cursor pagination
* Aggregations
* Multi-tenant transactions

Study how projects like Hasura or Prisma do it — both support complex queries translated to multiple engines.

---

## **Security, Compliance, and Data Custody**

It should be covered:

* **Strong data isolation**
* **Encryption at rest/in transit**
* **Access auditing**
* **Log protection**
* **GDPR/SOC2 compliance**

This affects not only code, but also DevOps processes and SaaS architecture. ([xappifai.com][2])

---

## **Infrastructure and Multi-Tenant Kubernetes**

If we will use Kubernetes, look at:

* Namespaces per tenant
* Strict ResourceQuotas
* NetworkPolicies
* Secret per tenant

This not only provides network isolation, but also operational control. ([Isitdev][8])

---

## 📌 Summary of Key References

Areas covered by real content:

| Topic                                  | Source                      |
| -------------------------------------- | --------------------------- |
| Multi-tenant strategies                | ([The Algorithm][1])        |
| Tenant isolation patterns              | ([xappifai.com][2])         |
| SaaS control/data plane architecting   | ([wild.codes][4])           |
| Billing & telemetry                    | ([Coretus Technologies][5]) |
| Observabilidad tenant-aware            | ([UMA Technology][6])       |
| Kubernetes multi-tenant best practices | ([Isitdev][8])              |
| SaaS design principles                 | ([O'Reilly Media][7])       |

---

[1]: https://www.the-algo.com/post/saas-architecture-best-practices-in-2025?utm_source=chatgpt.com "SaaS Architecture Best Practices in 2025"
[2]: https://www.xappifai.com/blog/saas-architecture-complete?utm_source=chatgpt.com "SaaS Architecture: Complete Guide to Building Scalable Multi-Tenant Systems | XAppifai Blog"
[3]: https://www.educative.io/newsletter/system-design/architecting-saas-multi-tenancy-for-isolation-and-scale?utm_source=chatgpt.com "Architecting SaaS Multi-Tenancy for Isolation and Scale"
[4]: https://wild.codes/candidate-toolkit-question/how-would-you-architect-a-secure-multi-tenant-saas?utm_source=chatgpt.com "How would you architect a secure multi-tenant SaaS?"
[5]: https://www.coretus.com/saas-platform-engineering-services/multi-tenant-saas-architecture-design?utm_source=chatgpt.com "Multi-Tenant SaaS Platform Engineering | Tenant Isolation, Billing, RBAC | Coretus"
[6]: https://umatechnology.org/multi-tenant-api-gateway-optimizations-for-backend-as-a-service-apis-rated-by-enterprise-architects/?utm_source=chatgpt.com "Multi-Tenant API Gateway Optimizations for backend-as-a-service APIs rated by enterprise architects - UMA Technology"
[7]: https://www.oreilly.com/library/view/building-multi-tenant-saas/9781098140632/ch02.html?utm_source=chatgpt.com "2. Multi-Tenant Architecture Fundamentals - Building Multi-Tenant SaaS Architectures [Book]"
[8]: https://isitdev.com/multi-tenant-saas-architecture-cloud-2025/?utm_source=chatgpt.com "Multi‑Tenant SaaS Architecture on Cloud (2025) — Practical Guide"
