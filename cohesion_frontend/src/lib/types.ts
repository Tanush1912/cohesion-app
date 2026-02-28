export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Endpoint {
  id: string;
  project_id: string;
  path: string;
  method: string;
  created_at: string;
  updated_at: string;
  schemas?: Schema[];
}

export interface Schema {
  id: string;
  endpoint_id: string;
  source: SchemaSource;
  schema_data: SchemaIR;
  version: number;
  created_at: string;
  updated_at: string;
}

export type SchemaSource = "backend-static" | "frontend-static" | "runtime-observed" | "handshake";

export interface SchemaIR {
  endpoint: string;
  method: string;
  source: SchemaSource;
  request?: ObjectSchema;
  response?: Record<number, ObjectSchema>;
}

export interface ObjectSchema {
  type: string;
  fields?: Record<string, Field>;
  items?: ObjectSchema;
}

export interface Field {
  type: string;
  required: boolean;
  nested?: ObjectSchema;
}

export type MatchStatus = "match" | "partial" | "violation";

export type MismatchType = "missing" | "type_mismatch" | "optionality_mismatch" | "extra_field";

export type Severity = "critical" | "warning" | "info";

export interface Mismatch {
  path: string;
  type: MismatchType;
  description: string;
  in_sources: SchemaSource[];
  expected?: unknown;
  actual?: unknown;
  severity?: Severity;
  suggestion?: string;
}

export interface DiffResult {
  endpoint: string;
  method: string;
  sources_compared: SchemaSource[];
  mismatches: Mismatch[];
  status: MatchStatus;
}

export interface LiveCapturedRequest {
  id: string;
  timestamp: string;
  path: string;
  method: string;
  status_code: number;
  duration_ms: number;
  request_body?: Record<string, unknown>;
  response_body?: Record<string, unknown>;
  source?: string;
}

export interface LiveDiffResponse {
  results: DiffResult[];
  source_a: string;
  source_b: string;
  endpoint_count: number;
}

export interface TreeNode {
  name: string;
  type: string;
  required?: boolean;
  sources?: SchemaSource[];
  mismatch?: Mismatch;
  children?: TreeNode[];
  expanded?: boolean;
}
