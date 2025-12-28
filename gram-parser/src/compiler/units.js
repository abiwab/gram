const UNIT_CONVERSIONS = {
    mass: {
        base: 'g',
        map: {
            // Metric
            kg: 1000,
            g: 1,
            mg: 0.001,
            // Imperial/US
            lb: 453.59237,
            oz: 28.349523125,
            // UK Stone
            st: 6350.29318
        }
    },
    volume: {
        base: 'ml',
        map: {
            // Metric
            l: 1000,
            dl: 100,
            cl: 10,
            ml: 1,
            // Imperial/US
            tsp: 4.92892159375,
            tbsp: 14.78676478125,
            floz: 29.5735295625,
            cup: 236.5882365,
            pint: 473.176473,
            quart: 946.352946,
            gallon: 3785.411784
        }
    }
};

const UNIT_ALIASES = {
    // Metric
    kilogram: 'kg', kilograms: 'kg', kilo: 'kg',
    gram: 'g', grams: 'g',
    milligram: 'mg', milligrams: 'mg',
    litre: 'l', liters: 'l', liter: 'l', litres: 'l',

    // Mass (US/UK)
    pound: 'lb', pounds: 'lb', lbs: 'lb',
    ounce: 'oz', ounces: 'oz',
    stone: 'st',

    // Volume (US)
    teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp',
    tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp', tbl: 'tbsp',
    'fluid ounce': 'floz', 'fluid ounces': 'floz', 'fl oz': 'floz', floz: 'floz',
    cup: 'cup', cups: 'cup',
    pint: 'pint', pints: 'pint', pt: 'pint',
    quart: 'quart', quarts: 'quart', qt: 'quart',
    gallon: 'gallon', gallons: 'gallon'
};

const canonicalizeUnit = (rawUnit) => {
    const u = (rawUnit || '')
        .toLowerCase()
        .replace(/\./g, '')
        .trim()
        .replace(/\s+/g, ' ');
    return UNIT_ALIASES[u] || u;
};

const normalizeUnit = (quantityObj, unit) => {
    if (!quantityObj) return { quantity: 0, unit: unit || null };

    const uRaw = unit || '';
    const u = canonicalizeUnit(uRaw);

    let val = quantityObj;
    if (typeof quantityObj === 'object' && quantityObj.value !== undefined) {
        val = quantityObj.value;
    }

    if (typeof val !== 'number') return { quantity: quantityObj, unit: u };

    for (const { base, map } of Object.values(UNIT_CONVERSIONS)) {
        if (map[u] !== undefined) {
            const newVal = val * map[u];
            return { quantity: newVal, unit: base };
        }
    }
    return { quantity: val, unit: u };
};

const getMass = (qty, unit) => {
    let val = qty;

    // Resolve object if needed
    if (typeof qty === 'object' && qty !== null) {
        if (qty.type === 'fraction') val = qty.value;
        else if (qty.type === 'range') val = qty.value;
        else if (qty.type === 'single') val = qty.value;
        else return { mass: 0, valid: false };
    }

    if (typeof val !== 'number') return { mass: 0, valid: false };

    const u = canonicalizeUnit(unit || '');

    if (UNIT_CONVERSIONS.mass.map[u] !== undefined) {
        return { mass: val * UNIT_CONVERSIONS.mass.map[u], valid: true };
    }

    if (UNIT_CONVERSIONS.volume.map[u] !== undefined) {
        return { mass: val * UNIT_CONVERSIONS.volume.map[u], valid: true };
    }

    return { mass: 0, valid: false };
};

module.exports = {
    UNIT_CONVERSIONS,
    normalizeUnit,
    getMass
};
