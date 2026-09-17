import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function toDecimal(value: Decimal.Value | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") {
    throw new EngineError("CALC_PARAMETER_INVALID", "value", "数值不能为空");
  }
  const n = new Decimal(value);
  if (!n.isFinite()) {
    throw new EngineError("CALC_PARAMETER_INVALID", "value", "数值非法，不能为 Infinity 或 NaN");
  }
  return n;
}

export function toDecimalOrZero(value: Decimal.Value | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  const n = new Decimal(value);
  if (!n.isFinite()) {
    throw new EngineError("CALC_PARAMETER_INVALID", "value", "数值非法，不能为 Infinity 或 NaN");
  }
  return n;
}

export function tryDecimal(value: unknown): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const n = new Decimal(value as Decimal.Value);
    return n.isFinite() ? n : null;
  } catch {
    return null;
  }
}

export function safeDiv(numerator: Decimal, denominator: Decimal): Decimal | null {
  if (denominator.isZero()) return null;
  const result = numerator.div(denominator);
  return result.isFinite() ? result : null;
}

export function roundMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function roundRate(value: Decimal): Decimal {
  return value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function roundQty(value: Decimal, places = 2): Decimal {
  return value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
}

export class EngineError extends Error {
  code: string;
  field: string;

  constructor(code: string, field: string, message: string) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "EngineError";
  }

  toJSON() {
    return { code: this.code, field: this.field, message: this.message };
  }
}

export function assertFinite(value: Decimal, field: string, label: string): void {
  if (!value.isFinite()) {
    throw new EngineError("CALC_PARAMETER_INVALID", field, `${label}不能为 NaN 或 Infinity`);
  }
}
