## Fase 0 — Plan de Implementación Extendido

### Propósito y alcance

Fase 0 no produce ninguna funcionalidad observable desde el exterior. No hay endpoints nuevos, no hay lógica de negocio, no hay tests de integración que pasen. Su único output es una **base de código estructuralmente correcta** sobre la que todas las fases siguientes se construyen sin fricción.

El criterio de éxito es binario: `npx tsc --noEmit` devuelve cero errores y `nest build` compila limpio. Nada más. Nada menos.

Esta disciplina es intencionada. En un proyecto con múltiples developers, una Fase 0 que intenta hacer "un poco de lógica también" es una Fase 0 que nadie termina de entender ni de revisar bien.

---

### Sección 1 — Auditoría del estado actual

Antes de tocar nada, documentamos exactamente qué existe y qué decisión se toma sobre cada pieza.

#### `apps/backend/src/` — inventario y decisiones

| Archivo/Directorio | Estado actual | Decisión | Razón |
|---|---|---|---|
| `main.ts` | Esqueleto básico NestJS | **Reescribir** | Falta Helmet, compresión, cookie-parser, Swagger, ValidationPipe global |
| `app.module.ts` | Imports básicos | **Vaciar y reconstruir** | Tiene referencias a Prisma y módulos que desaparecen |
| `app.controller.ts` | Hello World | **Eliminar** | No tiene sentido en un BaaS sin rutas estáticas de negocio |
| `app.service.ts` | Vacío | **Eliminar** | No tiene función en la nueva arquitectura |
| `app.controller.spec.ts` | Test del hello world | **Eliminar** | Test sin valor |
| `health.controller.ts` | GET /health | **Conservar** | Necesario para Docker healthchecks y monitoring |
| `prisma.service.ts` | Wrapper de PrismaClient | **Eliminar** | Incompatible con modelo dinámico — es la razón central de esta fase |
| `testmain.ts` | Archivo de prueba | **Eliminar** | No tiene lugar en el proyecto |
| `users/` | Módulo CRUD estático | **Eliminar completamente** | Contradice el principio Zero Business Logic Awareness |

#### `apps/backend/prisma/` — inventario y decisiones

| Archivo | Decisión | Razón |
|---|---|---|
| `schema.prisma` | **Eliminar** | Prisma necesita schema estático; mini-baas descubre schemas en runtime |
| `migrations/` | **Eliminar** | Las migraciones DDL las gestiona el Provisioner dinámicamente |
| `seed.ts` | **Archivar en `examples/`** | Puede ser referencia para la Fase 11 (migración Vite Gourmand) |
| `prisma.config.ts` (raíz de `apps/backend/`) | **Eliminar** | |

#### `apps/backend/package.json` — dependencias actuales a evaluar

Lo que hay que **eliminar**:

```json
"@prisma/client": "^7.4.1",
"prisma": "^7.4.1"
```

Lo que hay que **conservar** (ya útil):

```json
"@nestjs/common", "@nestjs/core", "@nestjs/config",
"@nestjs/event-emitter", "@nestjs/schedule", "@nestjs/swagger",
"@nestjs/throttler", "@nestjs/platform-express",
"compression", "cookie-parser", "helmet"
```

Lo que hay que **añadir** (motor políglo completo):

```json
// Query builders y drivers de base de datos
"knex",
"pg",            // PostgreSQL
"mysql2",        // MySQL y MariaDB
"better-sqlite3", // SQLite
"tedious",       // MSSQL
"mongodb",       // MongoDB driver nativo (tenants con Mongo)
"mongoose",      // ODM para el Control Plane (NOT para tenants)

// Cache y estado distribuido
"ioredis",

// Seguridad y criptografía
"bcrypt",

// Autorización
"@casl/ability",

// Validación en runtime
"ajv",
"ajv-formats",   // extensión para formatos como email, date-time, uuid

// JWT y autenticación (Fase 2+, pero se instala ahora para no interrumpir)
"@nestjs/jwt",
"@nestjs/passport",
"passport",
"passport-jwt",

// Types (devDependencies)
"@types/bcrypt",
"@types/passport-jwt",
"@types/better-sqlite3",
"@types/pg"
```

