🏗️ Core Architecture & Seeding (Prismática Compatible)

To ensure smooth development and prevent relational bottlenecks during this phase, we have optimized our database into a "Core BaaS" (Backend as a Service) architecture. This streamlined structure maintains full compatibility with the broader Prismática project objectives while keeping the development environment agile and manageable.
🗄️ The Core BaaS Schema

We pruned overly complex peripheral tables (such as Billing, heavy ABAC, Dashboard UI configs, and dynamic Collections) to focus on a highly robust, clean core:

    🔐 Security & Users: Authentication, API Keys, and User Sessions.

    🏢 Multi-Tenant Hierarchy: Seamlessly scalable structure flowing from Organizations → Projects → Workspaces.

    🛡️ Standardized RBAC: Role-Based Access Control (Roles & Permissions).

    ⚙️ Infrastructure: Database Connections & Provisioning management.

    📝 Database Conventions Note:
    All database columns have been standardized to PostgreSQL's native snake_case format (e.g., display_name, created_at). Our NestJS services (like UsersService) have been updated to properly map standard camelCase Data Transfer Objects (DTOs) to these database fields.

🌱 Automated Seeding

The prisma/seed.ts script has been completely adapted to match this new multi-tenant architecture. Running the seed automatically handles all foreign key constraints to safely clear the database, and then provisions a complete, ready-to-use testing environment.

What gets provisioned?

    Users: A default Admin and standard test users (Alice, Bob).

    Relational Hierarchy:

        🏢 Organization: Transcendence Global

            ↳ 📁 Project: BaaS Alpha Version

                ↳ 💼 Workspace: Engineering Team

🚀 How to run the seed

Ensure your development environment is up and running, then execute the following command from the root directory:
Bash

make db-seed

Once seeded, you can verify the data by accessing the Swagger UI at http://localhost:3000/api/docs or via Prisma Studio.