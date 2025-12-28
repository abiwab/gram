import { parse } from './generated-parser.js';

const input = document.getElementById('input');
const output = document.getElementById('output');

const status = document.getElementById('status');
const themeToggle = document.getElementById('theme-toggle');
// Output Mode Logic
const warningsArea = document.getElementById('warnings');
const tabButtons = document.querySelectorAll('.tab-btn[data-mode]');
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active state
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update logic
        outputMode = btn.dataset.mode;
        update();
    });
});

// Theme Logic
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
});

function updateThemeIcon(isLight) {
    // Simple text or svg swap
    themeToggle.innerHTML = isLight 
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#000000" viewBox="0 0 256 256"><path d="M236.37,139.4a12,12,0,0,0-12-3A84.07,84.07,0,0,1,119.6,31.59a12,12,0,0,0-15-15A108.86,108.86,0,0,0,49.69,55.07,108,108,0,0,0,136,228a107.09,107.09,0,0,0,64.93-21.69,108.86,108.86,0,0,0,38.44-54.94A12,12,0,0,0,236.37,139.4Zm-49.88,47.74A84,84,0,0,1,68.86,69.51,84.93,84.93,0,0,1,92.27,48.29Q92,52.13,92,56A108.12,108.12,0,0,0,200,164q3.87,0,7.71-.27A84.79,84.79,0,0,1,186.49,187.14Z"></path></svg>` // Moon for "Go Dark"
        : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#ffffff" viewBox="0 0 256 256"><path d="M116,36V20a12,12,0,0,1,24,0V36a12,12,0,0,1-24,0Zm80,92a68,68,0,1,1-68-68A68.07,68.07,0,0,1,196,128Zm-24,0a44,44,0,1,0-44,44A44.05,44.05,0,0,0,172,128ZM51.51,68.49a12,12,0,1,0,17-17l-12-12a12,12,0,0,0-17,17Zm0,119-12,12a12,12,0,0,0,17,17l12-12a12,12,0,1,0-17-17ZM196,72a12,12,0,0,0,8.49-3.51l12-12a12,12,0,0,0-17-17l-12,12A12,12,0,0,0,196,72Zm8.49,115.51a12,12,0,0,0-17,17l12,12a12,12,0,0,0,17-17ZM48,128a12,12,0,0,0-12-12H20a12,12,0,0,0,0,24H36A12,12,0,0,0,48,128Zm80,80a12,12,0,0,0-12,12v16a12,12,0,0,0,24,0V220A12,12,0,0,0,128,208Zm108-92H220a12,12,0,0,0,0,24h16a12,12,0,0,0,0-24Z"></path></svg>`; // Sun for "Go Light"
}

