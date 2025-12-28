
const { slugify, minifyQuantity } = require('./utils');
const { normalizeUnit, getMass } = require('./units');
const { detectCycles } = require('./graph');

function formatQuantity(q) {
    if (!q) return '';
    if (typeof q === 'number') return q;
    
    // Handle objects
    if (q.type === 'single') return q.value;
    if (q.type === 'range') return q.text || `${q.value}`;
    if (q.type === 'fraction') return q.text || `${q.value}`;
    
    return JSON.stringify(q);
}


function generateShoppingList(sections, registry) {
    const listMap = new Map();
    const compositeMap = new Map();
    const alternatives = [];

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
                         qty: 0, // Will be Max
                         usage: [],
                         _maxQty: 0
                     });
                 }
                 const comp = compositeMap.get(parentId);
                 
                 // Usage entry
                 const usageEntry = { id: item.id };
                 let declQty = 0;
                 const cleanComp = item.composite;
                 
                 if (cleanComp && cleanComp.quantity) {
                      const minQ = minifyQuantity(cleanComp.quantity);
                      usageEntry.qty = minQ;
                      if (typeof minQ === 'number') declQty = minQ;
                 }
                 
                 // Driver logic: MAX
                 if (declQty > comp._maxQty) {
                     comp._maxQty = declQty;
                     comp.qty = declQty;
                 }
                 
                 if (item.qty) {
                     // Add own quantity to usage if present
                 }
                 
                 const u = { id: item.id };
                 if (item.qty !== undefined) u.qty = item.qty;
                 if (item.unit) u.unit = item.unit;
                 if (item.alias) u.alias = item.alias;
                 
                 comp.usage.push(u);
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
                } else if (item.qty) {
                    if (item.qty.type === 'fraction') numericQty = item.qty.value;
                    else if (item.qty.type === 'range') numericQty = item.qty.value; 
                    else if (item.qty.type === 'single') numericQty = item.qty.value;
                }
            }
            
            if (isGhost) {
                 // GHOST HANDLING
                 let text = item.formula ? item.formula.raw : (item.qty && item.qty.value);
                 if (item.variable_entries) text = item.variable_entries.join(', ');
                 
                 // If item.formula exists, use raw string.
                 if (item.formula) {
                     text = item.formula.raw;
                 }
                 
                 // Add warning indicator
                 const display = `${text} ❓`;
                 existing.variableParts.push(`(${display})`);
            } else if (numericQty !== null) {
                // Try mass conversion
                // getMass needs a string, empty string returns valid:false
                const massObj = getMass(numericQty, unit);
                if (massObj.valid) {
                    existing.sureMass += massObj.mass;
                    existing._hasSure = true;
                } else {
                    // Other unit (or empty unit)
                    const u = unit;
                    if (!existing.otherUnits[u]) existing.otherUnits[u] = 0;
                    existing.otherUnits[u] += numericQty;
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
            id: item.id
        };

        // Determine main Qty/Unit
        // Priority: Mass > First Other Unit
        if (item.sureMass > 0) {
             res.qty = parseFloat(item.sureMass.toFixed(2));
             res.unit = 'g';
        } else {
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
        } else if (hasOther) {
             // First unit is in Qty. Others are extra.
             const units = Object.keys(item.otherUnits);
             for (let i = 1; i < units.length; i++) {
                  const u = units[i];
                  const uStr = u ? ` ${u}` : '';
                  extraEntries.push(`${parseFloat(item.otherUnits[u].toFixed(2))}${uStr}`);
             }
        }
        
        const allVars = [...extraEntries, ...item.variableParts];
        if (allVars.length > 0) {
             res.variable_entries = allVars;
        }

        return res;
    });
    
    // Process Composites
    const compositeList = [...compositeMap.values()].map(c => {
        delete c._maxQty;
        return c;
    });

    return [
        ...standardList,
        ...compositeList,
        ...alternatives
    ];
}

module.exports = { generateShoppingList };
