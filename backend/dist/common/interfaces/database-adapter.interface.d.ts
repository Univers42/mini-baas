import { UniversalSchemaMap } from '../types/schema.types';
import { QueryIR, QueryResult, QueryOptions } from '../types/query.types';
export interface IDatabaseAdapter {
    readonly engine: string;
    connect(config: any): Promise<void>;
    disconnect(): Promise<void>;
    ping(): Promise<boolean>;
    findOne(collection: string, filter: Record<string, any>): Promise<Record<string, any> | null>;
    findMany(collection: string, options?: QueryOptions): Promise<QueryResult>;
    create(collection: string, data: Record<string, any>): Promise<Record<string, any>>;
    update(collection: string, filter: Record<string, any>, data: Record<string, any>): Promise<Record<string, any>>;
    delete(collection: string, filter: Record<string, any>): Promise<boolean>;
    count(collection: string, filter?: Record<string, any>): Promise<number>;
    executeQuery(query: QueryIR): Promise<QueryResult>;
    introspect(): Promise<UniversalSchemaMap>;
    collectionExists(name: string): Promise<boolean>;
    createCollection(name: string, schema: any): Promise<void>;
    dropCollection(name: string): Promise<void>;
    ensureIndexes(name: string, indexes: any[]): Promise<void>;
}
