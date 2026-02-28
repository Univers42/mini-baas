export type SchemaMetadata = Record<string, any>;

export interface IDatabaseAdapter {
  connect(connectionString: string): Promise<void>;
  findOne(collection: string, filter: Record<string, any>): Promise<any>;
  findMany(collection: string, filter: Record<string, any>): Promise<any[]>;
  create(collection: string, data: Record<string, any>): Promise<any>;
  update(collection: string, id: string, data: Record<string, any>): Promise<any>;
  delete(collection: string, id: string): Promise<boolean>;
  introspect(): Promise<SchemaMetadata>;
}