// Init Theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.add('light');
    updateThemeIcon(true);
} else {
    updateThemeIcon(false);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Output Mode Logic
let outputMode = 'json'; // 'json' | 'markdown' | 'html'

// Helper for minified properties
function getQty(item) {
    if (item.qty !== undefined) {
        if (typeof item.qty === 'number') return { value: item.qty, text: String(item.qty) };
        return item.qty;
    }
    return item.quantity;
}

// Helper for Timer/Temperature range display
function formatQuantityValue(q) {
    if (!q) return '';
    // Check if it's a semantic quantity object from the parser
    // { type: 'range', value: avg, range: { min, max }, text: "160-180" }
    if (q.type === 'range' && q.text) return q.text;
    
    // { type: 'fraction', value: 0.5, text: "1/2" }
    if (q.text) return q.text;
    
    // { value: 123 }
    if (q.value !== undefined) return q.value;
    
    // Simple number
    return q;
}

function renderMarkdown(data) {
    const registry = data.registry || { ingredients: {}, cookware: {} };
    let md = '';
    
    // Title
    if (data.title) md += `# ${data.title}\n\n`;
    
    // Meta
    if (data.meta && Object.keys(data.meta).length > 0) {
        md += `> **Metadata**\n`;
        for (const [k, v] of Object.entries(data.meta)) {
            if (k !== 'title') md += `> - ${k}: ${v}\n`;
        }
        md += '\n';
    }
    
    // Shopping List
    if (data.shopping_list && data.shopping_list.length > 0) {
        md += `## 🛒 Shopping List\n\n`;
        data.shopping_list.forEach(item => {
            if (item.type === 'alternative' || item.type === 'group') {
                md += `- **Alternative Group**:\n`;
                item.options.forEach(opt => {
                    md += `  - ${formatIngredient(opt, registry)}\n`;
                });
            } else if (item.type === 'composite') {
                 // Composite handling for MD
                 // Parent Quantity Display
                 let parentStr = formatIngredient(item, registry);
                 // If formatIngredient didn't add the quantity because it's usually for usage,
                 // we must handle it here. 
                 // However, formatIngredient uses getQty(item) which looks at item.qty.
                 // Composite item has 'qty' property (from maxQty).
                 // So formatIngredient SHOULD display it if present.
                 md += `- **${parentStr}** (Composite):\n`;
                 item.usage.forEach(child => {
                     md += `  - ${formatIngredient(child, registry)}\n`;
                 });
            } else if (item.display) {
                  // New Shopping List Format
                  md += `- ${item.display}\n`;
            } else {
                md += `- ${formatIngredient(item, registry)}\n`;
            }
        });
        md += '\n';
    }
    
    // Cookware
    if (data.cookware && data.cookware.length > 0) {
        md += `## 🍳 Cookware\n\n`;
        data.cookware.forEach(cw => {
             if (cw.type === 'alternative' || cw.type === 'group') {
                 md += `- **Alternative Group**:\n`;
                 cw.options.forEach(opt => {
                     md += `  - ${formatCookware(opt, registry)}\n`;
                 });
             } else {
                 md += `- ${formatCookware(cw, registry)}\n`;
             }
        });
        md += '\n';
    }
    
    // Instructions
    if (data.sections && data.sections.length > 0) {
        md += `## 👨‍🍳 Instructions\n\n`;
        data.sections.forEach(sec => {
            if (sec.title) {
                md += `### ${sec.title}`;
                if (sec.retro_planning) md += ` {T-${sec.retro_planning}}`;
                md += `\n\n`;
            }
            
            // Section Ingredients
            if (sec.ingredients && sec.ingredients.length > 0) {
                md += `**Ingredients**:\n`;
                sec.ingredients.forEach(item => {
                    if (item.type === 'alternative' || item.type === 'group') {
                        md += `- **Alternative Group**:\n`;
                        item.options.forEach(opt => {
                            md += `  - ${formatIngredient(opt, registry)}\n`;
                        });
                    } else {
                        md += `- ${formatIngredient(item, registry)}\n`;
                    }
                });
                md += '\n';
            }
            
            sec.steps.forEach((step, idx) => {
                if (step.type === 'comment') {
                     md += `> *${step.value ? step.value.trim() : ''}*\n\n`;
                     return;
                }

                const stepNum = idx + 1;
                let stepText = '';
                
                // Prepend Action if exists
                if (step.action) {
                     stepText += `**[${step.action}]** `;
                }

                if (step.type === 'text') {
                    stepText += step.value;
                } else if (step.type === 'step') {
                     stepText += step.content.map((c, i, arr) => {
                         let str = '';
                         if (typeof c === 'string') {
                             str = c;
                         } else if (c.type === 'text') {
                             str = c.value;
                         } else if (c.type === 'timer') {
                             str = `⏲️${formatQuantityValue(c.quantity)}${c.unit ? ' ' + c.unit : ''}`;
                         } else if (c.type === 'temperature') {
                             str = `🔥${formatQuantityValue(c.quantity)}${c.unit ? ' ' + c.unit : ''}`;
                         } else if (c.type === 'reference') {
                             const name = registry.ingredients[c.id]?.name || c.id;
                             str = `👉*${name}*`;
                             const qty = getQty(c);
                             if (qty) {
                                 str += ` (${qty.text || qty.value}`;
                                 if (c.unit) str += ` ${c.unit}`;
                                 str += ')';
                             }
                         } else if (!c.type && c.id) {
                              if (registry.cookware[c.id]) str = `*${formatCookware(c, registry)}*`;
                              else str = `**${formatIngredient(c, registry)}**`;
                         } else if (c.type === 'ingredient') {
                             str = `**${formatIngredient(c, registry)}**`;
                         } else if (c.type === 'cookware') {
                             str = `*${formatCookware(c, registry)}*`;
                         } else if (c.type === 'alternative') {
                             str = c.options.map(opt => {
                                 const isCookware = opt.type === 'cookware' || registry.cookware[opt.id];
                                 if (isCookware) return `*${formatCookware(opt, registry)}*`;
                                 return `**${formatIngredient(opt, registry)}**`;
                             }).join(' or ');
                         } else if (c.type === 'group') {
                              str = c.options.map(opt => {
                                 const isCookware = opt.type === 'cookware' || registry.cookware[opt.id];
                                 if (isCookware) return `*${formatCookware(opt, registry)}*`;
                                 return `**${formatIngredient(opt, registry)}**`;
                             }).join(' or ');
                         } else if (c.type === 'comment') {
                             str = ` *${c.value.trim()}*`;
                         }

                         // Spacing Logic
                         const isObject = (typeof c !== 'string' && c.type !== 'text' && c.type !== 'comment');
                         if (isObject) {
                             const next = arr[i+1];
                             if (next) {
                                let nextChar = '';
                                if (typeof next === 'string') nextChar = next[0];
                                else if (next.type === 'text') nextChar = next.value ? next.value[0] : '';
                                
                                // Don't add space if next is glue (punctuation or space)
                                const isGlue = nextChar && /^[.,!?:;)]/.test(nextChar) || (nextChar && /^\s/.test(nextChar));
                                if (!isGlue) {
                                    str += ' ';
                                }
                             }
                         }
                         return str;
                     }).join('');
                }
                md += `${stepNum}. ${stepText}\n`;
            });
            md += '\n';
        });
    }
    
    return md;
}

