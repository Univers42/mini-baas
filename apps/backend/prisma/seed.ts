import { randomUUID } from "node:crypto";
import "dotenv/config";
import * as bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run prisma seed.");
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clearDatabase() {
  console.log("🧹 Clearing existing data...");
  // IMPORTANT: clear "childs" to avoid foreign key errors
  await prisma.workspace_members.deleteMany();
  await prisma.workspaces.deleteMany();
  await prisma.project_members.deleteMany();
  await prisma.projects.deleteMany();
  await prisma.organization_members.deleteMany();
  await prisma.organizations.deleteMany();
  await prisma.user_sessions.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.user.deleteMany(); // Last thing to delete: users
}

async function seedUsers() {
  console.log("👥 Seeding users...");
  const password_hash = await bcrypt.hash("Passw0rd!", 10);

  const users = [
    {
      email: "admin@transcendence.dev",
      username: "admin",
      display_name: "Admin",
      status: "online",
      password_hash,
      mfa_enabled: true,
      mfa_secret: "TEST_2FA_SECRET",
    },
    {
      email: "alice@transcendence.dev",
      username: "alice",
      display_name: "Alice",
      status: "online",
      password_hash,
    },
    {
      email: "bob@transcendence.dev",
      username: "bob",
      display_name: "Bob",
      status: "busy",
      password_hash,
    },
  ];

  await prisma.user.createMany({ data: users });
  return prisma.user.findMany();
}

async function seedBaaSHierarchy(userByUsername: Record<string, string>) {
  console.log("🏢 Seeding Organizations, Projects, and Workspaces...");
  const adminId = userByUsername.admin;
  const aliceId = userByUsername.alice;

  // 1. Create organization
  const org = await prisma.organizations.create({
    data: {
      name: "Transcendence Global",
      slug: "transcendence-global",
      created_by: adminId,
    },
  });

  // 2. Create project within org
  const project = await prisma.projects.create({
    data: {
      organization_id: org.id,
      name: "BaaS Alpha Version",
      slug: "baas-alpha",
      description: "Main backend as a service project",
      created_by: adminId,
    },
  });

  // 3. Create workspace within project
  await prisma.workspaces.create({
    data: {
      project_id: project.id,
      name: "Engineering Team",
      slug: "engineering-team",
      type: "development",
      created_by: adminId,
    },
  });

  // 4. Add org member
  await prisma.organization_members.create({
    data: {
      organization_id: org.id,
      user_id: aliceId,
      invited_by: adminId,
    },
  });
}

async function seedSystemAlerts(userByUsername: Record<string, string>) {
  console.log("🔔 Seeding notifications...");
  await prisma.notification.create({
    data: {
      user_id: userByUsername.admin,
      type: "system",
      title: "Welcome to Core BaaS",
      message: "The infrastructure has been successfully provisioned.",
      is_read: false,
    },
  });
}

async function main() {
  await clearDatabase();

  const users = await seedUsers();
  // Mapping to get IDs easily: { "admin": "uuid-...", "alice": "uuid-..." }
  const userByUsername = Object.fromEntries(users.map((user) => [user.username, user.id]));

  await seedBaaSHierarchy(userByUsername);
  await seedSystemAlerts(userByUsername);

  console.log("✅ Database seeded successfully with Core BaaS Architecture.");
}

main()
  .catch((error: unknown) => {
    console.error("❌ Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
