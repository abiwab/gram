# GRAM Parser

A robust, 3-stage parser for the GRAM recipe language.

## Architecture

This parser extracts data from `.gram` files using a three-step pipeline:

1.  **Parsing (OhmJS):** Validates the source against the grammar.
2.  **AST Generation:** Converts the raw parse tree into a clean Abstract Syntax Tree.
3.  **Compilation:** Processes the AST to generate a registry-based JSON model, handling:
    *   Linear scaling logic
    *   Composite ingredient aggregation (MAX logic)
    *   Ingredient & Cookware reference resolution
    *   Shopping list generation

## Usage

```javascript
const { parse } = require('gram-parser');

const source = `
## My Recipe
Mix @flour{200%g} and @water{100%ml}.
`;

try {
    const result = parse(source);
    console.log(result);
} catch (e) {
    console.error("Parsing error:", e.message);
}
```

## Structure

*   `src/index.js`: Entry point, orchestrates Parsing -> AST.
*   `src/compiler.js`: Handles AST -> Schema JSON transformation.
*   `grammar.ohm`: The OhmJS grammar definition.

## Output Model

The output is a JSON object optimized for UI rendering, featuring:
*   `registry`: Deduplicated definitions of ingredients/cookware.
*   `shopping_list`: Aggregated quantities.
*   `sections`: Step-by-step instructions with references to the registry.

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](../LICENSE) file for details.