**Nota sobre `mongoose` vs `mongodb`:** Se instalan los dos por razones distintas. `mongoose` se usa **solo** en el Control Plane (MongoDB del sistema, esquemas estables). `mongodb` (driver nativo) se usa para los **tenants** que eligen MongoDB como su motor — porque en ese contexto necesitamos trabajar con colecciones completamente dinámicas sin schemas predefinidos.

---

### Sección 2 — La nueva estructura de directorios

Esta es la decisión más importante de toda la fase. Una vez establecida y acordada por el equipo, **no se toca**. Cambiar la estructura en Fase 3 es un refactor doloroso.

```
apps/backend/src/
│
├── main.ts                          # Entry point global
├── app.module.ts                    # Root module (solo imports, sin lógica)
├── health.controller.ts             # GET /health (conservado)
│
├── common/                          # Contratos compartidos — CERO dependencias externas
│   ├── interfaces/
│   │   └── database-adapter.interface.ts   # IDatabaseAdapter — el contrato central
│   ├── types/
│   │   ├── schema.types.ts          # UniversalSchemaMap, EntityDefinition, FieldDefinition
│   │   ├── query.types.ts           # QueryIR, WhereClause, QueryResult
│   │   └── tenant.types.ts          # MasterDocument, TenantConfig, TenantStatus
│   ├── schemas/
│   │   └── system-entities.ts       # Las 16 entidades _baas_* (se rellena en Fase módulos)
│   ├── crypto/
│   │   ├── encryption.service.ts    # AES-256-GCM (se implementa en Fase módulos)
│   │   └── crypto.module.ts
│   ├── interceptors/
│   │   └── tenant.interceptor.ts    # Carga Master Document por request (Fase 3)
│   ├── decorators/
│   │   ├── adapter.decorator.ts     # @InjectAdapter()
│   │   └── tenant.decorator.ts      # @Tenant()
│   ├── exceptions/
│   │   └── all-exceptions.filter.ts # Filtro global de errores
│   └── index.ts                     # Barrel export
│
├── infrastructure/                  # Conexiones a servicios externos
│   ├── system-db/
│   │   └── system-db.module.ts      # Conexión Mongoose → MongoDB Control Plane
│   └── cache/
│       └── cache.module.ts          # Conexión ioredis → Redis
│
└── modules/                         # Todo el código funcional
    │
    ├── control-plane/               # Gestión del sistema (Fase 1)
    │   ├── control-plane.module.ts
    │   ├── tenant/
    │   │   ├── tenant.service.ts
    │   │   ├── tenant.controller.ts
    │   │   ├── tenant.schema.ts     # Mongoose schema del Master Document
    │   │   └── dto/
    │   │       └── tenant.dto.ts
    │   ├── metadata/
    │   │   ├── metadata.service.ts
    │   │   ├── metadata.controller.ts
    │   │   ├── schema-version.schema.ts
    │   │   └── dto/
    │   │       └── metadata.dto.ts
    │   ├── iam/
    │   │   ├── iam.module.ts
    │   │   └── policy.engine.ts     # CASL ABAC engine (Fase 5)
    │   └── provisioner/
    │       ├── provisioner.service.ts  # Provisiona las 16 entidades (Fase módulos)
    │       └── provisioner.module.ts
    │
    ├── engines/                     # Capa de abstracción de BD (Fase 2)
    │   ├── engines.module.ts
    │   ├── core/
    │   │   └── database-provider.factory.ts
    │   ├── sql/
    │   │   └── sql.adapter.ts       # Knex.js — 5 motores SQL
    │   └── nosql/
    │       └── mongo.adapter.ts     # MongoDB driver nativo
    │
    ├── data-plane/                  # API dinámica (Fase 3+)
    │   ├── data-plane.module.ts
    │   ├── dynamic-api/
    │   │   ├── dynamic.controller.ts
    │   │   ├── dynamic.service.ts
    │   │   └── dynamic-api.module.ts
    │   ├── validation/
    │   │   ├── validation.engine.ts
    │   │   └── validation.module.ts
    │   └── transformation/
    │       └── transformation.service.ts
    │
    ├── auth/                        # Autenticación por tenant (Fase módulos)
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── decorators/
    │   │   └── current-user.decorator.ts
    │   ├── dto/
    │   │   └── auth.dto.ts
    │   ├── guards/
    │   │   └── jwt-auth.guard.ts
    │   └── services/
    │       ├── auth.service.ts
    │       ├── password.service.ts
    │       ├── token.service.ts
    │       └── identity.service.ts
    │
    ├── session/
    │   ├── session.module.ts
    │   └── session.service.ts
    │
    ├── rbac/
    │   ├── rbac.module.ts
    │   ├── decorators/
    │   │   └── roles.decorator.ts
    │   ├── guards/
    │   │   ├── roles.guard.ts
    │   │   └── permissions.guard.ts
    │   └── services/
    │       └── role.service.ts
    │
    ├── audit/
    │   ├── audit.module.ts
    │   └── audit.service.ts
    │
    ├── gdpr/
    │   ├── gdpr.module.ts
    │   ├── gdpr.service.ts
    │   └── gdpr.controller.ts
    │
    ├── mail/
    │   ├── mail.module.ts
    │   └── mail.service.ts
    │
    ├── notification/
    │   ├── notification.module.ts
    │   ├── notification.service.ts
    │   └── notification.controller.ts
    │
    ├── newsletter/
    │   ├── newsletter.module.ts
    │   ├── newsletter.service.ts
    │   └── newsletter.controller.ts
    │
    ├── files/
    │   ├── file.module.ts
    │   └── file.service.ts
    │
    ├── analytics/
    │   ├── analytics.module.ts
    │   ├── analytics.service.ts
    │   └── analytics.controller.ts
    │
    ├── webhook/
    │   ├── webhook.module.ts
    │   ├── webhook.service.ts
    │   └── webhook.controller.ts
    │
    ├── api-keys/
    │   ├── api-key.module.ts
    │   ├── api-key.service.ts
    │   ├── api-key.guard.ts
    │   └── api-key.controller.ts
    │
    ├── security/
    │   ├── security.module.ts
    │   ├── guards/
    │   │   ├── ip-filter.guard.ts
    │   │   ├── rate-limiter.guard.ts
    │   │   └── sanitization.guard.ts
    │   └── middleware/
    │       └── security-headers.middleware.ts
    │
    └── runtime/
        ├── background-jobs/         # BullMQ (Fase 9)
        └── hooks/                   # Hook Sandbox (Fase 8)
```

