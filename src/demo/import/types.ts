/** AI 资料导入测算：数据模型（独立 LocalStorage，不污染 Scenario Repository） */

export type ImportFileStatus = "UPLOADED" | "PARSING" | "PARSED" | "FAILED";

export type ExtractedParamStatus =
  | "EXTRACTED"
  | "MISSING"
  | "CONFLICT"
  | "INFERRED"
  | "MANUAL"
  | "CONFIRMED";

export type ParameterSource = {
  fileId: string;
  fileName: string;
  sheetName?: string;
  page?: number;
  cellRange?: string;
  paragraph?: number;
  table?: number;
  originalText?: string;
};

export type ParameterAlternative = {
  value: string | number | null;
  unit?: string;
  source: ParameterSource;
};

export type ExtractedParameter = {
  field: string;
  label: string;
  value: string | number | null;
  normalizedValue: string | number | null;
  unit?: string;
  originalUnit?: string;
  originalText?: string;
  status: ExtractedParamStatus;
  confidence?: number;
  sources: ParameterSource[];
  alternatives?: ParameterAlternative[];
  required: boolean;
  group:
    | "project"
    | "vehicle"
    | "transport"
    | "revenue"
    | "energy"
    | "cost"
    | "finance";
  inferReason?: string;
  /** 单位无法确定性换算时为 true，确认前禁止测算 */
  unitUnresolved?: boolean;
  /** 资料缺失但系统有默认值：必须人工点选后才可采用 */
  offerSystemDefault?: boolean;
  systemDefault?: string | number;
  confirmedByUser?: boolean;
  valueOrigin?: "DOCUMENT" | "INFERRED" | "MANUAL" | "SYSTEM_DEFAULT";
};

export type ImportFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: ImportFileStatus;
  errorMessage?: string;
  parserMode: "demo" | "real";
  addedAt: string;
};

export type ImportSessionStatus =
  | "draft"
  | "uploaded"
  | "parsing"
  | "review"
  | "ready"
  | "completed"
  | "failed";

export type ImportSession = {
  id: string;
  projectId?: string;
  tempProjectName?: string;
  status: ImportSessionStatus;
  files: ImportFile[];
  parameters: ExtractedParameter[];
  suggestedProjectId?: string;
  suggestedProjectName?: string;
  createMode: "ai_import" | "link_project" | "manual";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedScenarioId?: string;
};

/** 允许映射到引擎的字段白名单 */
export const IMPORT_FIELD_WHITELIST = [
  "projectName",
  "customer",
  "region",
  "owner",
  "projectType",
  "fleetSize",
  "monthlyRentPerVehicle",
  "distanceKm",
  "loadTon",
  "tripsPerVehicleMonth",
  "freightPrice",
  "freightPriceUnit",
  "originName",
  "destinationName",
  "routeName",
  "electricityPrice",
  "loadedEnergyConsumption",
  "emptyEnergyConsumption",
  "driverCostPerTrip",
  "operatingMonthsYear",
  "tollPerTrip",
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELD_WHITELIST)[number];

export const REQUIRED_IMPORT_FIELDS: ImportFieldKey[] = [
  "fleetSize",
  "monthlyRentPerVehicle",
  "distanceKm",
  "loadTon",
  "tripsPerVehicleMonth",
  "freightPrice",
  "electricityPrice",
  "loadedEnergyConsumption",
  "driverCostPerTrip",
];

export const FIELD_LABELS: Record<ImportFieldKey, string> = {
  projectName: "项目名称",
  customer: "客户",
  region: "项目区域",
  owner: "项目负责人",
  projectType: "项目类型",
  fleetSize: "车辆数",
  monthlyRentPerVehicle: "单车月租",
  distanceKm: "单程里程",
  loadTon: "载重",
  tripsPerVehicleMonth: "单车月趟次",
  freightPrice: "运价",
  freightPriceUnit: "运价单位",
  originName: "起点",
  destinationName: "终点",
  routeName: "线路",
  electricityPrice: "电价",
  loadedEnergyConsumption: "重载能耗",
  emptyEnergyConsumption: "空载能耗",
  driverCostPerTrip: "司机单趟成本",
  operatingMonthsYear: "年运营月数",
  tollPerTrip: "路桥费/趟",
};

export const FIELD_GROUPS: Record<ImportFieldKey, ExtractedParameter["group"]> = {
  projectName: "project",
  customer: "project",
  region: "project",
  owner: "project",
  projectType: "project",
  fleetSize: "vehicle",
  monthlyRentPerVehicle: "vehicle",
  distanceKm: "transport",
  loadTon: "transport",
  tripsPerVehicleMonth: "transport",
  originName: "transport",
  destinationName: "transport",
  routeName: "transport",
  freightPrice: "revenue",
  freightPriceUnit: "revenue",
  electricityPrice: "energy",
  loadedEnergyConsumption: "energy",
  emptyEnergyConsumption: "energy",
  driverCostPerTrip: "cost",
  tollPerTrip: "cost",
  operatingMonthsYear: "finance",
};
