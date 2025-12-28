
const { getMass } = require('./units');
const { slugify, minifyQuantity, createCleanUsage, cleanObject } = require('./utils');
const { generateShoppingList } = require('./shopping');

function processBlockItem(item, ctx, registry, secIngredients, secCookware) {
    if (item.type === 'Ingredient') {
        const id = slugify(item.name);
        
        if (!registry.ingredients.has(id)) {
            let defaultUnit = null;
            if (item.quantity && item.quantity.unit) defaultUnit = item.quantity.unit;
            registry.ingredients.set(id, { id, name: item.name, default_unit: defaultUnit });
        }
        
        const entry = registry.ingredients.get(id);
        if (item.quantity && item.quantity.unit && !entry.default_unit) {
            entry.default_unit = item.quantity.unit;
        }

        if (item.composite) {
            entry.is_composite = true;
            const parentId = slugify(item.composite.parent);
            entry.parent = parentId;
            if (!registry.ingredients.has(parentId)) {
                 registry.ingredients.set(parentId, { id: parentId, name: item.composite.parent, is_composite: true });
            } else {
                 registry.ingredients.get(parentId).is_composite = true;
            }
        }

        // Handle RelativeQuantity
        if (item.quantity && item.quantity.type === 'RelativeQuantity') {
             const rel = item.quantity;
             const targetName = rel.target;
             const targetId = slugify(targetName);
             const percent = rel.percent;
             
             let totalQty = 0;
             let inheritedUnit = null;
             let isGhost = false;
             
             const markerChar = rel.referenceType === 'variable' ? '&' : '@';
             // Store formula for display.
             const formulaStr = `${percent}% de ${markerChar}${targetName}`;

             if (rel.referenceType === 'variable') {
                 if (ctx.variableWeights.has(targetId)) {
                     const varData = ctx.variableWeights.get(targetId);
                     totalQty = varData.mass;
                     inheritedUnit = 'g'; 
                 } else {
                     // Ghost Variable
                     isGhost = true;
                     ctx.warnings.push({
                         code: 'VARIABLE_NOT_FOUND',
                         message: `Variable '&${targetName}' not found or has undefined mass.`,
                         item: item.name
                     });
                 }
             } else {
                 // Ingredient Resolution (Linear Top-Down)
                 const found = secIngredients.some(i => i.id === targetId);
                 if (!found) {
                     isGhost = true;
                     ctx.warnings.push({
                         code: 'RELATIVE_QUANTITY_UNRESOLVED',
                         message: `Could not resolve relative quantity for '@${targetName}'. Source not found.`,
                         item: item.name
                     });
                 } else {
                     // Calculate sum
                     for (const prev of secIngredients) {
                         if (prev.id === targetId) {
                             const m = getMass(prev.qty, prev.unit);
                             if (m.valid) {
                                 totalQty += m.mass;
                                 if (!inheritedUnit) inheritedUnit = 'g';
                             }
                         }
                     }
                     
                     if (!inheritedUnit) {
                         // Found source but no valid mass (e.g. unitless count)
                         isGhost = true;
                         ctx.warnings.push({
                             code: 'RELATIVE_NO_MASS',
                             message: `Source '@${targetName}' has no mass (unitless or incompatible). Calculation impossible.`,
                             item: item.name
                         });
                     }
                 }
             }
             
             const newVal = totalQty * (percent / 100);
             const usage = createCleanUsage(item, id);
             usage.qty = parseFloat(newVal.toFixed(2)); 
             usage.unit = inheritedUnit || 'g'; 
             
             // Check Circular (Direct self-reference)
             if (targetId === id) {
                 usage.isCircular = true;
                 ctx.warnings.push({
                     code: 'CIRCULAR_REFERENCE',
                     message: `Circular reference detected: ${item.name} depends on itself.`,
                     item: item.name
                 });
             }

             // Attach dependency info for graph cycle detection
             usage.dependencies = [targetId];

             usage.formula = {
                 raw: formulaStr,
                 target: targetName,
                 percent: percent,
                 isGhost: isGhost
             };
             
             secIngredients.push(usage);
             return usage;
        }

        const usage = createCleanUsage(item, id);
        if (item.modifiers && item.modifiers.includes('&')) {
             if (!ctx.seenNames.has(item.name)) {
                 ctx.warnings.push({ code: 'UNDEFINED_REFERENCE', message: `Reference to undefined ingredient '@&${item.name}'.`, item: item.name });
             }
             if (ctx.definedIntermediates.has(item.name)) ctx.usedIntermediates.add(item.name);
        } else {
             ctx.seenNames.add(item.name);
        }
        
        if (!item.modifiers || !item.modifiers.includes('&') || item.quantity) {
             secIngredients.push(usage);
        }
        
        return usage;
    }

    if (item.type === 'Cookware') {
        const id = slugify(item.name);
        if (!registry.cookware.has(id)) {
            registry.cookware.set(id, { id, name: item.name });
        }
        const usage = createCleanUsage(item, id);
        secCookware.push(usage);
        return usage;
    }

    if (item.type === 'Alternative') {
        const options = item.options.map(opt => processBlockItem(opt, ctx, registry, [], []));
        const usage = { type: 'alternative', options };
        if (item.options[0].type === 'Ingredient') {
             secIngredients.push(usage);
        } else if (item.options[0].type === 'Cookware') {
             secCookware.push(usage);
        }
        return usage;
    }

    if (item.type === 'Reference') {
        const id = slugify(item.name);
        if (!registry.ingredients.has(id)) {
             ctx.warnings.push({ code: 'UNDEFINED_REFERENCE', message: `Reference to undefined ingredient '&${item.name}'.`, item: item.name });
        }
        if (ctx.definedIntermediates.has(item.name)) ctx.usedIntermediates.add(item.name);
        const obj = { type: 'reference', id };
        if (item.quantity) {
             const cleanQty = minifyQuantity(item.quantity);
             if (cleanQty !== undefined) obj.qty = cleanQty;
             if (item.quantity.unit) obj.unit = item.quantity.unit;
             if (item.quantity.type === 'TextQuantity') obj.qty = item.quantity.value;
        }
        return obj;
    }

    if (item.type === 'IntermediateDecl') {
        const id = slugify(item.name);
        ctx.intermediateDecl = id;
        if (!registry.ingredients.has(id)) {
            registry.ingredients.set(id, { id, name: item.name, is_intermediate: true });
        } else {
            registry.ingredients.get(id).is_intermediate = true;
        }
        return null; // Don't return as step content
    }

    if (item.type === 'Text') return item.value;
    
    // Timer/Temperature logic
    if (item.type === 'Timer' || item.type === 'Temperature') {
        const obj = { type: item.type.toLowerCase() };
        if (item.name) obj.name = item.name;
        if (item.quantity) {
             const q = item.quantity;
             if (q.value) obj.quantity = q.value;
             let unit = q.unit;
             if (item.type === 'Timer' && (unit === 'm' || unit === 'minutes')) unit = 'min';
             if (unit) obj.unit = unit;
             if (q.type === 'TextQuantity') {
                 ctx.warnings.push({ code: 'INVALID_UNIT', message: `Invalid text content in ${item.type}.`, item: q.value });
                 obj.quantity = { type: 'text', value: q.value }; 
             } else {
                 if (!unit) {
                     ctx.warnings.push({ code: 'MISSING_UNIT', message: `${item.type} must have an explicit unit.`, item: item.name });
                 }
             }
        }
        return obj;
    }

    if (item.type === 'Comment') {
        return { type: 'comment', value: item.value, kind: item.kind };
    }

    return item;
}