#### Regla de dependencias — la más importante del proyecto

```
common/     → no importa NADA de este proyecto (solo node_modules)
infrastructure/ → puede importar common/
modules/    → puede importar common/ e infrastructure/
             NO puede importar entre módulos directamente (solo via interfaces)
```

Esta regla previene los ciclos de dependencia que destruyen proyectos NestJS medianos. Si el módulo `auth` necesita algo del módulo `session`, lo hace a través de una interfaz en `common/`, nunca con un import directo.

---

### Sección 3 — Los archivos de Fase 0

En Fase 0, la mayoría de archivos se crean **vacíos o con stubs mínimos**. No se implementa lógica — solo se establece la estructura para que TypeScript compile sin errores.

#### Patrón de stub para módulos futuros

Cada módulo que no se implementa hasta fases posteriores sigue este patrón exacto:

```typescript
// src/modules/audit/audit.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class AuditModule {}
```

```typescript
// src/modules/audit/audit.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  // Implemented in Module Build Phase 4
}
```

Este patrón es deliberado. Tener el archivo vacío pero existente permite que `app.module.ts` importe todos los módulos desde el primer día — cualquier developer sabe dónde va a trabajar, y `tsc` no se queja de imports a archivos inexistentes.

#### Los únicos archivos con contenido real en Fase 0

**`main.ts`** — configuración global completa, no hay razón para dejarlo incompleto:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/exceptions/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  // Seguridad HTTP
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // Filtro global de excepciones
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validación global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // CORS (se configura por tenant en Fase 7, aquí va el global)
  app.enableCors({
    origin: config.get('CORS_ORIGIN', '*'),
    credentials: true,
  });

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('mini-baas API')
    .setDescription('Metadata-driven polyglot Backend-as-a-Service')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
    .build();

  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(port);
  Logger.log(`mini-baas running on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger: http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
```

**`common/exceptions/all-exceptions.filter.ts`** — necesario para que `main.ts` compile:

```typescript
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
```

**`tsconfig.json`** — path aliases para imports limpios:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "paths": {
      "@common/*": ["src/common/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@modules/*": ["src/modules/*"]
    }
  }
}
```

**`.env.example`** — contrato de variables de entorno para el equipo:

```bash
# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# Control Plane Database (MongoDB — sistema, no tenants)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=mini_baas_control

