export type FieldHelp = {
  what: string;
  why: string;
  source: string;
  impacts: string;
};

export const FIELD_HELP: Record<string, FieldHelp> = {
  schemeName: {
    what: "本次测算方案的名称，用于和同一项目下的其他方案区分。",
    why: "一个项目可以有多个方案，后面做对比时靠名称识别。",
    source: "项目经理自行命名。",
    impacts: "不影响计算结果，只影响展示和对比。",
  },
  leaseType: {
    what: "车辆获取方式，例如纯租赁或融资租赁。",
    why: "决定是否需要填首付、月租，以及现金流如何记车辆投入。",
    source: "合同或公司车辆政策。",
    impacts: "车辆成本、现金流、投资回收期。",
  },
  fleetSize: {
    what: "投入该项目的车辆数量。",
    why: "运量、收入、固定成本都按车队规模放大。",
    source: "运力规划或客户要求。",
    impacts: "月运量、月收入、车辆成本、单车利润。",
  },
  calculationYears: {
    what: "投资评价展示多少年。",
    why: "用于 IRR 等投资指标的时间窗口，不等于一年运营几个月。",
    source: "项目周期约定。",
    impacts: "IRR、累计现金流展示。",
  },
  operatingMonthsYear: {
    what: "一年里实际运营几个月。",
    why: "把月度结果折成年收入、年成本和年里程。方案级只填一次。",
    source: "合同运营期或历史出勤。",
    impacts: "年收入、年成本、年运量、现金流。",
  },
  originName: {
    what: "装货地。",
    why: "描述货从哪里出发，帮助核对线路。",
    source: "运输合同或调度计划。",
    impacts: "不影响公式，但空值会影响业务核对。",
  },
  destinationName: {
    what: "卸货地。",
    why: "描述货送到哪里。",
    source: "运输合同或调度计划。",
    impacts: "不影响公式，但空值会影响业务核对。",
  },
  distanceKm: {
    what: "该路段单程距离。",
    why: "计算里程、能耗和轮胎成本。",
    source: "导航里程或合同约定。",
    impacts: "能源成本、轮胎成本、月里程。",
  },
  loadTon: {
    what: "单趟核定载重。载重为 0 时该路段按空载能耗计算。",
    why: "决定一趟能运多少货，也影响收入（按吨/吨公里计价时）。",
    source: "车辆核定载重或货源计划。",
    impacts: "运量、收入、能耗口径。",
  },
  tripsPerVehicleMonth: {
    what: "一辆车一个月跑多少趟。本模型直接填写趟次，不通过装卸时间反推。",
    why: "运力的核心输入。趟次变化会立刻改变运量和收入。",
    source: "历史运营或调度测算。",
    impacts: "运量、收入、变动成本、单车产能。",
  },
  freightPrice: {
    what: "运价。单位在旁边选择，不要把单位写进数字里。",
    why: "收入的主要来源。",
    source: "运输合同。",
    impacts: "收入、利润、利润率。",
  },
  electricityPrice: {
    what: "电价。",
    why: "新能源车能源成本 = 电耗 × 里程 × 电价。",
    source: "当地电价或充电合同。",
    impacts: "能源成本、利润。",
  },
  loadedEnergyConsumption: {
    what: "满载每公里电耗。",
    why: "满载路段按此计算能源成本。",
    source: "车辆公告或实测。",
    impacts: "能源成本。",
  },
  emptyEnergyConsumption: {
    what: "空载每公里电耗。载重为 0 的路段使用该值。",
    why: "空驶不能按满载能耗估算。",
    source: "车辆公告或实测。",
    impacts: "能源成本。",
  },
  monthlyRentPerVehicle: {
    what: "每辆车每月租金。",
    why: "租赁项目最主要的车辆成本。",
    source: "租赁合同。",
    impacts: "车辆成本、利润、现金流。",
  },
  driverCost: {
    what: "司机成本。按趟时优先用路段「司机/趟」，路段为空则回退本字段。",
    why: "人工成本是运营成本的重要组成。",
    source: "用工合同或公司标准。",
    impacts: "人员成本、利润。",
  },
};
