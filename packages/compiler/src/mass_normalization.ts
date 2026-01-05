
/**
 * Mass Normalization Module
 * 
 * Responsible for converting physical mass units into a standard GRAM unit (g).
 */

interface ConversionResult {
    mass: number;
    method: 'physical';
}

const UNIT_FACTORS: Record<string, number> = {
    // Metric
    'g': 1,
    'gram': 1,
    'grams': 1,
    'gramme': 1,
    'grammes': 1,
    'kg': 1000,
    'kilogram': 1000,
    'kilograms': 1000,
    'mg': 0.001,
    'milligram': 0.001,
    'milligrams': 0.001,
    
    // Imperial
    'oz': 28.3495,
    'ounce': 28.3495,
    'ounces': 28.3495,
    'lb': 453.592,
    'lbs': 453.592,
    'pound': 453.592,
    'pounds': 453.592
};

export function normalizeMass(amount: number, unit: string): ConversionResult | null {
    if (!unit) return null;
    
    const normalizedUnit = unit.toLowerCase().trim();
    const factor = UNIT_FACTORS[normalizedUnit];

    if (factor !== undefined) {
        return {
            mass: amount * factor,
            method: 'physical'
        };
    }

    return null;
}
