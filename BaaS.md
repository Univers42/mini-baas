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
   *  Más costoso en operaciones y conexión. ([xappifai.com][2])

---

## **Control Plane vs Data Plane (Arquitectura SaaS)**

### **Control Plane**

Administra:

* Gestión de tenants (alta/baja)
* Políticas de acceso
* Configuraciones globales
* Facturación y planes
  Este plano no debería manejar datos sensibles del tenant directamente. ([wild.codes][4])

### 🔹 **Data Plane**

Maneja:

* Peticiones de dato
* CRUD y lógica específica
* Conexiones a DBs por tenant
  Y debe escalar independientemente del control plane. ([wild.codes][4])

---

## 🔐 3) **Permisos y Autorización**

🔎 Lo que debes investigar:

* **RBAC** — Roles fijos (admin, editor, usuario).
* **ABAC** — Policy por atributos (rol *y* condiciones de negocio).
* **ReBAC** — Basado en relaciones (ej: owners y recursos).

En multi-tenant la separación de roles y permisos debe respetar el *tenant boundary*.

💡 Deberías mirar patrones de autorización reforzados por la base de datos y por política en el middleware. ([Coretus Technologies][5])

---

## 🚀 4) **Escalabilidad y Rendimiento**

### 📌 Cache y tenant-aware caching

* Cache por tenant → evita contaminación de datos. ([UMA Technology][6])

### 📌 API Gateway multitenancy

* **Rate limiting por tenant**
* **CORS y WAF por tenant**
* **Tenant-scoped metrics** para observabilidad. ([UMA Technology][6])

---

## 📊 5) **Observabilidad Multi-Tenant**

No basta con métricas globales.

Debes:

* Guardar métricas *por tenant* (p95, errores)
* Loggear con tenant ID para auditoría
* Implementar trazas distribuidas con contexto tenant

Esto te permitirá reaccionar a cuellos de botella por cliente. ([Coretus Technologies][5])

---

## 💳 6) **Billing & Usage Metering**

La arquitectura SaaS madura no solo sirve datos, también:

* Cuenta llamadas API por tenant
* Calcula almacenamiento usado por tenant
* Genera planes y límites por niveles
* Produce reportes y facturas
  Es decir: debes tener *eventos de uso* y *acumuladores* en el control plane. ([Coretus Technologies][5])

---

## 🔁 7) **Evolución de Schema y Metadata Versioning**

Conceptos clave:

* **Versionamiento de metadata:** cada cambio en el schema debe ir asociado a un *version tag*.
* **Backups de metadatos y rollback:** necesitarás mecanismos para volver a un estado anterior.
* **Migraciones desencadenadas por eventos:** puedes aplicar migraciones globales o por tenant.

Este tema suele estar en libros y artículos avanzados de arquitectura SaaS e ingeniería de datos (p. ej. O’Reilly sobre SaaS). ([O'Reilly Media][7])

---

## 📦 8) **Query Abstraction vs DSL**

Tu `IDatabaseAdapter` abstrae CRUD básico, pero un BaaS real suele requerir:

* Filtros complejos (AND/OR)
* Joins y relaciones
* Paginación cursor
* Agregaciones
* Transacciones multi-tenant

Estudia cómo lo hacen proyectos como Hasura o Prisma — ambos soportan consultas complejas traducidas a múltiples engines.

---

## 🛡 9) **Seguridad, Compliance y Custodia de Datos**

Debes cubrir:

* **Aislamiento de datos firmes**
* **Encriptación at rest/in transit**
* **Auditoría de accesos**
* **Protección de logs**
* **Cumplimiento de GDPR/SOC2**

Esto afecta no solo código, sino también procesos de devops y arquitectura SaaS. ([xappifai.com][2])

---

## 📈 10) **Infraestructura y Kubernetes Multi-Tenant**

Si usas Kubernetes, mira:

* Namespaces por tenant
* ResourceQuotas estrictas
* NetworkPolicies
* Secret per tenant

Esto no solo da aislamiento de red, también control operativo. ([Isitdev][8])

---

## 📌 Resumen de Referencias Clave

Áreas cubiertas por contenido real:

| Tema                                   | Fuente                      |
| -------------------------------------- | --------------------------- |
| Multi-tenant strategies                | ([The Algorithm][1])        |
| Tenant isolation patterns              | ([xappifai.com][2])         |
| SaaS control/data plane architecting   | ([wild.codes][4])           |
| Billing & telemetry                    | ([Coretus Technologies][5]) |
| Observabilidad tenant-aware            | ([UMA Technology][6])       |
| Kubernetes multi-tenant best practices | ([Isitdev][8])              |
| SaaS design principles                 | ([O'Reilly Media][7])       |

---

## 🧠 Conclusión

Ya tienes una **colección de conceptos probados y respaldados por prácticas de ingeniería SaaS real** que puedes usar para estructurar tu proyecto:

* Elige un **modelo de aislamiento** (shared vs separate vs DB per tenant).
* Diseña un **control plane sólido** separado del data plane.
* Implementa **observabilidad y billing por tenant** desde el día uno.
* Define claramente **políticas de permisos y versionado de metadata**.
* Planifica **query abstraction** más allá de CRUD.
* Asegura **escala y seguridad** en cada componente.

[1]: https://www.the-algo.com/post/saas-architecture-best-practices-in-2025?utm_source=chatgpt.com "SaaS Architecture Best Practices in 2025"
[2]: https://www.xappifai.com/blog/saas-architecture-complete?utm_source=chatgpt.com "SaaS Architecture: Complete Guide to Building Scalable Multi-Tenant Systems | XAppifai Blog"
[3]: https://www.educative.io/newsletter/system-design/architecting-saas-multi-tenancy-for-isolation-and-scale?utm_source=chatgpt.com "Architecting SaaS Multi-Tenancy for Isolation and Scale"
[4]: https://wild.codes/candidate-toolkit-question/how-would-you-architect-a-secure-multi-tenant-saas?utm_source=chatgpt.com "How would you architect a secure multi-tenant SaaS?"
[5]: https://www.coretus.com/saas-platform-engineering-services/multi-tenant-saas-architecture-design?utm_source=chatgpt.com "Multi-Tenant SaaS Platform Engineering | Tenant Isolation, Billing, RBAC | Coretus"
[6]: https://umatechnology.org/multi-tenant-api-gateway-optimizations-for-backend-as-a-service-apis-rated-by-enterprise-architects/?utm_source=chatgpt.com "Multi-Tenant API Gateway Optimizations for backend-as-a-service APIs rated by enterprise architects - UMA Technology"
[7]: https://www.oreilly.com/library/view/building-multi-tenant-saas/9781098140632/ch02.html?utm_source=chatgpt.com "2. Multi-Tenant Architecture Fundamentals - Building Multi-Tenant SaaS Architectures [Book]"
[8]: https://isitdev.com/multi-tenant-saas-architecture-cloud-2025/?utm_source=chatgpt.com "Multi‑Tenant SaaS Architecture on Cloud (2025) — Practical Guide"
