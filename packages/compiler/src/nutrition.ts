import { Usage } from 'gram-parser';
import { getIngredientData } from './ingredient_db';
import { normalizeMass } from './mass_normalization';

interface Macros {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export interface NutritionMetrics {
    total: Macros;
    perPortion?: Macros;
    isEstimate: boolean;
    coverage: number; // 0-1, how many ingredients had macros
}

export function calculateNutrition(ingredients: any[], portions: number = 1): NutritionMetrics {
    const total: Macros = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    let metricsCount = 0;
    let knownCount = 0;
    
    // Flatten composite ingredients and alternatives
    const flatList: Usage[] = [];
    
    ingredients.forEach(item => {
        if (item.type === 'composite' && item.usage) {
             // Use sub-ingredients for nutrition if possible, BUT mass calculation often runs on parent.
             // Actually, if we have mass for parent (e.g. 6 Eggs), use parent.
             // If parent has no data, try children.
             // In shopping list we calculated both.
             // For simplicity, let's treat composite parent as the ingredient if it has mass.
             flatList.push(item);
        } else if (item.type === 'alternative') {
             // For alternatives, assume FIRST option (as per mass logic)
             if (item.options && item.options.length > 0) {
                 flatList.push(item.options[0]);
             }
        } else {
             flatList.push(item);
        }
    });

    flatList.forEach(item => {
        // We need normalized mass.
        // If coming from shopping list, it might have it.
        // If coming from raw Usage, we might need to calculate it.
        // Let's re-calculate to be safe/independent, or accept pre-calculated.
        
        // Try to get IDs
        const id = item.id;
        if (!id) return;
        
        metricsCount++;

        let mass = 0;
        let isEst = false;

        // Try to calculate mass
        if (item.qty && (typeof item.qty === 'number' || (item.qty as any).value)) {
            const val = typeof item.qty === 'number' ? item.qty : (item.qty as any).value;
            const unit = item.unit || 'unit'; // Default to unit if missing? Or should match normalizeMass default logic
            
            // Note: normalizeMass handles 'unit' (count) logic now via overrides/DB
            const norm = normalizeMass(val, unit, item.name); // Using name or ID? normalizeMass uses name/slug internally
            if (norm) {
                mass = norm.mass;
                isEst = norm.isEstimate;
            }
        }

        if (mass > 0) {
            const data = getIngredientData(id);
            if (data && data.macros) {
                knownCount++;
                const factor = mass / 100.0;
                total.calories += data.macros.calories * factor;
                total.protein += data.macros.protein * factor;
                total.carbs += data.macros.carbs * factor;
                total.fat += data.macros.fat * factor;
            } else {
                 // No macros found for this ingredient
                 // Even if we know the mass
            }
        }
    });

    const coverage = metricsCount > 0 ? knownCount / metricsCount : 0;

    // Rounding
    total.calories = Math.round(total.calories);
    total.protein = Math.round(total.protein * 10) / 10;
    total.carbs = Math.round(total.carbs * 10) / 10;
    total.fat = Math.round(total.fat * 10) / 10;

    const res: NutritionMetrics = {
        total,
        isEstimate: true, // Always an estimate
        coverage
    };

    if (portions > 1) {
        res.perPortion = {
            calories: Math.round(total.calories / portions),
            protein: Math.round(total.protein / portions * 10) / 10,
            carbs: Math.round(total.carbs / portions * 10) / 10,
            fat: Math.round(total.fat / portions * 10) / 10
        };
    }

    return res;
}