function formatIngredient(item, registry) {
    // Resolve name from registry
    const def = registry.ingredients[item.id];
    let str = def ? def.name : item.id;
    
    // Alias overrides name if present in usage
    if (item.alias) str = item.alias;
    
    // Shopping List Specific Display
    // If we have variableentries, we might want to display them cleanly.
    // The Input item here might be from shopping list OR from instructions.
    // Shopping list items have 'qty', 'unit', and potentially 'variable_entries'.
    
    const qty = getQty(item);
    
    // Formula handling
    const formulaStr = item.formula ? `${item.formula.percent}% of ${item.formula.target}` : null;
    const isPartial = item.formula && item.formula.is_partial;

    if (isPartial) {
        // Replace quantity with formula
        str += ` (${formulaStr} ⚠️)`;
    } else {
        let qtyParts = [];
        
        if (qty) {
            let qStr = qty.text || qty.value;
            if (item.unit) qStr += ` ${item.unit}`;
            qtyParts.push(qStr);
        }
        
        if (item.variable_entries && item.variable_entries.length > 0) {
             qtyParts.push(...item.variable_entries);
        }
        
        if (qtyParts.length > 0) {
             str += ` (${qtyParts.join(' + ')})`;
        }
        
        if (formulaStr) str += ` [${formulaStr}]`;
    }

    if (item.preparation) str += ` (${item.preparation})`;
    if (item.modifiers && item.modifiers.includes('optional')) str += ' (optional)';
    
    return str;
}

function formatCookware(item, registry) {
    const def = registry.cookware[item.id];
    let str = def ? def.name : item.id;
    
    if (item.alias) str = item.alias;
    
    const qty = getQty(item);
    if (qty) {
        str += ` (${qty.value})`;
    }
    return str;
}


function update() {
    const text = input.value;
    try {
        const result = parse(text);
        
        // Prepare content
        let content = '';
        if (outputMode === 'json') {
             content = JSON.stringify(result, null, 2);
             // JSON view already shows them at the bottom.
             if (result.warnings && result.warnings.length > 0) {
                 showWarnings(result.warnings);
             } else {
                 hideWarnings();
             }
        } else if (outputMode === 'markdown') {
             content = renderMarkdown(result);
             if (result.warnings && result.warnings.length > 0) {
                 showWarnings(result.warnings);
             } else {
                 hideWarnings();
             }
        } else if (outputMode === 'json-tree') {
             content = renderJsonTree(result);
             if (result.warnings && result.warnings.length > 0) {
                 showWarnings(result.warnings);
             } else {
                 hideWarnings();
             }
        } else if (outputMode === 'preview') {
             content = renderHTML(result);
             if (result.warnings && result.warnings.length > 0) {
                 showWarnings(result.warnings);
             } else {
                 hideWarnings();
             }
        }

        const previewOutput = document.getElementById('preview-output');
        const preOutput = document.getElementById('output').parentElement; // pre is parent of code#output
        
        // Render
        if (outputMode === 'preview' || outputMode === 'json-tree') {
            // Hide Code View
            preOutput.style.display = 'none';
            
            // Show Preview (reused for tree as it's HTML content)
            previewOutput.style.display = 'block';
            previewOutput.innerHTML = content;
            
            if (outputMode === 'json-tree') {
                // Add listeners for Expand/Collapse All
                const btnExpand = previewOutput.querySelector('#btn-expand-all');
                const btnCollapse = previewOutput.querySelector('#btn-collapse-all');
                
                if (btnExpand && btnCollapse) {
                    btnExpand.addEventListener('click', () => {
                         const nodes = previewOutput.querySelectorAll('.json-node');
                         nodes.forEach(n => {
                             n.classList.remove('collapsed');
                             const t = n.querySelector('.json-toggle');
                             if (t) t.textContent = '▼';
                         });
                    });
                    
                    btnCollapse.addEventListener('click', () => {
                         const nodes = previewOutput.querySelectorAll('.json-node');
                         nodes.forEach((n, index) => {
                             if (index === 0) return; // Keep root expanded
                             n.classList.add('collapsed');
                             const t = n.querySelector('.json-toggle');
                             if (t) t.textContent = '▶';
                         });
                    });
                }
                
                const headers = previewOutput.querySelectorAll('.json-header');
                headers.forEach(h => {
                    h.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // The parent is the .json-node
                        const node = h.parentElement;
                        node.classList.toggle('collapsed');
                        
                        // Toggle arrow text
                        const toggle = h.querySelector('.json-toggle');
                        if (toggle) {
                             if (node.classList.contains('collapsed')) {
                                toggle.textContent = '▶';
                            } else {
                                toggle.textContent = '▼';
                            }
                        }
                     });
                });
            }
        } else {
            // Show Code View
            preOutput.style.display = 'block'; // Or flex/initial? pre has flex:1
            // pre styles: flex: 1. So display:flex or block? Pre is block by default but we set flex:1. 
            // Wait, pre is a flex item in .code-viewer?
            // "pre { flex: 1; ... }"
            // If we hide it, it's gone. If we show it, 'block' works for pre, but flex:1 applies if parent is flex.
            preOutput.style.removeProperty('display'); // Revert to css default
            
            // Hide Preview
            previewOutput.style.display = 'none';

            if (outputMode === 'json') {
                output.textContent = content;
                output.className = 'language-json';
            } else {
                output.textContent = content; 
                output.className = 'language-markdown';
            }
            
            output.removeAttribute('data-highlighted');
            // Reset any previous line numbers structure
            // If we don't do this, hljs might not re-run or might stack tables
            // But output.textContent = content ALREADY destroys the table structure.
            // So we just need to tell hljs it's fresh.
            
            hljs.highlightElement(output);
            hljs.lineNumbersBlock(output);
        }
        
        status.textContent = 'Valid';
        status.className = 'status success';
    } catch (e) {
        output.textContent = e.message;
        output.textContent = e.message; 
        status.textContent = 'Error';
        status.className = 'status error';
    }
}


