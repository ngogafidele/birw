# UI Tokens

BIRW Inventory uses Tailwind CSS 4 tokens declared in `app/globals.css`. The app also imports `tw-animate-css` and `shadcn/tailwind.css`.

---

## Theme Source

All core colors and radii are CSS variables in `:root` and mapped into Tailwind utilities through `@theme inline`.

```css
:root {
  --background: #f6faf6;
  --foreground: #102017;
  --card: #ffffff;
  --card-foreground: #102017;
  --popover: #ffffff;
  --popover-foreground: #102017;
  --primary: #126a35;
  --primary-foreground: #ffffff;
  --secondary: #eaf4ef;
  --secondary-foreground: #075b78;
  --muted: #eef6ef;
  --muted-foreground: #55665b;
  --accent: #c99a18;
  --accent-foreground: #102017;
  --border: #d3e3d7;
  --input: #bfd5c6;
  --ring: #0b7da6;
  --chart-1: #126a35;
  --chart-2: #c99a18;
  --chart-3: #0b7da6;
  --chart-4: #56665d;
  --chart-5: #78a22f;
  --radius: 0.8rem;
}
```

Tailwind token classes include:

- `bg-background`, `text-foreground`
- `bg-card`, `text-card-foreground`
- `bg-primary`, `text-primary-foreground`
- `bg-secondary`, `text-secondary-foreground`
- `bg-muted`, `text-muted-foreground`
- `bg-accent`, `text-accent-foreground`
- `border-border`, `ring-ring`

---

## Brand Palette

| Purpose | Token | Value |
| --- | --- | --- |
| Page background | `--background` | `#f6faf6` |
| Text | `--foreground` | `#102017` |
| Main surface | `--card` | `#ffffff` |
| Primary green | `--primary` | `#126a35` |
| Blue accent/ring | `--ring` | `#0b7da6` |
| Gold accent | `--accent` | `#c99a18` |
| Muted surface | `--muted` | `#eef6ef` |
| Muted text | `--muted-foreground` | `#55665b` |
| Border | `--border` | `#d3e3d7` |

The public login and setup screens use `.brand-auth-surface`, a scoped light-only treatment derived from the BIRW logo. Auth-specific variables include `--brand-green`, `--brand-green-deep`, `--brand-blue`, `--brand-blue-deep`, `--brand-gold`, and `--brand-charcoal`. The tuned palette uses forest green for identity and primary actions, teal-blue for secondary operational accents, antique gold for restrained highlights, and soft green-tinted neutrals for modern surfaces.

---

## Layout Tokens

| Element | Current Pattern |
| --- | --- |
| Authenticated max width | `max-w-[92rem]` |
| Header | sticky, `bg-card/90`, `border-b border-border/80`, `backdrop-blur` |
| Sidebar | `w-full`, `md:w-60`, `rounded-2xl`, `bg-sidebar/90` |
| Main panel | `rounded-2xl border border-border/80 bg-card/95 p-2 sm:p-3 lg:p-4` |
| Operational cards | `rounded-2xl border border-border bg-card p-4 sm:p-5` |
| Dialogs | Local `DialogContent` primitive, token-based border/surface |

---

## Typography

| Element | Pattern |
| --- | --- |
| App title | `text-xl font-semibold sm:text-2xl` |
| Page title | `text-2xl font-semibold` |
| Section heading | `text-lg font-semibold` |
| Eyebrow labels | `text-xs uppercase tracking-[0.18em]` or `tracking-[0.2em]` |
| Form labels | `grid gap-1 text-sm` |
| Muted helper text | `text-sm text-muted-foreground` or `text-xs text-muted-foreground` |
| Table body | `text-sm` from table primitive |

---

## Component Tokens

### Buttons

Use `components/ui/button.tsx`.

- Default: `bg-primary text-primary-foreground`
- Outline: `border-border bg-background hover:bg-muted`
- Secondary: `bg-secondary text-secondary-foreground`
- Destructive: `bg-destructive/10 text-destructive`
- Default height: `h-8`, rounded `rounded-lg`, `text-sm font-medium`

### Inputs

Use `components/ui/input.tsx`.

- Token border and focus ring
- Standard height in forms is commonly `h-8` through the primitive, with explicit `h-11` on login fields

### Tables

Use `components/ui/table.tsx`.

- Wrapper: `overflow-x-auto`
- Rows: `border-b transition-colors hover:bg-muted/50`
- Headers: `h-10 px-2 text-left font-medium text-foreground`
- Cells: `p-2 whitespace-nowrap`
- Feature managers often add alternating rows with `bg-muted/60 hover:bg-muted/70`

### Status Badges

Existing app code uses tokenized colors plus a few semantic Tailwind palettes:

- Paid: emerald tint
- Unpaid/loans: amber tint
- Low stock: red tint
- Below cost: amber or destructive tint
- Admin/destructive actions: destructive variant

Prefer existing badge patterns before adding a new palette.

---

## Rules

- Prefer token utilities (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`) over raw color classes.
- Existing report cards use semantic palette classes for financial states; keep additions consistent with their current usage.
- Use `lucide-react` icons in buttons and navigation.
- Keep operational layouts dense and scannable.
- Do not introduce unrelated landing-page visual language into authenticated operations.
