# AGENTS.md

## Purpose
This file defines page-building rules for this project so outputs stay intentional, consistent, and production-ready instead of generic template clones.

## 1) Design Principles (Avoid Generic Template Look)
- Design with a clear visual concept before writing markup (editorial, brutalist, premium, playful, etc.).
- Use one deliberate focal idea per section (hero statement, visual motif, or interaction), not equal-weight blocks everywhere.
- Avoid default-looking combinations:
  - no stock "headline + paragraph + button + 3 cards" repetition without variation
  - no random gradients or shadows without a defined art direction
  - no copy-paste section structures across the full page
- Prefer asymmetry with control: varied column spans, media sizes, and pacing while keeping alignment intentional.
- Use color with purpose:
  - define semantic tokens (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--border`)
  - maintain strong contrast and consistent token usage
- Motion is functional:
  - subtle entrance/stagger transitions only where they improve comprehension
  - avoid decorative motion overload

## 2) Typography Hierarchy Rules
- Limit to 2 font families maximum (display + body, or single family with clear weight/size contrast).
- Establish a predictable scale and use it consistently.
- Required text roles:
  - Display: page-defining message (hero)
  - H1: primary section headline (only once per page)
  - H2: section titles
  - H3: sub-section/card titles
  - Body-L: lead paragraph
  - Body: default paragraph
  - Caption/Meta: supportive labels and metadata
- Line-length targets:
  - body text: ~45-75 characters per line
  - dense UI text: keep compact and scannable
- Line-height guidance:
  - headings: tighter (about 1.1-1.25)
  - paragraphs: readable (about 1.5-1.7)
- Do not style by arbitrary one-off values. Map all type to named tokens/classes.

## 3) Spacing System (8px Scale)
- Use an 8px base scale for spacing, sizing, and rhythm.
- Canonical spacing steps: 4, 8, 16, 24, 32, 40, 48, 64, 80, 96, 128.
- Apply consistently to:
  - section padding
  - grid gaps
  - component internal padding
  - vertical stack spacing
- Avoid off-scale values unless required for a deliberate visual correction.
- Keep vertical rhythm explicit:
  - define section top/bottom padding from scale
  - define internal stack gap from scale
  - define element-to-element spacing from scale

## 4) Max Width and Layout Rhythm
- Use a consistent content container and rhythm:
  - max content width: 1200px (default)
  - optional narrow reading width: 680-760px for long-form text
  - side padding: 16px (mobile), 24px (tablet), 32px (desktop+)
- Build with a responsive grid:
  - mobile: 4 columns
  - tablet: 8 columns
  - desktop: 12 columns
- Keep section cadence intentional:
  - alternate dense and breathable sections
  - avoid equal-height/equal-density sections from top to bottom
- Align key baselines and edges between adjacent sections to maintain flow.

## 5) Section-by-Section Workflow (Never Generate Whole Page at Once)
- Never generate the entire page in one pass.
- Required workflow:
  1. Define global direction:
     - visual style, color tokens, type scale, spacing scale, grid/container rules
  2. Implement one section at a time in this order:
     - Header/Nav
     - Hero
     - Social proof / Logos (if needed)
     - Features / Value props
     - Detail block(s)
     - Testimonials / Case studies
     - Pricing / Plans (if needed)
     - FAQ (if needed)
     - Footer
  3. After each section:
     - run Definition of Done checks before moving to next section
  4. After all sections pass:
     - run full-page consistency pass (tokens, spacing, interactions, accessibility)

## 6) Definition of Done (Per Section)
Each section is only complete when all checks pass.

### Responsive
- Works at common breakpoints (mobile, tablet, desktop, wide desktop).
- No overflow, collisions, unreadable text, or broken alignment.
- Touch targets are usable on mobile.

### Accessibility
- Semantic structure is correct (landmarks, heading order, list semantics where needed).
- Keyboard access works for all interactive elements.
- Visible focus styles exist and meet contrast expectations.
- Text/background contrast is sufficient (WCAG AA target).
- Images/icons have appropriate accessible names (`alt`, labels, or `aria-hidden` when decorative).

### Consistency
- Uses project design tokens (color, type, spacing, radius, shadow, motion).
- Spacing adheres to 8px scale.
- Typography matches defined hierarchy roles.
- Component patterns match previously implemented sections unless a deliberate variant is documented.
- Interaction states are complete (`default`, `hover`, `focus`, `active`, `disabled` when applicable).

## 7) Implementation Guardrails
- Prefer reusable section/component primitives over one-off custom blocks.
- Keep CSS architecture token-first (variables/custom properties first, component styles second).
- Do not introduce new visual tokens mid-page without updating the global direction.
- If a section fails DoD, fix it before generating the next section.
