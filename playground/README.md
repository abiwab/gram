# Gram Playground

This is the official browser-based playground for **GRAM Language**, allowing you to write recipes and see the parsed output in real-time.

## Features

- **Real-time Parsing**: Write your recipe in GRAM on the left, and see the result instantly on the right.
- **Multiple Views**:
  - **JSON (Text)**: The raw structure parsed from your recipe.
  - **Tree View**: An interactive, collapsible JSON explorer to navigate complex recipes.
  - **Markdown**: A generated, readable markdown version of your recipe.
  - **Preview**: A beautiful, rendered view of the final recipe card.
- **Syntax Highlighting**: Basic syntax highlighting for the GRAM language editor.
- **Example Library**: Load pre-made recipes (Pancakes, Spaghetti, etc.) to learn the syntax.
- **Dark/Light Mode**: Toggle between themes to match your preference.
- **Clipboard Copy**: Easily copy the resulting JSON or Markdown.

## How to use

1. **Install Dependencies** (if developing):
   ```bash
   npm install
   ```

2. **Run Locally**:
   You can serve the `playground` directory with any static file server.
   ```bash
   npx serve playground
   ```
   Then open `http://localhost:3000` in your browser.

## Development

The project source code is located in `src/`. The build process bundles the parser, application logic, and CSS into the `dist/` directory.

To rebuild the project after making changes to `src/app.js` or `src/style.css`:

```bash
node build.js
```