function renderHTML(data) {
    const registry = data.registry || { ingredients: {}, cookware: {} };
    let html = '';
    
    // Title
    if (data.title) {
        html += `<h1>${escapeHtml(data.title)}</h1>\n\n`;
    }
    
    // Meta
    if (data.meta && Object.keys(data.meta).length > 0) {
        html += `<div class="metadata">\n`;
        html += `  <ul>\n`;
        for (const [k, v] of Object.entries(data.meta)) {
            if (k !== 'title') html += `    <li><strong>${escapeHtml(k)}</strong>: ${escapeHtml(v)}</li>\n`;
        }
        html += `  </ul>\n`;
        html += `</div>\n\n`;
    }
    
    // Shopping List
    if (data.shopping_list && data.shopping_list.length > 0) {
        html += `<div class="shopping-list">\n`;
        html += `  <h2>Shopping List</h2>\n`;
        html += `  <ul>\n`;
        data.shopping_list.forEach(item => {
            if (item.type === 'alternative' || item.type === 'group') {
                html += `    <li>\n`;
                html += `      <strong>Alternative Group</strong>:\n`;
                html += `      <ul>\n`;
                item.options.forEach(opt => {
                    html += `        <li>${formatIngredientHTML(opt, registry)}</li>\n`;
                });
                html += `      </ul>\n`;
                html += `    </li>\n`;
            } else if (item.type === 'composite') {
                html += `    <li>\n`;
                // formatIngredientHTML uses getQty(item) -> item.qty.
                // Composite item has 'qty' property.
                html += `      <strong>${formatIngredientHTML(item, registry)}</strong> (Composite):\n`;
                html += `      <ul>\n`;
                item.usage.forEach(child => {
                    html += `        <li>${formatIngredientHTML(child, registry)}</li>\n`;
                });
                html += `      </ul>\n`;
                html += `    </li>\n`;
            } else if (item.display) {
                html += `    <li>${escapeHtml(item.display)}</li>\n`;
            } else {
                html += `    <li>${formatIngredientHTML(item, registry)}</li>\n`;
            }
        });
        html += `  </ul>\n`;
        html += `</div>\n\n`;
    }
    
    // Cookware
    if (data.cookware && data.cookware.length > 0) {
        html += `<div class="cookware">\n`;
        html += `  <h2>Cookware</h2>\n`;
        html += `  <ul>\n`;
        data.cookware.forEach(cw => {
            if (cw.type === 'alternative' || cw.type === 'group') {
                 html += `    <li>\n`;
                 html += `      <strong>Alternative Group</strong>:\n`;
                 html += `      <ul>\n`;
                 cw.options.forEach(opt => {
                     html += `        <li>${formatCookwareHTML(opt, registry)}</li>\n`;
                 });
                 html += `      </ul>\n`;
                 html += `    </li>\n`;
            } else {
                 html += `    <li>${formatCookwareHTML(cw, registry)}</li>\n`;
            }
        });
        html += `  </ul>\n`;
        html += `</div>\n\n`;
    }
    
    // Instructions
    if (data.sections && data.sections.length > 0) {
        html += `<div class="instructions">\n`;
        data.sections.forEach(sec => {
            html += `  <section>\n`;
            if (sec.title) {
                let titleHtml = escapeHtml(sec.title);
                if (sec.retro_planning) {
                    titleHtml += ` <small style="font-size:0.6em;opacity:0.8;border:1px solid currentColor;border-radius:4px;padding:2px 6px;vertical-align:middle;">⏱ ${escapeHtml(sec.retro_planning)}</small>`;
                }
                html += `    <h3>${titleHtml}</h3>\n`;
            }
            
            // Section Ingredients
            if (sec.ingredients && sec.ingredients.length > 0) {
                html += `    <div class="section-ingredients">\n`;
                html += `      <h4>Ingredients</h4>\n`;
                html += `      <ul>\n`;
                sec.ingredients.forEach(item => {
                    if (item.type === 'alternative' || item.type === 'group') {
                        html += `        <li>\n`;
                        html += `          <strong>Alternative Group</strong>:\n`;
                        html += `          <ul>\n`;
                        item.options.forEach(opt => {
                            html += `            <li>${formatIngredientHTML(opt, registry)}</li>\n`;
                        });
                        html += `          </ul>\n`;
                        html += `        </li>\n`;
                    } else {
                        html += `        <li>${formatIngredientHTML(item, registry)}</li>\n`;
                    }
                });
                html += `      </ul>\n`;
                html += `    </div>\n`;
            }
            
            html += `    <ol class="steps">\n`;
            sec.steps.forEach((step, idx) => {
                if (step.type === 'comment') {
                    // Render differently, maybe as a note?
                    html += `      <li style="list-style: none; margin-left: -1em; color: gray; font-style: italic;">\n`;
                    html += `        ${escapeHtml(step.value)}\n`;
                    html += `      </li>\n`;
                    return;
                }

                html += `      <li>\n`;
                if (step.action) {
                     html += `        <span class="action">[${escapeHtml(step.action)}]</span> `;
                }
                
                let stepContent = '';
                if (step.type === 'text') {
                    stepContent = escapeHtml(step.value);
                } else if (step.type === 'step') {
                     stepContent = step.content.map((c, i, arr) => {
                         let str = '';
                         if (typeof c === 'string') {
                             str = escapeHtml(c);
                         } else if (c.type === 'text') {
                             str = escapeHtml(c.value);
                         } else if (c.type === 'timer') {
                             const q = c.quantity || { value: '' };
                             const qVal = formatQuantityValue(q);
                             str = `<span class="timer" data-value="${q.value}" data-unit="${c.unit || ''}">${qVal}${c.unit ? ' ' + c.unit : ''}</span>`;
                         } else if (c.type === 'temperature') {
                             const q = c.quantity || { value: '' };
                             const qVal = formatQuantityValue(q);
                             str = `<span class="temp" data-value="${q.value}" data-unit="${c.unit || ''}">${qVal}${c.unit ? ' ' + c.unit : ''}</span>`;
                         } else if (c.type === 'reference') {
                             const name = registry.ingredients[c.id]?.name || c.id;
                             let refStr = `<span class="reference">${escapeHtml(name)}`;
                             const qty = getQty(c);
                             if (qty) {
                                  refStr += ` <span class="quantity">${qty.text || qty.value}`;
                                  if (c.unit) refStr += ` <span class="unit">${c.unit}</span>`;
                                  refStr += `</span>`;
                             }
                             refStr += `</span>`;
                             str = refStr;
                         } else if (!c.type && c.id) {
                              if (registry.cookware[c.id]) str = formatCookwareHTML(c, registry);
                              else str = formatIngredientHTML(c, registry);
                         } else if (c.type === 'ingredient') {
                             str = formatIngredientHTML(c, registry);
                         } else if (c.type === 'cookware') {
                             str = formatCookwareHTML(c, registry);
                         } else if (c.type === 'alternative' || c.type === 'group') {
                             str = c.options.map(opt => {
                                 const isCookware = opt.type === 'cookware' || registry.cookware[opt.id];
                                 if (isCookware) return formatCookwareHTML(opt, registry);
                                 return formatIngredientHTML(opt, registry);
                             }).join(' <span class="keyword">or</span> ');
                         } else if (c.type === 'comment') {
                             str = `<!-- ${escapeHtml(c.value.trim())} -->`;
                         }

                         // Spacing Logic
                         const isObject = (typeof c !== 'string' && c.type !== 'text' && c.type !== 'comment');
                         if (isObject) {
                             const next = arr[i+1];
                             if (next) {
                                let nextChar = '';
                                if (typeof next === 'string') nextChar = next[0];
                                else if (next.type === 'text') nextChar = next.value ? next.value[0] : '';
                                
                                // Don't add space if next is glue (punctuation or space)
                                const isGlue = nextChar && /^[.,!?:;)]/.test(nextChar) || (nextChar && /^\s/.test(nextChar));
                                if (!isGlue) {
                                    str += ' ';
                                }
                             }
                         }
                         return str;
                     }).join('');
                }
                html += `        ${stepContent}\n`;
                html += `      </li>\n`;
            });
            html += `    </ol>\n`;
            html += `  </section>\n`;
        });
        html += `</div>\n`;
    }
    
    return html;
}