function processSections(astChildren, registry) {
    const ctx = {
        warnings: registry.warnings,
        intermediateDecl: null,
        seenNames: new Set(),
        definedIntermediates: new Set(),
        usedIntermediates: new Set(),
        variableWeights: new Map(),
        globalScopes: new Map() // Check Scope Conflicts
    };

    const sections = [];
    let blocksToProcess = astChildren;
    
    if (blocksToProcess.length > 0 && blocksToProcess[0].type !== 'Section') {
        blocksToProcess = [{ type: 'Section', title: null, children: astChildren }];
    }

    blocksToProcess.forEach(section => {
        if (section.type !== 'Section') return; 

        // 1. Scope Validation
        if (section.intermediateDecl) {
            const varName = section.intermediateDecl.name;
            if (ctx.globalScopes.has(varName)) {
                registry.warnings.push({
                    code: 'SCOPE_CONFLICT',
                    message: `La variable globale '&${varName}' est redéfinie.`,
                    section: section.title
                });
            } else {
                ctx.globalScopes.set(varName, section.title);
            }

            const id = slugify(varName);
            if (!registry.ingredients.has(id)) {
                registry.ingredients.set(id, { id, name: varName, is_intermediate: true });
            }
            ctx.definedIntermediates.add(varName);
        }

        const sectionIngredients = [];
        const sectionCookware = [];
        const steps = [];

        section.children.forEach(block => {
             if (block.type === 'Step') {
                 const stepObj = { type: 'step', content: [] };
                 if (block.action) stepObj.action = block.action;
                 
                 ctx.intermediateDecl = null;
                 
                 block.children.forEach(item => {
                     const processed = processBlockItem(item, ctx, registry, sectionIngredients, sectionCookware);
                     if (processed) {
                          stepObj.content.push(processed);
                          
                          let mass = 0;
                          let valid = false;
                          if (processed.qty && typeof processed.qty === 'number') {
                              const m = getMass(processed.qty, processed.unit);
                              mass = m.mass;
                              valid = m.valid;
                          } else if (processed.type === 'reference' && processed.formula && processed.qty) {
                               mass = processed.qty; 
                               valid = true;
                          }
                          
                          if (processed.type === 'reference' && !processed.qty) {
                              if (ctx.variableWeights.has(processed.id)) {
                                  const vData = ctx.variableWeights.get(processed.id);
                                  mass = vData.mass;
                                  valid = !vData.isPartial;
                              }
                          }
                          
                          stepObj._accumulatedMass = (stepObj._accumulatedMass || 0) + mass;
                          if (!valid) stepObj._hasPartialStats = true;
                     }
                 });

                 if (ctx.intermediateDecl) { 
                     stepObj.intermediate_preparation = ctx.intermediateDecl;
                      const varId = ctx.intermediateDecl;
                      const total = stepObj._accumulatedMass || 0;
                      const partial = !!stepObj._hasPartialStats;
                      ctx.variableWeights.set(varId, { mass: total, isPartial: partial });
                 }
                 delete stepObj._accumulatedMass;
                 delete stepObj._hasPartialStats;
                 steps.push(stepObj);
             } else if (block.type === 'Comment') {
                 steps.push({ type: 'comment', value: block.value, kind: block.kind });
             }
        });

        const res = { 
            title: section.title, 
            ingredients: sectionIngredients, 
            cookware: sectionCookware, 
            steps 
        };
        if (section.intermediateDecl) {
             res.intermediate_preparation = section.intermediateDecl.name;
             let secMass = 0;
             let partial = false;
             res.ingredients.forEach(ing => {
                 const m = getMass(ing.qty, ing.unit);
                 secMass += m.mass;
                 if (!m.valid) partial = true;
             });
             const varId = slugify(section.intermediateDecl.name);
             ctx.variableWeights.set(varId, { mass: secMass, isPartial: partial });
        }
        if (section.retroPlanning) {
            res.retro_planning = section.retroPlanning;
        }
        sections.push(res);
    });

    return sections;
}

function compile(ast) {
    if (ast.type !== 'Recipe') throw new Error("Compiler expects Recipe AST");

    const registry = {
        ingredients: new Map(),
        cookware: new Map(),
        warnings: []
    };

    const sections = processSections(ast.children, registry);
    const shopping_list = generateShoppingList(sections, registry);
    
    const globalCookware = [];
    sections.forEach(sec => {
        sec.cookware.forEach(cw => {
             if (!cw.modifiers || !cw.modifiers.includes('reference')) {
                  globalCookware.push(cw);
             }
        });
    });

    const result = {
        title: ast.meta.title || null,
        slug: ast.meta.title ? slugify(ast.meta.title) : null,
        meta: ast.meta,
        registry: {
            ingredients: Object.fromEntries(registry.ingredients),
            cookware: Object.fromEntries(registry.cookware)
        },
        shopping_list, 
        cookware: globalCookware,
        sections,
        warnings: registry.warnings
    };

    return cleanObject(result);
}

module.exports = { compile };
