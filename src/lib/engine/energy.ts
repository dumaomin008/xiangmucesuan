import { Decimal, toDecimal } from "./decimal";

/** Excel IF(load, loaded, empty)：载重为 0 或空走空载能耗，单位 kWh/km */
export function excelConsumptionKwhKm(loadTon: Decimal, loaded: Decimal, empty: Decimal): Decimal {
  return loadTon.isZero() ? empty : loaded;
}

/** Excel S54：IF(load, fleet*loaded*price*dist, fleet*empty*price*dist)*trips */
export function calcExcelSegmentEnergyCost(params: {
  fleetSize: number;
  electricityPrice: Decimal;
  loadedConsumptionKwhKm: Decimal;
  emptyConsumptionKwhKm: Decimal;
  loadTon: Decimal;
  distanceKm: Decimal;
  tripsPerVehicleMonth: Decimal;
}): { energyQuantity: Decimal; energyCost: Decimal } {
  const consumption = excelConsumptionKwhKm(
    params.loadTon,
    params.loadedConsumptionKwhKm,
    params.emptyConsumptionKwhKm,
  );
  const energyQuantity = new Decimal(params.fleetSize)
    .mul(consumption)
    .mul(params.distanceKm)
    .mul(params.tripsPerVehicleMonth);
  return {
    energyQuantity,
    energyCost: energyQuantity.mul(params.electricityPrice),
  };
}

/** Excel AC54：fleet * price * SUMPRODUCT(IF(load, loaded, empty), dist, trips) */
export function calcExcelProjectEnergyCost(params: {
  fleetSize: number;
  electricityPrice: Decimal;
  loadedConsumptionKwhKm: Decimal;
  emptyConsumptionKwhKm: Decimal;
  segments: { loadTon: Decimal; distanceKm: Decimal; tripsPerVehicleMonth: Decimal }[];
}): { energyQuantity: Decimal; energyCost: Decimal } {
  const energyCost = params.segments.reduce((sum, seg) => {
    return sum.plus(
      calcExcelSegmentEnergyCost({
        fleetSize: params.fleetSize,
        electricityPrice: params.electricityPrice,
        loadedConsumptionKwhKm: params.loadedConsumptionKwhKm,
        emptyConsumptionKwhKm: params.emptyConsumptionKwhKm,
        loadTon: seg.loadTon,
        distanceKm: seg.distanceKm,
        tripsPerVehicleMonth: seg.tripsPerVehicleMonth,
      }).energyCost,
    );
  }, new Decimal(0));
  const energyQuantity = params.electricityPrice.isZero()
    ? new Decimal(0)
    : energyCost.div(params.electricityPrice);
  return { energyQuantity, energyCost };
}

export function calcEnergyQuantity(params: {
  loadedMileage: Decimal;
  emptyMileage: Decimal;
  loadedConsumption: Decimal;
  emptyConsumption: Decimal;
}): Decimal {
  const loadedQty = params.loadedMileage.mul(params.loadedConsumption).div(100);
  const emptyQty = params.emptyMileage.mul(params.emptyConsumption).div(100);
  return loadedQty.plus(emptyQty);
}

export function calcEnergyCost(params: {
  energyQuantity: Decimal;
  electricityPrice: Decimal;
}): Decimal {
  return params.energyQuantity.mul(params.electricityPrice);
}

export function calcSegmentEnergy(params: {
  loadedMileage: Decimal;
  emptyMileage: Decimal;
  loadedEnergyConsumption: string;
  emptyEnergyConsumption: string;
  electricityPrice: string;
}): { energyQuantity: Decimal; energyCost: Decimal } {
  const energyQuantity = calcEnergyQuantity({
    loadedMileage: params.loadedMileage,
    emptyMileage: params.emptyMileage,
    loadedConsumption: toDecimal(params.loadedEnergyConsumption),
    emptyConsumption: toDecimal(params.emptyEnergyConsumption),
  });
  return {
    energyQuantity,
    energyCost: calcEnergyCost({
      energyQuantity,
      electricityPrice: toDecimal(params.electricityPrice),
    }),
  };
}