function renderJsonTree(data) {
    // Controls
    let html = `<div class="json-controls">
        <button id="btn-expand-all" class="tree-btn">Expand All</button>
        <button id="btn-collapse-all" class="tree-btn">Collapse All</button>
    </div>`;
    
    html += `<div class="json-tree">${renderJsonNode(data, null, false)}</div>`;
    return html;
}

function renderJsonNode(item, key = null, addComma = false) {
    const commaHtml = addComma ? `<span class="json-comma">,</span>` : '';
    const keyHtml = key ? `<span class="json-key">"${escapeHtml(key)}"</span>: ` : '';
    
    // Primitives
    if (item === null || typeof item !== 'object') {
        let valHtml = '';
        if (item === null) valHtml = `<span class="json-null">null</span>`;
        if (typeof item === 'boolean') valHtml = `<span class="json-bool">${item}</span>`;
        if (typeof item === 'number') valHtml = `<span class="json-num">${item}</span>`;
        if (typeof item === 'string') valHtml = `<span class="json-str">"${escapeHtml(item)}"</span>`;
        
        // Wrap in a div to maintain line structure (item vs prop)
        const content = `${keyHtml}${valHtml}${commaHtml}`;
        return `<div class="${key ? 'json-prop' : 'json-item'}">${content}</div>`;
    }
    
    // Object or Array
    const isArray = Array.isArray(item);
    const keys = isArray ? item : Object.keys(item);
    const isEmpty = keys.length === 0;
    const openChar = isArray ? '[' : '{';
    const closeChar = isArray ? ']' : '}';
    const typeClass = isArray ? 'json-bracket' : 'json-brace';
    const countText = `${keys.length} items`;
    
    if (isEmpty) {
        return `<div class="${key ? 'json-prop' : 'json-item'}">${keyHtml}<span class="${typeClass}">${openChar}${closeChar}</span>${commaHtml}</div>`;
    }

    let html = `<div class="json-node expanded">`;
    
    // Header Line
    html += `<div class="json-header">`;
    html += `<span class="json-toggle">▼</span>`;
    html += keyHtml;
    html += `<span class="${typeClass}">${openChar}</span>`;
    html += `<span class="json-count">${countText}</span>`;
    html += `</div>`;
    
    // Children
    html += `<div class="json-children">`;
    keys.forEach((k, index) => {
        const child = isArray ? k : item[k];
        const childKey = isArray ? null : k;
        html += renderJsonNode(child, childKey, index < keys.length - 1);
    });
    html += `</div>`;
    
    // Footer (Close)
    // For proper clicking, maybe the closure shouldn't be part of the header, but standard flow.
    // The user wants "},".
    html += `<div class="json-footer"><span class="${typeClass}">${closeChar}</span>${commaHtml}</div>`;
    
    html += `</div>`;
    return html;
}

function escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function formatIngredientHTML(item, registry) {
    // Lookup
    const def = registry.ingredients[item.id];
    const name = def ? def.name : item.id;
    
    let displayName = name;
    if (item.alias) displayName = item.alias;

    let str = `<span class="ingredient" data-name="${escapeHtml(name)}">${escapeHtml(displayName)}`;
    
    const qty = getQty(item);
    
    // Formula Setup
    const formulaStr = item.formula ? `${item.formula.percent}% of ${escapeHtml(item.formula.target)}` : null;
    const isPartial = item.formula && item.formula.is_partial;

    if (isPartial) {
        // Show Formula AS Quantity (with warning)
        str += ` <span class="quantity formula-qty" title="Calculation partial or failed">(${formulaStr} ⚠️)</span>`;
    } else {
        // Normal Quantity
        let qtyContent = '';
        if (qty) {
            qtyContent += qty.text || qty.value;
            if (item.unit) qtyContent += ` <span class="unit">${escapeHtml(item.unit)}</span>`;
        }
        
        // Variable entries support
        if (item.variable_entries && item.variable_entries.length > 0) {
             const vars = item.variable_entries.join(' + ');
             if (qtyContent) qtyContent += ` + ${vars}`;
             else qtyContent = vars;
        }

        if (qtyContent) {
            str += ` <span class="quantity">(${qtyContent})</span>`;
        }

        // Normal Formula indicator
        if (formulaStr) {
             str += ` <span class="formula" title="Base Mass Used: ${item.formula ? item.formula.base_mass_used : ''}g">[${formulaStr}]</span>`;
        }
    }
    
    if (item.preparation) str += ` <span class="prep">(${escapeHtml(item.preparation)})</span>`;
    if (item.modifiers && item.modifiers.includes('optional')) str += ` <span class="opt">(optional)</span>`;
    if (item.modifiers && item.modifiers.includes('reference')) str += ` <span class="ref" title="Reference to existing ingredient">↩️</span>`;
    
    str += `</span>`;
    return str;
}