# Cache
REDIS_HOST=localhost
REDIS_PORT=6379

# Criptografía — NUNCA commitear el valor real
# Generar con: openssl rand -hex 32
MASTER_ENCRYPTION_KEY=replace_with_32_byte_hex_string

# Swagger
SWAGGER_ENABLED=true
```

---

### Sección 4 — Secuencia de ejecución

Esta es la secuencia exacta, ordenada para que cualquier developer del equipo la ejecute de principio a fin sin decisiones ambiguas.

**Paso 1 — Rama de trabajo**
```bash
git checkout -b feat/phase-0-ddd-structure
```

**Paso 2 — Limpiar dependencias incompatibles**
```bash
cd apps/backend
pnpm remove @prisma/client prisma
```

**Paso 3 — Instalar dependencias del motor**
```bash
pnpm add knex pg mysql2 better-sqlite3 tedious mongodb mongoose ioredis
pnpm add bcrypt @casl/ability ajv ajv-formats
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt
pnpm add -D @types/bcrypt @types/passport-jwt @types/better-sqlite3 @types/pg
```

**Paso 4 — Eliminar archivos incompatibles**
```bash
# Guardar seed como referencia antes de borrar
cp prisma/seed.ts ../../examples/Back/prisma/seed.reference.ts

rm src/app.controller.ts
rm src/app.controller.spec.ts
rm src/app.service.ts
rm src/prisma.service.ts
rm src/testmain.ts
rm prisma.config.ts
rm -rf src/users/
rm -rf prisma/
```

**Paso 5 — Crear estructura de directorios**
```bash
# common/
mkdir -p src/common/{interfaces,types,schemas,crypto,interceptors,decorators,exceptions}

# infrastructure/
mkdir -p src/infrastructure/{system-db,cache}

# control-plane/
mkdir -p src/modules/control-plane/{tenant/dto,metadata/dto,iam,provisioner}

# engines/
mkdir -p src/modules/engines/{core,sql,nosql}

# data-plane/
mkdir -p src/modules/data-plane/{dynamic-api,validation,transformation}

# módulos funcionales
mkdir -p src/modules/auth/{decorators,dto,guards,services}
mkdir -p src/modules/session
mkdir -p src/modules/rbac/{decorators,guards,services}
mkdir -p src/modules/{audit,gdpr,mail,notification,newsletter}
mkdir -p src/modules/{files,analytics,webhook,api-keys}
mkdir -p src/modules/security/{guards,middleware}
mkdir -p src/modules/runtime/{background-jobs,hooks}

