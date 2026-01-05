import { UNIT_CONVERSIONS } from './units';
import { getIngredientData } from './ingredient_db';
import { slugify } from './utils';

/**
 * Mass Normalization Module
 * 
 * Responsible for converting physical mass units into a standard GRAM unit (g).
 */

interface ConversionResult {
    mass: number;
    method: 'physical' | 'density' | 'unit_weight' | 'default' | 'explicit';
}

export function normalizeMass(amount: number, unit: string, ingredientName?: string, overrides?: Record<string, number>): ConversionResult & { isEstimate: boolean } | null {
    if (!unit) {
         // ...
    }
    
    const u = unit.toLowerCase().trim();

    // 1. Physical Mass
    const massMap = UNIT_CONVERSIONS.mass.map;
    if (massMap[u] !== undefined) {
        return { mass: amount * massMap[u], method: 'physical', isEstimate: false };
    }

    // 2. Volume -> Density
    const volMap = UNIT_CONVERSIONS.volume.map;
    if (volMap[u] !== undefined) {
        const volumeMl = amount * volMap[u];
        let density = 1.0; // Default Water
        let method: 'density' | 'default' | 'explicit' = 'default';

        if (ingredientName) {
            // Check overrides first
            if (overrides && overrides[slugify(ingredientName)]) {
                density = overrides[slugify(ingredientName)];
                method = 'explicit';
            } else {
                const data = getIngredientData(ingredientName);
                if (data) {
                    density = data.density;
                    method = 'density';
                }
            }
        }
        return { 
            mass: volumeMl * density, 
            method,
            isEstimate: method !== 'explicit' 
        };
    }

    // 3. Count -> Unit Weight
    const COUNT_UNITS = ['unit', 'units', 'piece', 'pieces', 'ea', 'each', ''];
    
    if (COUNT_UNITS.includes(u)) {
        if (ingredientName) {
            // Check overrides first
            if (overrides && overrides[slugify(ingredientName)]) {
                const unitWt = overrides[slugify(ingredientName)];
                return { 
                    mass: amount * unitWt, 
                    method: 'explicit', 
                    isEstimate: false // User defined rule -> considered precise for this recipe
                };
            }

            const data = getIngredientData(ingredientName);
            if (data && data.unit_weight) {
                return { mass: amount * data.unit_weight, method: 'unit_weight', isEstimate: true };
            }
        }
    }

    return null;
}


