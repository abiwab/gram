
/**
 * Ingredient Database
 * Stores physical properties of common ingredients for mass estimation.
 */

export interface IngredientData {
    density: number; // g/ml (water = 1.0)
    unit_weight?: number; // g per piece (e.g. 1 egg = 55g)
}

// Top 50 Common Ingredients Data
// Densities are approximate averages.
export const INGREDIENT_DB: Record<string, IngredientData> = {
    // Basics
    'water': { density: 1.0 },
    'milk': { density: 1.03 },
    'oil': { density: 0.92 },
    'butter': { density: 0.95, unit_weight: 113.4 }, // 1 stick is common unit in US, but here unit_weight refers to "1 butter"? usually no count for butter unless "stick". 
    // Actually for butter @butter{1} usually implies a stick in informal contexts or it's undefined. 
    // Let's stick to Density mainly.
    
    // Baking
    'flour': { density: 0.59 }, // All-purpose, sifted-ish
    'sugar': { density: 0.85 }, // Granulated
    'brown sugar': { density: 0.93 },
    'powdered sugar': { density: 0.56 },
    'salt': { density: 1.2 }, // Table salt
    'honey': { density: 1.42 },
    'yeast': { density: 0.95 },
    'baking powder': { density: 0.9 },
    'cocoa powder': { density: 0.45 },

    // Dairy
    'cream': { density: 1.01 },
    'yogurt': { density: 1.06 },
    'cheese': { density: 0.6 }, // Grated cheddar roughly

    // Produce (Unit Weights are critical here)
    'egg': { density: 1.03, unit_weight: 55 }, // Large egg
    'eggs': { density: 1.03, unit_weight: 55 },
    'egg yolk': { density: 1.03, unit_weight: 18 },
    'egg white': { density: 1.03, unit_weight: 33 },
    'lemon': { density: 1.0, unit_weight: 120 },
    'lime': { density: 1.0, unit_weight: 60 },
    'onion': { density: 0.7, unit_weight: 150 }, // Chopped density / Medium onion
    'garlic': { density: 0.6, unit_weight: 5 }, // Clove
    'carrot': { density: 0.7, unit_weight: 100 },
    'potato': { density: 0.77, unit_weight: 200 },
    'apple': { density: 0.6, unit_weight: 180 },
    'banana': { density: 0.9, unit_weight: 120 },
    'tomato': { density: 0.95, unit_weight: 120 },

    // Grains
    'rice': { density: 0.85 },
    'oats': { density: 0.4 },
    'pasta': { density: 0.5 }, // Dry

    // Liquids
    'wine': { density: 0.99 },
    'vinegar': { density: 1.01 },
    'soy sauce': { density: 1.13 },
    'maple syrup': { density: 1.32 }
};

export function getIngredientData(name: string): IngredientData | null {
    const slug = name.toLowerCase().trim();
    // Direct match
    if (INGREDIENT_DB[slug]) return INGREDIENT_DB[slug];
    
    // Simple singularization fallback (very naive)
    if (slug.endsWith('s') && INGREDIENT_DB[slug.slice(0, -1)]) {
        return INGREDIENT_DB[slug.slice(0, -1)];
    }

    return null;
}
