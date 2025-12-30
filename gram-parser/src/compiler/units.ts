export interface UnitMap {
    base: string;
    map: Record<string, number>;
}

export const UNIT_CONVERSIONS: Record<string, UnitMap> = {
    mass: { base: 'g', map: { kg: 1000, mg: 0.001, g: 1 } },
    volume: { base: 'ml', map: { l: 1000, liter: 1000, litre: 1000, dl: 100, cl: 10, ml: 1 } }
};

export interface NormalizedUnit {
    quantity: number | any;
    unit: string | null;
}

export const normalizeUnit = (quantityObj: any, unit?: string | null): NormalizedUnit => {
    if (!quantityObj) return { quantity: 0, unit: unit || null };
    
    const u = (unit || '').toLowerCase().trim();
    
    let val = quantityObj;
    if (typeof quantityObj === 'object' && quantityObj.value !== undefined) {
        val = quantityObj.value;
    }
    
    if (typeof val !== 'number') return { quantity: quantityObj, unit: u };

    for (const { base, map } of Object.values(UNIT_CONVERSIONS)) {
        if (map[u]) {
            const newVal = val * map[u];
            return { quantity: newVal, unit: base };
        }
    }
    return { quantity: val, unit: u };
};

export interface MassResult {
    mass: number;
    valid: boolean;
}

export const getMass = (qty: any, unit?: string | null): MassResult => {
    let val = qty;
    
    // Resolve object if needed
    if (typeof qty === 'object' && qty !== null) {
        if (qty.type === 'fraction') val = qty.value;
        else if (qty.type === 'range') val = qty.value; // Average
        else if (qty.type === 'single') val = qty.value;
        else return { mass: 0, valid: false };
    }

    if (typeof val !== 'number') return { mass: 0, valid: false };
    
    const u = (unit || '').toLowerCase().trim();
    if (UNIT_CONVERSIONS.mass.map[u]) return { mass: val * UNIT_CONVERSIONS.mass.map[u], valid: true };
    if (UNIT_CONVERSIONS.volume.map[u]) return { mass: val * UNIT_CONVERSIONS.volume.map[u], valid: true }; // 1ml = 1g approximate
    return { mass: 0, valid: false };
};
