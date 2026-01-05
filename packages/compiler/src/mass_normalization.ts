
import { getIngredientData } from './ingredient_db';

/**
 * Mass Normalization Module
 * 
 * Responsible for converting physical mass units into a standard GRAM unit (g).
 */

interface ConversionResult {
    mass: number;
    method: 'physical' | 'density' | 'unit_weight' | 'default' | 'explicit';
}

const MASS_FACTORS: Record<string, number> = {
    'g': 1, 'gram': 1, 'grams': 1, 'gramme': 1, 'grammes': 1,
    'kg': 1000, 'kilogram': 1000, 'kilograms': 1000,
    'mg': 0.001, 'milligram': 0.001, 'milligrams': 0.001,
    'oz': 28.3495, 'ounce': 28.3495, 'ounces': 28.3495,
    'lb': 453.592, 'lbs': 453.592, 'pound': 453.592, 'pounds': 453.592
};

const VOLUME_FACTORS: Record<string, number> = {
    'ml': 1, 'milliliter': 1, 'milliliters': 1,
    'l': 1000, 'liter': 1000, 'liters': 1000,
    'cl': 10, 'centiliter': 10,
    'dl': 100, 'deciliter': 100,
    'tsp': 4.9289, 'teaspoon': 4.9289, 'teaspoons': 4.9289,
    'tbsp': 14.7868, 'tablespoon': 14.7868, 'tablespoons': 14.7868,
    'cup': 236.588, 'cups': 236.588,
    'pint': 473.176,
    'quart': 946.353,
    'gallon': 3785.41,
    'fl oz': 29.5735, 'fluid ounce': 29.5735
};

export function normalizeMass(amount: number, unit: string, ingredientName?: string, overrides?: Record<string, number>): ConversionResult & { isEstimate: boolean } | null {
    if (!unit) {
         // ...
    }
    
    const u = unit.toLowerCase().trim();

    // 1. Physical Mass
    if (MASS_FACTORS[u] !== undefined) {
        return { mass: amount * MASS_FACTORS[u], method: 'physical', isEstimate: false };
    }

    // 2. Volume -> Density
    if (VOLUME_FACTORS[u] !== undefined) {
        const volumeMl = amount * VOLUME_FACTORS[u];
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
    const COUNT_UNITS = ['unit', 'units', 'piece', 'pieces', 'ea', 'each'];
    
    if (COUNT_UNITS.includes(u)) {
        if (ingredientName) {
             // Overrides for unit weight? 
             // The task specifically mentioned "density overrides".
             // But logical to allow unit weight overrides too if we wanted.
             // For now, only DB lookup.
            const data = getIngredientData(ingredientName);
            if (data && data.unit_weight) {
                return { mass: amount * data.unit_weight, method: 'unit_weight', isEstimate: true };
            }
        }
    }

    return null;
}

// Helper to avoid circular dependency if possible, but safe here
function slugify(text: string): string {
    return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
