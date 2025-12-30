export interface UnitMap {
    base: string;
    map: Record<string, number>;
}
export declare const UNIT_CONVERSIONS: Record<string, UnitMap>;
export interface NormalizedUnit {
    quantity: number | any;
    unit: string | null;
}
export declare const normalizeUnit: (quantityObj: any, unit?: string | null) => NormalizedUnit;
export interface MassResult {
    mass: number;
    valid: boolean;
}
export declare const getMass: (qty: any, unit?: string | null) => MassResult;
