
import { getMass, quantityToMinutes } from './units';
import { slugify, minifyQuantity, createCleanUsage, cleanObject } from './utils';
import { generateShoppingList } from './shopping';
import { normalizeMass } from './mass_normalization';
import { 
    RecipeAST, SectionAST, IngredientAST, 
    Context, Registry, ProcessedSection, StepAST, CommentAST, 
    CompilationResult, Usage, ProcessedStep
} from 'gram-parser';

// Helper type helper since we don't have all exact AST names matching from Ohm semantics yet
// We'll trust the structure matches types.ts

export function processBlockItem(item: any, ctx: Context, registry: Registry, secIngredients: Usage[], secCookware: Usage[]): Usage | null | string {
    if (!item) return null;

    if (item.type === 'Ingredient') {
        const id = slugify(item.name);
        
        if (!registry.ingredients.has(id)) {
            let defaultUnit = null;
            if (item.quantity && item.quantity.unit) defaultUnit = item.quantity.unit;
            registry.ingredients.set(id, { id, name: item.name, default_unit: defaultUnit });
        }
        
        const entry = registry.ingredients.get(id);
        if (entry && item.quantity && item.quantity.unit && !entry.default_unit) {
            entry.default_unit = item.quantity.unit;
        }

        if (item.composite) {
            if (entry) entry.is_composite = true;
            const parentId = slugify(item.composite.parent);
            if (entry) entry.parent = parentId;
            if (!registry.ingredients.has(parentId)) {
                 registry.ingredients.set(parentId, { id: parentId, name: item.composite.parent, is_composite: true });
            } else {
                 const parent = registry.ingredients.get(parentId);
                 if (parent) parent.is_composite = true;
            }
        }

        // Handle RelativeQuantity
        if (item.quantity && item.quantity.type === 'RelativeQuantity') {
             const rel = item.quantity;
             const targetName = rel.target;
             const targetId = slugify(targetName);
             const percent = rel.percent;
             
             let totalQty = 0;
             let inheritedUnit: string | null = null;
             let isGhost = false;
             
             const markerChar = rel.referenceType === 'variable' ? '&' : '@';
             // Store formula for display.
             const formulaStr = `${percent}% de ${markerChar}${targetName}`;

             if (rel.referenceType === 'variable') {
                 if (ctx.variableWeights.has(targetId)) {
                     const varData = ctx.variableWeights.get(targetId);
                     if (varData) {
                        totalQty = varData.mass;
                        inheritedUnit = 'g'; 
                     }
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
             const usage = createCleanUsage(item, id, ctx.densityOverrides);
              usage.qty = parseFloat(newVal.toFixed(2)); 
              usage.unit = inheritedUnit || 'g'; 
              
              if (usage.unit) {
                  const norm = normalizeMass(usage.qty, usage.unit, usage.name || item.name, ctx.densityOverrides);
                  if (norm) {
                      usage.normalizedMass = norm.mass;
                      usage.conversionMethod = norm.method;
                      (usage as any).isEstimate = norm.isEstimate;
                  }
              } 
             
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

        const usage = createCleanUsage(item, id, ctx.densityOverrides);
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
        const usage = createCleanUsage(item, id, ctx.densityOverrides);
        secCookware.push(usage);
        return usage;
    }

    if (item.type === 'Alternative') {
        const processedOptions: any[] = [];
        // Sequential processing to allow internal references (e.g. A | B{50% A})
        // We create a temporary scope that accumulates previous options just for relative resolution visibility.
        // We do NOT modify the actual secIngredients/secCookware here, they are passed as context only if read.
        
        let tempIngredientsScope = [...secIngredients];
        let tempCookwareScope = [...secCookware];

        item.options.forEach((opt: any) => {
            // We pass temporary Arrays to capture outputs without polluting the main Section list yet
            // But wait, processBlockItem PUSHES to the arrays passed. 
            // So we need to pass a fake array to catch the output, but populate it with context first.
            
            // Actually, resolveRelativeQuantity reads from the array passed as 4th arg.
            // So we need to pass [ ...mainList, ...prevOptions ].
            
            const captureIngredients = [...tempIngredientsScope];
            const captureCookware = [...tempCookwareScope];
            
            const result = processBlockItem(opt, ctx, registry, captureIngredients, captureCookware);
            processedOptions.push(result);
            
            // If the option produced an ingredient/cookware, make it available for next options in this group
            if (result && typeof result !== 'string') {
                const r = result as Usage;
                if (r.type === 'ingredient' || r.type === 'drink' || (r.id && !r.type)) { 
                     tempIngredientsScope.push(r);
                }
                if (r.type === 'cookware') {
                     tempCookwareScope.push(r);
                }
            }
        });

        const usage: Usage = { id: 'alternative', type: 'alternative', options: processedOptions };
        
        if (item.options.length > 0) {
             if (item.options[0].type === 'Ingredient') {
                 secIngredients.push(usage);
             } else if (item.options[0].type === 'Cookware') {
                 secCookware.push(usage);
             }
        }
        return usage;
    }

    if (item.type === 'Reference') {
        const id = slugify(item.name);
        if (!registry.ingredients.has(id)) {
             ctx.warnings.push({ code: 'UNDEFINED_REFERENCE', message: `Reference to undefined ingredient '&${item.name}'.`, item: item.name });
        }
        if (ctx.definedIntermediates.has(item.name)) ctx.usedIntermediates.add(item.name);
        const obj: any = { type: 'reference', id };
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
            const entry = registry.ingredients.get(id);
            if (entry) entry.is_intermediate = true;
        }
        return null; // Don't return as step content
    }

    if (item.type === 'Text') return item.value;
    
    // Timer/Temperature logic
    if (item.type === 'Timer' || item.type === 'Temperature') {
        const obj: any = { type: item.type.toLowerCase() };
        if (item.name) obj.name = item.name;
        if (item.type === 'Timer' && (item as any).isAsync) obj.isAsync = true;
        if (item.quantity) {
             const q = item.quantity;
             if (q.value) obj.quantity = q.value;
             let unit = q.unit;
             if (item.type === 'Timer' && (unit === 'm' || unit === 'minutes')) unit = 'min';
             if (unit) obj.unit = unit;
             
             if (q.type === 'TextQuantity') {
                 ctx.warnings.push({ code: 'INVALID_UNIT', message: `Invalid text content in ${item.type}.`, item: (q as any).value });
                 obj.quantity = { type: 'text', value: (q as any).value }; 
             } else {
                 if (!unit) {
                     ctx.warnings.push({ code: 'MISSING_UNIT', message: `${item.type} must have an explicit unit.`, item: item.name || item.type });
                 }
             }
        }
        return obj;
    }

    if (item.type === 'Comment') {
        return { type: 'comment', value: item.value, kind: item.kind } as any;
    }

    return item;
}


// Scheduling State (Global mutable for straightforward linear processing across sections)
// In a real app we might want to return this state, but for now we assume linear sections.

function processSections(astChildren: any[], registry: Registry, overrides?: Record<string, number>): { sections: ProcessedSection[], metrics: { totalTime: number, activeTime: number } } {
    const ctx: Context = {
        warnings: registry.warnings,
        intermediateDecl: null,
        seenNames: new Set(),
        definedIntermediates: new Set(),
        usedIntermediates: new Set(),
        variableWeights: new Map(),
        globalScopes: new Map(), // Check Scope Conflicts
        densityOverrides: overrides || {}
    };

    const sections: ProcessedSection[] = [];
    let blocksToProcess = astChildren;
    
    // Normalize: ensure strict Sections
    if (blocksToProcess.length > 0 && blocksToProcess[0].type !== 'Section') {
        blocksToProcess = [{ type: 'Section', title: null, children: astChildren }];
    }

    let cookCursor = 0;
    let globalActiveTime = 0;
    const activeBackgroundTasks: Array<{ end: number }> = [];

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

        const sectionIngredients: Usage[] = [];
        const sectionCookware: Usage[] = [];
        const steps: ProcessedStep[] = [];

        section.children.forEach((block: any) => {
             if (block.type === 'Step') {
                 // --- Gantt Logic Start ---
                 let localActiveTime = 0;
                 const stepAsyncTasks: Array<{ name?: string, duration: number, startOffset: number }> = [];
                 
                 // Accumulate raw content for usage processing and mass calculation
                 const stepContentObjects: any[] = [];
                 let stepText = '';

                 ctx.intermediateDecl = null;
                 
                 block.children.forEach((item: any) => {
                     const processed = processBlockItem(item, ctx, registry, sectionIngredients, sectionCookware);
                     
                     if (processed) {
                          stepContentObjects.push(processed);

                          // Text Reconstruction & Timing
                          if (typeof processed === 'string') {
                              stepText += processed;
                          } else {
                              const p = processed as any; 
                              // Append basic text representation if available or appropriate
                              // For timers/ingredients, the name/value usually matters.
                              // Assuming processBlockItem doesn't return text for these, we rely on the parser's Text nodes for spaces/etc.
                              // But wait, the Parser splits "Knead ~{10m}" into Text("Knead "), Timer(...).
                              // So we just need to handle the Timer object.
                              
                              if (p.type === 'timer' && p.quantity) {
                                  // Reconstruct text for display
                                  const qtyVal = p.quantity.value || p.quantity;
                                  const unit = p.unit || '';
                                  const name = p.name ? `~${p.name}` : '~';
                                  stepText += `${name}{${qtyVal}${unit}}`;
                                  if (p.isAsync) stepText += '&';

                                  // Gantt: Timer Handling
                                  const duration = quantityToMinutes({ value: p.quantity, unit: p.unit });
                                  
                                  if (p.isAsync) {
                                      stepAsyncTasks.push({
                                          name: p.name || 'Timer',
                                          duration: duration,
                                          startOffset: localActiveTime
                                      });
                                      activeBackgroundTasks.push({ end: cookCursor + localActiveTime + duration });
                                  } else {
                                      localActiveTime += duration;
                                  }
                              } else if (p.type === 'ingredient') {
                                   stepText += `@${p.name}`; // Simplified reconstruction
                              } else if (p.type === 'cookware') {
                                   stepText += `#${p.name}`;
                              } else if (p.type === 'temperature') {
                                   const qtyVal = p.quantity.value || p.quantity;
                                   stepText += `!${p.name || ''}{${qtyVal}${p.unit || ''}}`;
                              } else if (p.type === 'reference') {
                                   stepText += `&${p.name}`; // Simplified
                              }
                          }
                     }
                 });

                 // Default Time Rule
                 if (localActiveTime === 0 && stepAsyncTasks.length === 0) {
                     localActiveTime = 2; // Default 2 minutes for untimed steps
                 }

                 // Finalize Step Timings
                 const startTime = cookCursor;
                 const endTime = cookCursor + localActiveTime;
                 
                 const stepObj: ProcessedStep = {
                     type: 'step',
                     value: stepText.trim(),
                     content: stepContentObjects,
                     timings: {
                         start: startTime,
                         end: endTime,
                         activeDuration: localActiveTime
                     },
                     backgroundTasks: stepAsyncTasks
                 };

                  if (block.action) {
                      (stepObj as any).action = block.action;
                  }

                 cookCursor += localActiveTime;
                 globalActiveTime += localActiveTime;

                 // Mass Calculation Stuff (Preserved)
                 let stepMass = 0;
                 let stepValid = true;
                 // Recalculate based on stepContentObjects
                 stepContentObjects.forEach(p => {
                      if (typeof p !== 'string') {
                          /* Mass calculation logic identical to before */
                          let m = 0;
                          let v = false;
                          if (p.qty && typeof p.qty === 'number') {
                                const massRes = getMass(p.qty, p.unit);
                                m = massRes.mass;
                                v = massRes.valid;
                          } else if (p.type === 'reference' && p.formula && p.qty) {
                                m = p.qty as number; 
                                v = true;
                          }
                          if (p.type === 'reference' && !p.qty) {
                                if (ctx.variableWeights.has(p.id)) {
                                    const vData = ctx.variableWeights.get(p.id);
                                    if (vData) {
                                        m = vData.mass;
                                        v = !vData.isPartial;
                                    }
                                }
                          }
                          stepMass += m;
                          if (!v) stepValid = false;
                      }
                 });

                 if (ctx.intermediateDecl) { 
                      const varId = ctx.intermediateDecl;
                      ctx.variableWeights.set(varId, { mass: stepMass, isPartial: !stepValid });
                      // Attach intermediate info to step? logic seems to be relying on ctx side-effect
                      // The original code set `stepObj.intermediate_preparation`
                      (stepObj as any).intermediate_preparation = ctx.intermediateDecl;
                 }
                 
                 steps.push(stepObj);

             } else if (block.type === 'Comment') {
                 // Comments don't take time
                 steps.push({ type: 'comment', value: block.value, kind: block.kind } as any);
             }
        });

        const res: ProcessedSection = { 
            title: section.title, 
            ingredients: sectionIngredients, 
            cookware: sectionCookware, 
            steps 
        };
        // Preserved logic for intermediateDecl on section
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

    // Calculate Total Time (Critical Path)
    let maxBackgroundTaskEnd = 0;
    activeBackgroundTasks.forEach(t => {
        if (t.end > maxBackgroundTaskEnd) maxBackgroundTaskEnd = t.end;
    });
    const totalTime = Math.max(cookCursor, maxBackgroundTaskEnd);

    return { 
        sections, 
        metrics: {
            totalTime,
            activeTime: globalActiveTime
        }
    };
}

export function compile(ast: RecipeAST): CompilationResult {
    if (ast.type !== 'Recipe') throw new Error("Compiler expects Recipe AST");

    const registry: Registry = {
        ingredients: new Map(),
        cookware: new Map(),
        warnings: []
    };

    // Parse Density Overrides from Metadata
    const densityOverrides: Record<string, number> = {};
    if (ast.meta && ast.meta.densities) {
        const d = ast.meta.densities;
        const list = Array.isArray(d) ? d : [d];
        list.forEach((entry: string) => {
            // Expected format: "ingredient: density" e.g. "flour: 0.6"
            const parts = entry.split(':');
            if (parts.length === 2) {
                const name = slugify(parts[0]);
                const density = parseFloat(parts[1].trim());
                if (!isNaN(density)) {
                    densityOverrides[name] = density;
                }
            }
        });
    }

    const resultPayload = processSections(ast.children, registry, densityOverrides);
    const sections = resultPayload.sections;
    const shopping_list = generateShoppingList(sections, registry);
    
    const globalCookware: Usage[] = [];
    sections.forEach(sec => {
        sec.cookware.forEach(cw => {
             if (!cw.modifiers || !cw.modifiers.includes('reference')) {
                  globalCookware.push(cw);
             }
        });
    });

    const result: CompilationResult = {
        title: (ast.meta as any).title || null,
        slug: (ast.meta as any).title ? slugify((ast.meta as any).title) : null,
        meta: ast.meta,
        registry: {
            ingredients: Object.fromEntries(registry.ingredients),
            cookware: Object.fromEntries(registry.cookware)
        },
        shopping_list, 
        cookware: globalCookware,
        sections,
        warnings: registry.warnings,
        metrics: {
            ...resultPayload.metrics,
            preparationTime: (() => {
                let t = 0;
                // 1. Base: 1 min per unique ingredient (including sub-ingredients if registered)
                t += registry.ingredients.size * 1;
                // 2. Base: 1 min per unique cookware
                t += registry.cookware.size * 1;

                // 3. Usage Bonus: +2 min for each manual preparation step
                const countPrep = (item: any): number => {
                    let localTime = 0;
                    if (!item) return 0;
                    
                    // Direct ingredient with preparation text
                    if (item.type === 'ingredient' && item.preparation) {
                         localTime += 2;
                    }
                    
                    // Groups / Alternatives : take the WORST case (MAX)
                    if (item.options && Array.isArray(item.options)) {
                        let maxOpt = 0;
                        item.options.forEach((opt: any) => {
                             const optTime = countPrep(opt);
                             if (optTime > maxOpt) maxOpt = optTime;
                        });
                        // Add the max cost of the alternatives to the current item cost (usually 0 if it's just a group container)
                        localTime += maxOpt;
                    } else if (!item.type && item.id && item.preparation) { // Polymorphic fallback
                        localTime += 2;
                    }
                    
                    return localTime;
                };

                sections.forEach(sec => {
                    sec.steps.forEach(s => {
                         if (s.content) s.content.forEach((c: any) => {
                             t += countPrep(c);
                         });
                    });
                });
                return t;
            })()
        }
    };

    return cleanObject(result);
}
