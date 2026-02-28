import { MongoClient, Db, ObjectId } from 'mongodb';
import { IDatabaseAdapter, SchemaMetadata } from '../../common/interfaces/database-adapter.interface';

export class MongoAdapter implements IDatabaseAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(connectionString: string): Promise<void> {
    this.client = new MongoClient(connectionString);
    await this.client.connect();
    
    this.db = this.client.db();
    console.log('[MongoAdapter] Successfully connected to MongoDB.');
  }

  async findOne(collection: string, filter: Record<string, any>): Promise<any> {
    this.ensureConnection();
    const query = this.normalizeFilter(filter);
    return this.db!.collection(collection).findOne(query);
  }

  async findMany(collection: string, filter: Record<string, any>): Promise<any[]> {
    this.ensureConnection();
    const query = this.normalizeFilter(filter);
    return this.db!.collection(collection).find(query).toArray();
  }

  async create(collection: string, data: Record<string, any>): Promise<any> {
    this.ensureConnection();
    const result = await this.db!.collection(collection).insertOne(data);
    return { ...data, id: result.insertedId.toString() };
  }

  async update(collection: string, id: string, data: Record<string, any>): Promise<any> {
    this.ensureConnection();
    const objectId = new ObjectId(id);
    await this.db!.collection(collection).updateOne(
      { _id: objectId },
      { $set: data }
    );
    return this.findOne(collection, { id });
  }

  async delete(collection: string, id: string): Promise<boolean> {
    this.ensureConnection();
    const objectId = new ObjectId(id);
    const result = await this.db!.collection(collection).deleteOne({ _id: objectId });
    return result.deletedCount === 1;
  }

  async introspect(): Promise<SchemaMetadata> {
    this.ensureConnection();
    return {
      status: 'Introspection phase pending',
      engine: 'mongodb'
    };
  }

  private ensureConnection(): void {
    if (!this.db) {
      throw new Error('[MongoAdapter] Database not connected. Please call connect() first.');
    }
  }

  private normalizeFilter(filter: Record<string, any>): Record<string, any> {
    const normalized = { ...filter };
    if (normalized.id) {
      normalized._id = new ObjectId(normalized.id as string);
      delete normalized.id;
    }
    return normalized;
  }
}