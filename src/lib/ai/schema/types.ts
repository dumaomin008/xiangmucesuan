import { AI_PROJECT_EXTRACT_SCHEMA_VERSION, CALCULATION_REQUEST_SCHEMA_VERSION, CALCULATION_RESULT_SCHEMA_VERSION } from "./versions";

export type FieldStatus = "confirmed" | "extracted" | "reference" | "missing" | "conflict";
export type SourceType = "due_diligence" | "meeting" | "chat" | "system" | "reference" | "free_text" | "user";
export type UpdatedBy = "AI" | "用户" | "系统";
export type QuestionPriority = "P0" | "P1" | "P2";
export type RouteConfirmStatus = "pending" | "confirmed" | "conflict";
export type WorkspaceStatus =
  | "collecting"
  | "parsing"
  | "preview"
  | "draft_saved"
  | "confirmed"
  | "calculated"
  | "failed";
export type CreateMode = "AI_IMPORT" | "MANUAL" | "COPY_HISTORY";

export type ReferenceMeta = {
  source_level: string;
  sample_size: number | null;
  statistic_method: string | null;
  range_min: string | null;
  range_max: string | null;
  suggested_value: string | null;
  applicable_condition: string | null;
  confidence_level: string | null;
  updated_at: string | null;
};

export type ParameterRecord = {
  id?: string;
  field_code: string;
  value: string | null;
  unit: string | null;
  raw_value: string | null;
  source_type: SourceType;
  source_ref: string | null;
  confidence: number | null;
  status: FieldStatus;
  editable: boolean;
  reference_meta: ReferenceMeta | null;
  updated_by: UpdatedBy;
  route_id?: string | null;
};

export type ConflictRecord = {
  id?: string;
  field_code: string;
  route_id?: string | null;
  candidates: Array<{
    value: string;
    unit: string | null;
    source_type: SourceType;
    source_ref: string | null;
    raw_value: string | null;
  }>;
  resolved_value: string | null;
  status: "open" | "resolved";
};

export type MissingItem = {
  field_code: string;
  name: string;
  priority: QuestionPriority;
  route_id?: string | null;
  reason: string;
};

export type QuestionRecord = {
  id?: string;
  priority: QuestionPriority;
  field_code: string;
  route_id?: string | null;
  question: string;
  reason: string;
  impact_metrics: string[];
  has_reference: boolean;
  answer_action: "fill" | "adopt_reference" | "skip" | null;
  answer_value: string | null;
  status: "open" | "answered" | "skipped";
};

export type ReferenceCandidate = {
  id?: string;
  field_code: string;
  route_id?: string | null;
  suggested_value: string | null;
  range_min: string | null;
  range_max: string | null;
  source_level: string;
  sample_size: number | null;
  statistic_method: string | null;
  source_updated_at: string | null;
  applicable_condition: string | null;
  confidence_level: string | null;
  status: "unused" | "adopted" | "dismissed";
};

export type AiRouteDraft = {
  id?: string;
  sort_no: number;
  route_name: string;
  origin_name: string;
  destination_name: string;
  distance_km: string | null;
  volume_value: string | null;
  volume_unit: string | null;
  trips_per_day: string | null;
  trips_per_vehicle_month: string | null;
  vehicle_count: string | null;
  cargo_name: string | null;
  freight_price: string | null;
  freight_price_unit: string | null;
  load_ton: string | null;
  status: RouteConfirmStatus;
  enabled: boolean;
};

export type DueDiligenceItem = {
  id?: string;
  priority: QuestionPriority;
  item: string;
  reason: string;
  current_assumption: string | null;
  impact_metrics: string[];
  sensitivity: string | null;
  suggested_method: string | null;
  completion_status: "未获取" | "已获取待确认" | "已确认";
};

export type CalculationRequest = {
  schema_version: typeof CALCULATION_REQUEST_SCHEMA_VERSION;
  ready: boolean;
  blocking_p0: string[];
  routes_confirmed: boolean;
  engine_mapped_fields_only: true;
};

export type AiExtractResult = {
  schema_version: typeof AI_PROJECT_EXTRACT_SCHEMA_VERSION;
  project: {
    name: string | null;
    customer: string | null;
    region: string | null;
  };
  routes: AiRouteDraft[];
  parameters: ParameterRecord[];
  conflicts: ConflictRecord[];
  missing_items: MissingItem[];
  questions: QuestionRecord[];
  reference_candidates: ReferenceCandidate[];
  calculation_request: CalculationRequest;
  analysis: null;
  risks: [];
  due_diligence_next: DueDiligenceItem[];
};

export type CalculationResultV1 = {
  schema_version: typeof CALCULATION_RESULT_SCHEMA_VERSION;
  source: "calculation_engine";
  rule_version: string;
  snapshot_id: string | null;
  result_id: string | null;
  kpis: {
    monthly_revenue: string;
    monthly_total_cost: string;
    monthly_profit: string;
    profit_margin: string | null;
    profit_margin_reason: string | null;
    irr: string | null;
    irr_reason: string | null;
    monthly_volume: string;
    monthly_mileage: string;
    first_positive_month: number | null;
    cumulative_cash_flow: string;
  };
  cost_breakdown: Array<{ code: string; name: string; amount: unknown; share: unknown }>;
  routes: unknown[];
  warnings: unknown[];
};

export type ValidationResult = {
  ok: boolean;
  schema_version: string;
  errors: Array<{ path: string; message: string }>;
};