function formatCookwareHTML(item, registry) {
    const def = registry.cookware[item.id];
    const name = def ? def.name : item.id;
    
    let displayName = name;
    if (item.alias) displayName = item.alias;

    let str = `<span class="cookware" data-name="${escapeHtml(name)}">${escapeHtml(displayName)}`;
    
    const qty = getQty(item);
    if (qty) {
         str += ` <span class="quantity">(${qty.value})</span>`;
    }
    str += `</span>`;
    return str;
}


const highlights = document.getElementById('highlights');

function applyHighlights(text) {
    // Escape HTML first
    let escaped = text.replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;");

    // Simple Tokenizer Loop would be better, but let's try composed Regex for simplicity
    // Order matters! 
    
    // Comments
    escaped = escaped.replace(/(\/\/.*)/g, '<span class="token-comment">$1</span>');
    
    // Frontmatter (naive)
    // Multiline regex in JS for frontmatter
    // We can't easily match mulitline with simple replace if we already escaped lines. 
    // And standard regex replace doesn't handle state.
    
    // Let's do a slightly smarter replacement:
    // Highlight specific syntax chars wherever they appear if not in comment?
    // Comments are already wrapped in span, so we shouldn't match inside them?
    // Regex inside HTML is dangerous. 
    
    // REWRITE: Tokenize properly-ish.
    // Actually, for a simple playground, we can use a sequence of replacements on parts that are NOT tags.
    // But that's hard.
    
    // Let's just highlight specific patterns assuming no overlap or handled by order.
    // Reset to unescaped for processing? No, must render HTML.
    
    // Strategy:
    // 1. Split by newlines.
    // 2. Process each line.
    
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
        // Escape content
        let l = line.replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                    
        // Comments
        if (l.trim().startsWith('//')) {
            return `<span class="token-comment">${l}</span>`;
        }
        
        // Header
        if (l.trim().startsWith('##')) {
             const html = l.replace(/(\{T-.*?\})/, '<span class="token-timer">$1</span>');
             return `<span class="token-header">${html}</span>`;
        }
        
        // Frontmatter separator
        if (l.trim() === '---') {
            return `<span class="token-frontmatter">${l}</span>`;
        }

        // Action [Action Name] at start of line
        // Strict: Start of line (after leading spaces in l, but l is the full line content including spaces here?)
        // The loop splits by \n, so l is the line.
        // We match ` [Action]` or `[Action]`.
        l = l.replace(/^(\s*)(\[)([^\]]+)(\])/, '$1<span class="token-action">$2$3$4</span>');

        // Ingredients / Cookware / etc
        // @name{qty%unit}
        // #name{...}
        // ~timer{...}
        // !temp{...}
        
        // Highlighting Ingredients / Cookware / etc
        
        // Regex explaining:
        // 1. ([@#~!]) -> Type start
        // 2. ((?:\[.*?\]|[^\{\}\[\]\(\)<>\|@#~!&\?\*\n])*) -> Name (and modifiers? modifiers are ?, -, *, &).
        //    Modifiers are allowed before name. Modifiers are ? - * &.
        //    So name group actually captures modifiers + name.
        //    We exclude syntax chars but modifiers are syntax chars! 
        //    Wait, modifiers are ?, -, *, &.
        //    If I exclude & from name regex, I exclude modifer?
        //    Yes. Name definition in grammar: `(~(syntaxChar | nl) any)+`.
        //    `syntaxChar` INCLUDES `&`, `?`, `*`.
        //    So strict parser says name cannot contain `&`.
        //    Structure: @ [Modifiers] Name ...
        //    The string between @ and { contains modifiers + name.
        //    The grammar separates them.
        //    Here in regex we capture "everything between @ and {".
        //    So we should allow modifiers in the capture group.
        //    We should exclude syntax chars that START other things or delimiters.
        //    Delimiters: { (start qty), [ (start alias), < (composite).
        //    Start new element: @ # ~ !
        //    Others: | (alternative), ( (prep).
        //    So we should exclude: { [ < | ( @ # ~ ! 
        //    And maybe ) } ] > for safety.
        //    We should NOT exclude ?, -, *, & because they are modifiers.
        
        // Regex explaining:
        // 1. (-&gt;&amp;|[@#~!&]) -> Type start. Must handle escaped ->& which is -&gt;&amp;
        // 2. ((?:\[.*?\]|[^\{\[\<\(\|\@\#\~\!\n])*) -> Name
        
        l = l.replace(/(-&gt;&amp;|[@#~!&])((?:\[.*?\]|[^\{\[\<\(\|\@\#\~\!\n])*)(\{.*?\})?/g, (match, type, name, qty) => {
             // Filter false positives for '!' (punctuation)
             if (type === '!' && !qty && (!name || !name.trim().match(/[a-zA-Z0-9]/))) {
                 return match; 
             }
             
             // Handle escaped entities and references
             let displayType = type;
             let displayName = name;
             
             if (type === '&') {
                 // Check if it's a pure entity literal like &lt; &gt; &amp;
                 if (name === 'lt;' || name === 'gt;' || name === 'amp;') {
                     return match;
                 }
                 // Check if it is a reference that got double-escaped prefix &amp;name
                 if (name.startsWith('amp;')) {
                     displayName = name.slice(4); // Remove amp;
                     // It is a reference &name
                 } 
             }
             
             if (type === '-&gt;&amp;') {
                 displayType = '->&';
             }

             let cls = 'token-ingredient';
             if (type === '#') cls = 'token-cookware';
             if (type === '~') cls = 'token-timer';
             if (type === '!') cls = 'token-temp';
             if (type === '&' || type === '-&gt;&amp;') cls = 'token-decl'; 
             
             // Wrap parts
             const symbolHtml = `<span class="${cls}">${displayType}</span>`;
             const nameHtml = `<span class="${cls}">${displayName}</span>`;
             
             let qtyHtml = '';
             if (qty) {
                 qtyHtml = `<span class="${cls}">${qty}</span>`; 
                 qtyHtml = qtyHtml.replace(/(\d+(?:\.\d+)?)/g, '<span class="token-qty">$1</span>');
                 qtyHtml = qtyHtml.replace(/(%)([\w°]+)/g, '<span class="token-syntax">$1</span><span class="token-unit">$2</span>');
             }
             
             return `${symbolHtml}${nameHtml}${qtyHtml}`;
        });
        
        return l;
    });
    
    return processedLines.join('\n') + '<br>'; // trailing newlines need br or they disappear
}


