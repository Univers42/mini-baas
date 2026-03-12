// Universal types supported by all engines
export type UniversalFieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'bigint'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'datetime'
  | 'uuid'
  | 'json'
  | 'array';

export interface FieldDefinition {
  type: UniversalFieldType;
  required?: boolean;
  default?: any;
  unique?: boolean;
}

export interface IndexDefinition {
  fields: string[];
  unique?: boolean;
}

export interface EntityDefinition {
  fields: Record<string, FieldDefinition>;
  indexes?: IndexDefinition[];
}

// Maps collection/table names to their definitions
export type UniversalSchemaMap = Record<string, EntityDefinition>;