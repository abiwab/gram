"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateShoppingList = generateShoppingList;
const utils_1 = require("./utils");
const units_1 = require("./units");
const graph_1 = require("./graph");
function formatQuantity(q) {
    if (!q)
        return '';
    if (typeof q === 'number')
        return q;
    // Handle objects
    if (q.type === 'single')
        return q.value;
    if (q.type === 'range')
        return q.text || `${q.value}`;
    if (q.type === 'fraction')
        return q.text || `${q.value}`;
    return JSON.stringify(q);
}
function generateShoppingList(sections, registry) {
    const listMap = new Map();
    const compositeMap = new Map();
    const alternatives = [];
    const circularIds = (0, graph_1.detectCycles)(sections);
    sections.forEach(sec => {
        sec.ingredients.forEach(item => {
            // Handle Alternatives explicitly
            if (item.type === 'alternative') {
                alternatives.push(item);
                return;
            }
            // Mark circular on item if detected
            if (circularIds.has(item.id)) {
                item.isCircular = true;
            }
            if (item.composite) {
                const parentId = (0, utils_1.slugify)(item.composite.parent);
                if (!compositeMap.has(parentId)) {
                    compositeMap.set(parentId, {
                        type: 'composite',
                        id: parentId,
                        qty: 0,
                        usage: [],
                        _subUsageMap: new Map(),
                        _usageAccumulator: new Map()
                    });
                }
                const comp = compositeMap.get(parentId);
                // 1. Accumulate Parent Quantity Requirement per Sub-Ingredient
                // If we have multiple batches of Whites, we sum the Parent requirements for Whites.
                // If we have Whites and Yolks, we take the MAX of (TotalWhitesRequirement, TotalYolksRequirement).
                let declParentQty = 0;
                if (item.composite && item.composite.quantity) {
                    const minQ = (0, utils_1.minifyQuantity)(item.composite.quantity);
                    if (typeof minQ === 'number')
                        declParentQty = minQ;
                }
                const subId = item.id;
                const currentParentTotal = comp._subUsageMap.get(subId) || 0;
                comp._subUsageMap.set(subId, currentParentTotal + declParentQty);
                // 2. Accumulate Usage (Child Quantity)
                // Merge usages if ID and Unit match
                const uUnit = item.unit || '';
                const uKey = `${subId}::${uUnit}`;
                if (!comp._usageAccumulator.has(uKey)) {
                    comp._usageAccumulator.set(uKey, {
                        id: subId,
                        unit: item.unit,
                        qty: 0,
                        alias: item.alias
                    });
                }
                const uEntry = comp._usageAccumulator.get(uKey);
                let childVal = 0;
                if (typeof item.qty === 'number') {
                    childVal = item.qty;
                }
                else if (item.qty && typeof item.qty === 'object') {
                    // Try to get numeric value from object
                    const m = (0, utils_1.minifyQuantity)(item.qty);
                    if (typeof m === 'number')
                        childVal = m;
                }
                if (typeof uEntry.qty === 'number') {
                    uEntry.qty += childVal;
                }
                return;
            }
            const id = item.id;
            const key = id;
            if (!listMap.has(key)) {
                listMap.set(key, {
                    id: id,
                    name: registry.ingredients.get(id)?.name || item.name,
                    sureMass: 0,
                    otherUnits: {}, // Map<unit, val>
                    variableParts: [],
                    _hasSure: false
                });
            }
            const existing = listMap.get(key);
            // LOGIC: Resolve Quantity to Number if possible
            let numericQty = null;
            let unit = item.unit || ''; // Changed from 'unités' to empty string
            let isGhost = false;
            // Check if Relative
            if (item.formula) {
                if (item.formula.isGhost) {
                    isGhost = true;
                }
                else {
                    // Calculated relative
                    if (typeof item.qty === 'number') {
                        numericQty = item.qty;
                    }
                }
            }
            else {
                // Absolute
                if (typeof item.qty === 'number') {
                    numericQty = item.qty;
                }
                else if (item.qty && typeof item.qty === 'object') {
                    const qObj = item.qty;
                    if (qObj.type === 'fraction')
                        numericQty = qObj.value;
                    else if (qObj.type === 'range')
                        numericQty = qObj.value;
                    else if (qObj.type === 'single')
                        numericQty = qObj.value;
                }
            }
            if (isGhost) {
                // GHOST HANDLING
                let text = item.formula ? item.formula.raw : (item.qty && item.qty.value) || '';
                if (item.type === 'variable_entries' && /* check logic */ false) { }
                // If item.formula exists, use raw string.
                if (item.formula) {
                    text = item.formula.raw;
                }
                // Add warning indicator
                const display = `${text} ❓`;
                existing.variableParts.push(`(${display})`);
            }
            else if (numericQty !== null) {
                // Try mass conversion
                // getMass needs a string, empty string returns valid:false
                const massObj = (0, units_1.getMass)(numericQty, unit);
                if (massObj.valid) {
                    existing.sureMass += massObj.mass;
                    existing._hasSure = true;
                }
                else {
                    // Other unit (or empty unit)
                    const u = unit;
                    if (!existing.otherUnits[u])
                        existing.otherUnits[u] = 0;
                    existing.otherUnits[u] += numericQty;
                }
            }
            else {
                // Unresolved or Just Variable
                if (item.formula) {
                    // It's a formula that wasn't ghost but wasn't numeric?
                    // Should have been handled above if calculation succeeded.
                    // If here, numericQty is null.
                }
                else if (item.qty) {
                    const qStr = formatQuantity(item.qty);
                    const uStr = unit ? ` ${unit}` : '';
                    existing.variableParts.push(`${qStr}${uStr}`);
                }
            }
            if (!isGhost && item.isCircular) {
                existing.variableParts.push("⚠️ Ref. Circulaire");
            }
        });
    });
    const standardList = [...listMap.values()].map(item => {
        // Structured data only
        const res = {
            id: item.id,
            name: item.name
        };
        // Determine main Qty/Unit
        // Priority: Mass > First Other Unit
        if (item.sureMass > 0) {
            res.qty = parseFloat(item.sureMass.toFixed(2));
            res.unit = 'g';
        }
        else {
            const units = Object.keys(item.otherUnits);
            if (units.length > 0) {
                // Use first available unit
                res.qty = parseFloat(item.otherUnits[units[0]].toFixed(2));
                res.unit = units[0] || null; // null if empty string
            }
        }
        const hasMass = item.sureMass > 0;
        const hasOther = Object.keys(item.otherUnits).length > 0;
        const extraEntries = [];
        if (hasMass) {
            // Mass is in Qty. Any other units are extra.
            for (const [u, q] of Object.entries(item.otherUnits)) {
                const uStr = u ? ` ${u}` : '';
                extraEntries.push(`${parseFloat(q.toFixed(2))}${uStr}`);
            }
        }
        else if (hasOther) {
            // First unit is in Qty. Others are extra.
            const units = Object.keys(item.otherUnits);
            for (let i = 1; i < units.length; i++) {
                const u = units[i];
                const uStr = u ? ` ${u}` : '';
                extraEntries.push(`${parseFloat(item.otherUnits[u].toFixed(2))}${uStr}`);
            }
        }
        const allVars = [...extraEntries, ...(item.variableParts || [])];
        if (allVars.length > 0) {
            res.variable_entries = allVars;
        }
        return res;
    });
    // Process Composites
    const compositeList = [...compositeMap.values()].map(c => {
        // Finalize Parent Qty: Max of the sums of sub-parts
        let maxQ = 0;
        for (const q of c._subUsageMap.values()) {
            if (q > maxQ)
                maxQ = q;
        }
        c.qty = maxQ;
        // Finalize Usage List
        c.usage = [...c._usageAccumulator.values()];
        const { _subUsageMap, _usageAccumulator, ...rest } = c;
        return rest;
    });
    return [
        ...standardList,
        ...compositeList,
        ...alternatives
    ];
}
