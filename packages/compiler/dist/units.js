"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quantityToMinutes = exports.getMass = exports.normalizeUnit = exports.UNIT_CONVERSIONS = void 0;
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
const quantityToMinutes = (qty) => {
    if (!qty)
        return 0;
    let val = 0;
    let unit = '';
    // Handle AST objects
    if (typeof qty === 'object') {
        if (qty.type === 'Quantity' && qty.value) {
            const sub = qty.value;
            if (sub.type === 'single')
                val = sub.value;
            if (sub.type === 'fraction')
                val = sub.value;
            if (sub.type === 'range' && sub.range)
                val = (sub.range.min + sub.range.max) / 2;
            unit = qty.unit || '';
        }
        else if (qty.value !== undefined) {
            // Fallback for simple objects
            val = qty.value;
            unit = qty.unit || '';
        }
    }
    else {
        return 0;
    }
    if (typeof val !== 'number')
        return 0;
    const u = unit.toLowerCase().trim();
    // Time conversions to minutes
    if (u === 'h' || u === 'hour' || u === 'hours' || u === 'heure' || u === 'heures')
        return val * 60;
    if (u === 'm' || u === 'min' || u === 'minute' || u === 'minutes' || u === 'mins')
        return val;
    if (u === 's' || u === 'sec' || u === 'second' || u === 'seconds')
        return val / 60;
    return val; // Assume minutes if unknown? Or 0? Let's assume minutes if no unit for timers usually, but safety says 0 or keep val. 
    // However, the parser enforces units for timers usually.
    // If unit is missing, it might be safer to return val (e.g. 10 -> 10m).
    return val;
};
exports.quantityToMinutes = quantityToMinutes;
