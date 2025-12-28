# Timers (~) and Temperatures (!)

GRAM normalizes time and heat to allow conversions and interactive displays.

## Timers

Trigger: `~`

### Syntax
`~{valueUnit}`

*   **Unit Mandatory.** No fuzzy text.
*   **Supported Units:**
    *   `min`, `m` (minutes) -> Normalized to `min`.
    *   `h` (hours).
    *   `d` (days).
    *   `s` (seconds).

### Examples
*   `~{30min}`
*   `~{1h}`
*   `~{3-4min}` (Time range)

### Named Timer
You can name the timer for the UI (e.g., multiple simultaneous cookings).
The name goes between `~` and the brace.

```gram
Cook eggs ~eggs{3min} and pasta ~pasta{9min}.
```

---

## Temperatures

Trigger: `!`

### Syntax
`!{valueUnit}`

*   **Unit Mandatory.**
*   **Supported Units:**
    *   `°C` (Celsius).
    *   `°F` (Fahrenheit).

### Examples
*   `!{180°C}`
*   `!{350°F}`

### Named Temperature
Like timers.
```gram
Preheat the !oven{180°C}.
```

## Best Practices

1.  **Be numeric.** Avoid `~{about 10 minutes}`. Prefer `~{10min}` and add "about" in the surrounding text.
2.  **Ranges.** Use hyphens for uncertainties: `~{15-20min}`.
3.  **Conversions.** The parser does not convert values (C -> F) in the code; it is up to the display engine ("front-end") to offer conversion if the user requests it. GRAM stores the exact raw value.