# studio (futuro admin UI)
mkdir -p src/studio/{bootstrap,collections,config,environments,schemas,seeds,types}
```

**Paso 6 — Crear stubs de todos los módulos**

Para cada módulo funcional (`audit`, `gdpr`, `mail`, `notification`, `newsletter`, `files`, `analytics`, `webhook`, `api-keys`, `security`, `session`, `rbac`, `auth`, `data-plane`, `engines`, `control-plane`): crear el `.module.ts` vacío y los `.service.ts` / `.controller.ts` con stubs mínimos.

**Paso 7 — Crear archivos de tipos en `common/`**

Crear los archivos de tipos vacíos con solo los exports necesarios para que TypeScript no se queje:

```typescript
// src/common/types/schema.types.ts
export type UniversalFieldType = string; // se expande en Fase 2
export interface FieldDefinition { type: UniversalFieldType; }
export interface EntityDefinition { fields: Record<string, FieldDefinition>; }
export type UniversalSchemaMap = Record<string, EntityDefinition>;
export interface IndexDefinition { fields: string[]; unique?: boolean; }
```

```typescript
// src/common/types/query.types.ts
export interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
  select?: string[];
}
export interface QueryResult {
  data: Record<string, unknown>[];
  total: number;
}
export interface QueryIR extends QueryOptions {
  entity: string;
  include?: string[];
}
```

```typescript
// src/common/types/tenant.types.ts
export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'archived';
export interface MasterDocument {
  tenantId: string;
  name: string;
  status: TenantStatus;
  database: Record<string, unknown>;
  schema: Record<string, unknown>;
  config: Record<string, unknown>;
  version: number;
}
```

**Paso 8 — Crear la interfaz `IDatabaseAdapter`** con todos los métodos declarados (sin implementación).

**Paso 9 — Reescribir `main.ts`** con el código completo de la sección anterior.

**Paso 10 — Reescribir `app.module.ts`** mínimo con solo ConfigModule y HealthController. Todos los módulos de fases futuras se añaden en sus respectivas fases — no se importan stubs vacíos en el `AppModule` todavía.

**Paso 11 — Actualizar `tsconfig.json`** con los path aliases.

**Paso 12 — Crear `.env.example`** con todas las variables documentadas.

**Paso 13 — Verificación**
```bash
npx tsc --noEmit    # DEBE dar 0 errores
nest build          # DEBE compilar sin errores
curl localhost:3000/health  # DEBE devolver 200
```

**Paso 14 — Commit y PR**
```bash
git add .
git commit -m "feat: phase-0 — DDD structure, Prisma removal, polyglot dependencies"
git push origin feat/phase-0-ddd-structure
```

---

### Sección 5 — Criterios de revisión de PR

Cuando otro developer revisa el PR de Fase 0, debe verificar exactamente esto:

**Estructura**
- [ ] Los directorios siguen exactamente el mapa definido en este documento
- [ ] No existe ningún archivo `*.prisma`, `prisma.service.ts`, ni directorio `prisma/`
- [ ] No existe el módulo `users/` ni ningún módulo de dominio de negocio
- [ ] Existe `src/common/interfaces/database-adapter.interface.ts` con la interfaz completa declarada

**Dependencias**
- [ ] `package.json` no contiene `@prisma/client` ni `prisma`
- [ ] `package.json` contiene `knex`, `pg`, `mongodb`, `mongoose`, `ioredis`, `bcrypt`, `@casl/ability`, `ajv`
- [ ] `pnpm-lock.yaml` actualizado (no hay referencias a Prisma)

**TypeScript**
- [ ] `npx tsc --noEmit` da exactamente 0 errores
- [ ] `tsconfig.json` tiene los path aliases `@common/*`, `@infrastructure/*`, `@modules/*`

**Runtime**
- [ ] `nest build` compila sin errores
- [ ] `GET /health` devuelve 200
- [ ] `GET /docs` devuelve la UI de Swagger

**Documentación**
- [ ] `.env.example` existe y está actualizado
- [ ] El `seed.ts` de Prisma ha sido preservado en `examples/Back/` como referencia

---

### Sección 6 — Decisiones que quedan pendientes (para reunión con project owner)

Estas son las decisiones que **no bloqueamos en Fase 0** pero que deben resolverse antes de Fase 1:

| Decisión | Opciones | Impacto |
|---|---|---|
| ¿Vite Gourmand pasa a ser tenant de mini-baas? | Sí / No / Más adelante | Define si Fase 11 es prioritaria o futura |
| ¿Un docker-compose unificado o separado por app? | Unificado / Separado | Afecta la configuración de red entre servicios |
| ¿`MASTER_ENCRYPTION_KEY` en Bitwarden del equipo o en CI/CD secrets? | Bitwarden / GitHub Secrets / Vault | Afecta el flujo de onboarding de developers |
| ¿El Control Plane tiene panel de administración web (Studio)? | Sí (prioridad alta) / No (API only) | Determina si `src/studio/` se desarrolla en paralelo |
| ¿Soporte para MSSQL desde el día uno? | Sí / No | `tedious` ya está instalado, pero añade complejidad al SqlAdapter |

---

### Resumen ejecutivo de Fase 0

Fase 0 es una fase de **preparación e inversión arquitectónica**. El equipo invierte tiempo ahora en establecer una estructura que no habrá que repensar en ninguna fase posterior. El output no es visible para el usuario final, pero es la condición necesaria para que todo lo que viene sea predecible, revisable y extensible.

**Duración estimada:** 2–4 horas para un developer con el contexto de este documento.

**Riesgo si se omite o se hace a medias:** Las fases 1–7 producen código que no sigue convenciones uniformes, los imports circulares empiezan a aparecer en Fase 3–4, y el onboarding de nuevos developers requiere descifrar la estructura en lugar de leerla en este documento.

¿Entramos ya con la implementación real?