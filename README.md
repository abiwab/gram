# GRAM - General Recipe Abstract Markup
**A strictly typed, data-first recipe markup language for developers.**

![Status](https://img.shields.io/badge/Status-In%20Development-orange?style=flat-square)
![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-GPL_v3-blue.svg?style=flat-square)

GRAM is designed to write structured, machine-readable recipes without sacrificing readability. It treats recipes as **code**, compiling ingredients, instructions, and cookware into a strict AST (Abstract Syntax Tree) for precise analysis, scaling, and shopping list generation.

[**👉 Try the Online Playground**](https://abiwab.github.io/gram/playground/) *(or run it locally)*

> **🚧 Project Status: Active Development**
> GRAM is currently in an **Alpha stage**. The syntax specification is stabilizing, but the parser logic is actively being refined. Breaking changes may occur.
> **This is an Open Source project.** We believe standardizing recipe data requires a community effort. Feedback, feature requests, and code contributions are highly welcome!
---

## 📚 Documentation

The full technical documentation is available in the `docs/` folder.

*   [**Start Here: Documentation Index**](./docs/syntax_details/README.md)
*   [**Full Cheatsheet**](./docs/syntax_details/100_cheatsheet.md)
*   [**Best Practices**](./docs/syntax_details/98_best_practices.md)

---

## 🥘 Why GRAM?

Inspired by the excellent [Cooklang](https://cooklang.org), GRAM evolves the concept by enforcing a **strict schema** and advanced logic capabilities.

While Cooklang focuses on natural language fluidity, GRAM prioritizes **data integrity** and **computational logic**:

1.  **Data vs. Narrative:** Clear separation between ingredients (`@flour{200g}`) and instructions.
2.  **Mise en Place:** Distinguishes between the **Shopping List** (Aggregated totals) and the **Section List** (What you need on the table right now).
3.  **Complex Relationships:**
    *   **References (`@&`)**: Reuse previously measured ingredients without doubling the shopping list amount.
    *   **Intermediate Preparations (`->&dough`)**: Chain recipe parts like variables.
    *   **Relative Quantities**: Define `@water{60% @flour}` for dynamic bakers math.
    *   **Composites**: Handle "Zest of 1 lemon" and "Juice of 1 lemon" implying "Buy 1 Lemon".

---

## ⚡ Quick Syntax

```gram
## Dough {T-2h} ->&dough{}

[Mix] The @flour{200g} and @water{100ml}.

[Add] The @&dough{} to a #bowl{}.

[Rest] for ~{30min}.

[Bake] In the #oven at !oven{200°C}.
```

---

## 🛠️ Project Structure

This monorepo contains:

*   **`gram-parser/`**: The core logic. Validates parsing, builds the AST, and compiles the Shopping List.
*   **`playground/`**: A web-based IDE to write GRAM and visualize the output (JSON, Markdown, Preview).
*   **`docs/`**: Comprehensive documentation.

---

## 🤝 Contributing

**We need your help to make GRAM the standard for structured recipes!**

Whether you are a developer, a chef, or a data enthusiast, your contributions are welcome.

* **Found a bug?** Open an issue to help us squash it.
* **Have an idea?** Start a discussion on syntax improvements.
* **Want to code?** Fork the repo and submit a Pull Request.

---

## 📦 Try it out

### 1. Run the Playground locally

To inspect the parser or test your recipes in the web-based playground IDE :

```bash
cd playground
npm install
npx serve
```

### 2. Use the Parser

*(See `gram-parser/README.md` for API details)*

```javascript
const { parse } = require('gram-parser');
const result = parse(myGramString);

console.log(result.shopping_list);
```

## 👏 Acknowledgments

GRAM stands on the shoulders of giants.
* **[Cooklang](https://cooklang.org)**: For pioneering the concept of a recipe markup language. GRAM was heavily inspired by their concise syntax.
* **Ohm.js**: For making parsing accessible and robust.

## License

Distributed under the GPL-3.0 License.