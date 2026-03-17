export interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc">;
  limit?: number;
  offset?: number;
  select?: string[];
}

export interface QueryResult {
  data: Record<string, unknown>[];
  total: number;
}

// The Universal Query Intermediate Representation
export interface QueryIR extends QueryOptions {
  entity: string;
  include?: string[];
}