function handleInput() {
    const text = input.value;
    highlights.innerHTML = applyHighlights(text);
    update();
}

function handleScroll() {
    highlights.scrollTop = input.scrollTop;
    highlights.scrollLeft = input.scrollLeft;
}

// Event Listeners

// 1. Sync Scroll
input.addEventListener('scroll', handleScroll);

// 2. Highlight (Immediate)
input.addEventListener('input', () => {
    highlights.innerHTML = applyHighlights(input.value);
});

// 3. Parse (Debounced)
const debouncedParse = debounce(update, 300);
input.addEventListener('input', debouncedParse);

// Initial state
highlights.innerHTML = applyHighlights(input.value);
update();

function showWarnings(warnings) {
    if (!warningsArea) return;
    warningsArea.style.display = 'block';
    
    // Group warnings?
    // Structure: { code, message, item }
    
    let html = '<div style="color: #ef4444; font-weight: bold; margin-bottom: 0.5rem;">⚠️ Compiler Warnings</div>';
    html += '<ul style="margin: 0; padding-left: 1.5rem; color: #ef4444;">';
    
    warnings.forEach(w => {
        html += `<li>[${w.code}] ${w.message}</li>`;
    });
    
    html += '</ul>';
    warningsArea.innerHTML = html;
}

function hideWarnings() {
    if (warningsArea) warningsArea.style.display = 'none';
}
const copyBtn = document.getElementById('copy-btn');

copyBtn.addEventListener('click', () => {
    const textToCopy = output.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
        // Visual feedback
        const originalIcon = copyBtn.innerHTML;
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,55.51a8,8,0,0,0-11.32,0L102.5,171.34,49.66,118.51a8,8,0,0,0-11.32,11.32l58.5,58.5a8,8,0,0,0,11.32,0L229.66,66.83A8,8,0,0,0,229.66,55.51Z"></path></svg>`;
        copyBtn.style.color = 'var(--token-def)'; // Use our green token color
        
        setTimeout(() => {
            copyBtn.innerHTML = originalIcon;
            copyBtn.style.color = ''; // Reset color
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
});
// Examples Logic
const examplesSelect = document.getElementById('examples-select');

const EXAMPLES = {
    pancakes: 'examples/pancakes.gram',
    spaghetti: 'examples/spaghetti.gram',
    torture: 'examples/torture.gram'
};

if (examplesSelect) {
    examplesSelect.addEventListener('change', (e) => {
        const key = e.target.value;
        if (EXAMPLES[key]) {
             fetch(EXAMPLES[key])
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    return res.text();
                })
                .then(text => {
                    input.value = text;
                    handleInput();
                })
                .catch(e => {
                    console.error('Could not load example:', e);
                    alert('Error loading example file.');
                });
        }
        // Reset selection so you can select the same one again if you modified it
        e.target.value = ""; 
    });
}
