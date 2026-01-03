import { slugify, minifyQuantity } from './utils';
import { getMass } from './units';
import { detectCycles } from './graph';
import { ProcessedSection, Registry, Usage, QuantityValueAST } from 'gram-parser';

interface ShoppingListItem {
    id: string;
    name?: string;
    qty?: number;
    unit?: string | null;
    variable_entries?: string[];
    // Internal fields for calculation
    sureMass?: number;
    otherUnits?: Record<string, number>;
    variableParts?: string[];
    _hasSure?: boolean;
}

interface CompositeItem {
    type: 'composite';
    id: string;
    qty: number;
    usage: Partial<Usage>[];
    _subUsageMap: Map<string, number>;
    _usageAccumulator: Map<string, Partial<Usage>>;
}

function formatQuantity(q: any): string | number {
    if (!q) return '';
    if (typeof q === 'number') return q;
    
    // Handle objects
    if (q.type === 'single') return q.value;
    if (q.type === 'range') return q.text || `${q.value}`;
    if (q.type === 'fraction') return q.text || `${q.value}`;
    
    return JSON.stringify(q);
}

export function generateShoppingList(sections: ProcessedSection[], registry: Registry): (ShoppingListItem | CompositeItem | Usage)[] {
    const listMap = new Map<string, ShoppingListItem>();
    const compositeMap = new Map<string, CompositeItem>();
    const alternatives: Usage[] = [];

    const circularIds = detectCycles(sections);

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
                 const parentId = slugify(item.composite.parent);
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
                 const comp = compositeMap.get(parentId)!;
                 
                 // 1. Accumulate Parent Quantity Requirement per Sub-Ingredient
                 // If we have multiple batches of Whites, we sum the Parent requirements for Whites.
                 // If we have Whites and Yolks, we take the MAX of (TotalWhitesRequirement, TotalYolksRequirement).
                 
                 let declParentQty = 0;
                 if (item.composite && item.composite.quantity) {
                      const minQ = minifyQuantity(item.composite.quantity);
                      if (typeof minQ === 'number') declParentQty = minQ;
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
                 const uEntry = comp._usageAccumulator.get(uKey)!;
                 
                 let childVal = 0;
                 if (typeof item.qty === 'number') {
                     childVal = item.qty;
                 } else if (item.qty && typeof item.qty === 'object') {
                     // Try to get numeric value from object
                     const m = minifyQuantity(item.qty);
                     if (typeof m === 'number') childVal = m;
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
            
            const existing = listMap.get(key)!;
            
            // LOGIC: Resolve Quantity to Number if possible
            let numericQty: number | null = null;
            let unit = item.unit || ''; // Changed from 'unités' to empty string
            let isGhost = false;

            // Check if Relative
            if (item.formula) {
                if (item.formula.isGhost) {
                     isGhost = true;
                } else {
                     // Calculated relative
                     if (typeof item.qty === 'number') {
                         numericQty = item.qty;
                     }
                }
            } else {
                // Absolute
                if (typeof item.qty === 'number') {
                    numericQty = item.qty;
                } else if (item.qty && typeof item.qty === 'object') {
                    const qObj = item.qty as QuantityValueAST;
                    if (qObj.type === 'fraction') numericQty = qObj.value as number;
                    else if (qObj.type === 'range') numericQty = qObj.value as number; 
                    else if (qObj.type === 'single') numericQty = qObj.value as number;
                }
            }
            
            if (isGhost) {
                 // GHOST HANDLING
                 let text = item.formula ? item.formula.raw : (item.qty && (item.qty as any).value) || '';
                 if (item.type === 'variable_entries' && /* check logic */ false) { }
                 
                 // If item.formula exists, use raw string.
                 if (item.formula) {
                     text = item.formula.raw;
                 }
                 
                 // Add warning indicator
                 const display = `${text} ❓`;
                 existing.variableParts!.push(`(${display})`);
            } else if (numericQty !== null) {
                // Try mass conversion
                // getMass needs a string, empty string returns valid:false
                const massObj = getMass(numericQty, unit);
                if (massObj.valid) {
                    existing.sureMass! += massObj.mass;
                    existing._hasSure = true;
                } else {
                    // Other unit (or empty unit)
                    const u = unit;
                    if (!existing.otherUnits![u]) existing.otherUnits![u] = 0;
                    existing.otherUnits![u] += numericQty;
                }
            } else {
                 // Unresolved or Just Variable
                 if (item.formula) {
                      // It's a formula that wasn't ghost but wasn't numeric?
                      // Should have been handled above if calculation succeeded.
                      // If here, numericQty is null.
                 } else if (item.qty) {
                      const qStr = formatQuantity(item.qty);
                      const uStr = unit ? ` ${unit}` : '';
                      existing.variableParts!.push(`${qStr}${uStr}`);
                 }
            }
            
            if (!isGhost && item.isCircular) {
                 existing.variableParts!.push("⚠️ Ref. Circulaire");
            }
        });
    });

    const standardList = [...listMap.values()].map(item => {
        // Structured data only
        const res: ShoppingListItem = {
            id: item.id,
            name: item.name
        };

        // Determine main Qty/Unit
        // Priority: Mass > First Other Unit
        if (item.sureMass! > 0) {
             res.qty = parseFloat(item.sureMass!.toFixed(2));
             res.unit = 'g';
        } else {
             const units = Object.keys(item.otherUnits!);
             if (units.length > 0) {
                  // Use first available unit
                  res.qty = parseFloat(item.otherUnits![units[0]].toFixed(2));
                  res.unit = units[0] || null; // null if empty string
             }
        }

        const hasMass = item.sureMass! > 0;
        const hasOther = Object.keys(item.otherUnits!).length > 0;
        
        const extraEntries: string[] = [];
        
        if (hasMass) {
             // Mass is in Qty. Any other units are extra.
             for (const [u, q] of Object.entries(item.otherUnits!)) {
                  const uStr = u ? ` ${u}` : '';
                  extraEntries.push(`${parseFloat(q.toFixed(2))}${uStr}`);
             }
        } else if (hasOther) {
             // First unit is in Qty. Others are extra.
             const units = Object.keys(item.otherUnits!);
             for (let i = 1; i < units.length; i++) {
                  const u = units[i];
                  const uStr = u ? ` ${u}` : '';
                  extraEntries.push(`${parseFloat(item.otherUnits![u].toFixed(2))}${uStr}`);
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
            if (q > maxQ) maxQ = q;
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
