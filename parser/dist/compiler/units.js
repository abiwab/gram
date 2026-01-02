"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMass = exports.normalizeUnit = exports.UNIT_CONVERSIONS = void 0;
exports.UNIT_CONVERSIONS = {
    mass: { base: 'g', map: { kg: 1000, mg: 0.001, g: 1 } },
    volume: { base: 'ml', map: { l: 1000, liter: 1000, litre: 1000, dl: 100, cl: 10, ml: 1 } }
};
const normalizeUnit = (quantityObj, unit) => {
    if (!quantityObj)
        return { quantity: 0, unit: unit || null };
    const u = (unit || '').toLowerCase().trim();
    let val = quantityObj;
    if (typeof quantityObj === 'object' && quantityObj.value !== undefined) {
        val = quantityObj.value;
    }
    if (typeof val !== 'number')
        return { quantity: quantityObj, unit: u };
    for (const { base, map } of Object.values(exports.UNIT_CONVERSIONS)) {
        if (map[u]) {
            const newVal = val * map[u];
            return { quantity: newVal, unit: base };
        }
    }
    return { quantity: val, unit: u };
};
exports.normalizeUnit = normalizeUnit;
const getMass = (qty, unit) => {
    let val = qty;
    // Resolve object if needed
    if (typeof qty === 'object' && qty !== null) {
        if (qty.type === 'fraction')
            val = qty.value;
        else if (qty.type === 'range')
            val = qty.value; // Average
        else if (qty.type === 'single')
            val = qty.value;
        else
            return { mass: 0, valid: false };
    }
    if (typeof val !== 'number')
        return { mass: 0, valid: false };
    const u = (unit || '').toLowerCase().trim();
    if (exports.UNIT_CONVERSIONS.mass.map[u])
        return { mass: val * exports.UNIT_CONVERSIONS.mass.map[u], valid: true };
    if (exports.UNIT_CONVERSIONS.volume.map[u])
        return { mass: val * exports.UNIT_CONVERSIONS.volume.map[u], valid: true }; // 1ml = 1g approximate
    return { mass: 0, valid: false };
};
exports.getMass = getMass;
