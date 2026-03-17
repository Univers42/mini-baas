import { UniversalSchemaMap } from "../types/schema.types";
import { QueryIR, QueryResult, QueryOptions } from "../types/query.types";

export interface IDatabaseAdapter {
  readonly engine: string;

  // Lifecycle methods
  connect(config: unknown): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<boolean>;

  // CRUD Operations (The Universal Contract)
  findOne(
    collection: string,
    filter: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null>;
  findMany(collection: string, options?: QueryOptions): Promise<QueryResult>;
  create(
    collection: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  update(
    collection: string,
    filter: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  delete(collection: string, filter: Record<string, unknown>): Promise<boolean>;
  count(collection: string, filter?: Record<string, unknown>): Promise<number>;

  // Advanced Operations
  executeQuery(query: QueryIR): Promise<QueryResult>;
  introspect(): Promise<UniversalSchemaMap>;

  // DDL (Data Definition Language) - Schema Provisioning
  collectionExists(name: string): Promise<boolean>;
  createCollection(name: string, schema: unknown): Promise<void>;
  dropCollection(name: string): Promise<void>;
  ensureIndexes(name: string, indexes: unknown[]): Promise<void>;
}
