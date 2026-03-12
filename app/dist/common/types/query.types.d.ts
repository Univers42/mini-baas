export interface QueryOptions {
    where?: Record<string, any>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    limit?: number;
    offset?: number;
    select?: string[];
}
export interface QueryResult {
    data: Record<string, any>[];
    total: number;
}
export interface QueryIR extends QueryOptions {
    entity: string;
    include?: string[];
}
