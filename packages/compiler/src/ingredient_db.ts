
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
// Internal Definition with Synonyms
const RAW_ENTRIES: Array<{ names: string[], data: IngredientData }> = [
    // Basics
    { names: ['water'], data: { density: 1.0 } },
    { names: ['milk'], data: { density: 1.03 } },
    { names: ['oil', 'vegetable oil', 'olive oil'], data: { density: 0.92 } },
    { names: ['butter'], data: { density: 0.95, unit_weight: 113.4 } },
    
    // Baking
    { names: ['flour', 'all-purpose flour', 'wheat flour'], data: { density: 0.59 } },
    { names: ['sugar', 'granulated sugar'], data: { density: 0.85 } },
    { names: ['brown sugar'], data: { density: 0.93 } },
    { names: ['powdered sugar', 'icing sugar', 'confectioners sugar'], data: { density: 0.56 } },
    { names: ['salt'], data: { density: 1.2 } },
    { names: ['honey'], data: { density: 1.42 } },
    { names: ['yeast'], data: { density: 0.95 } },
    { names: ['baking powder'], data: { density: 0.9 } },
    { names: ['cocoa', 'cocoa powder'], data: { density: 0.45 } },

    // Dairy
    { names: ['cream', 'heavy cream'], data: { density: 1.01 } },
    { names: ['yogurt', 'yoghurt'], data: { density: 1.06 } },
    { names: ['cheese', 'cheddar'], data: { density: 0.6 } },

    // Produce
    { names: ['egg', 'eggs'], data: { density: 1.03, unit_weight: 55 } },
    { names: ['egg yolk', 'egg yolks'], data: { density: 1.03, unit_weight: 18 } },
    { names: ['egg white', 'egg whites'], data: { density: 1.03, unit_weight: 33 } },
    { names: ['lemon', 'lemons'], data: { density: 1.0, unit_weight: 120 } },
    { names: ['lime', 'limes'], data: { density: 1.0, unit_weight: 60 } },
    { names: ['onion', 'onions'], data: { density: 0.7, unit_weight: 150 } },
    { names: ['garlic', 'garlic clove', 'garlic cloves'], data: { density: 0.6, unit_weight: 5 } },
    { names: ['carrot', 'carrots'], data: { density: 0.7, unit_weight: 100 } },
    { names: ['potato', 'potatoes'], data: { density: 0.77, unit_weight: 200 } },
    { names: ['apple', 'apples'], data: { density: 0.6, unit_weight: 180 } },
    { names: ['banana', 'bananas'], data: { density: 0.9, unit_weight: 120 } },
    { names: ['tomato', 'tomatoes'], data: { density: 0.95, unit_weight: 120 } },

    // Grains
    { names: ['rice'], data: { density: 0.85 } },
    { names: ['oats', 'rolled oats'], data: { density: 0.4 } },
    { names: ['pasta'], data: { density: 0.5 } },

    // Liquids
    { names: ['wine', 'red wine', 'white wine'], data: { density: 0.99 } },
    { names: ['vinegar'], data: { density: 1.01 } },
    { names: ['soy sauce'], data: { density: 1.13 } },
    { names: ['maple syrup'], data: { density: 1.32 } }
];

// Generate the fast lookup map efficiently
export const INGREDIENT_DB: Record<string, IngredientData> = {};

RAW_ENTRIES.forEach(entry => {
    entry.names.forEach(name => {
        INGREDIENT_DB[name] = entry.data;
    });
});

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
