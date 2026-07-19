# NS Scrap ERP Design System

## Product Context
Operational Thai ERP for repeated daily work. WTI is receipt evidence before Purchase Bill; WTO is delivery evidence and creates pending-out only when confirmed. Users scan lists quickly, then enter one or more products with scale lots, deductions, evidence images, and clear totals.

## Visual Direction
- Quiet, dense, work-focused interface; no marketing composition.
- Sarabun for Thai UI, tabular figures for weights and financial values.
- Workspace background slate-50 in light mode; white section surfaces; slate-900 navigation; tokenized dark mode.
- Controls use rounded-md; section cards may use rounded-xl. Avoid card-in-card decoration.
- Use borders only where they clarify field or section boundaries; prefer surface contrast for hierarchy.
- Standard editable controls are h-10 in forms and h-9 in filters.
- Focus uses neutral #737373 border with a 3px translucent ring while retaining the existing field background.

## WTI/WTO Interaction Contracts
- List: WTI/WTO tabs, one canonical two-row filter card, summary and pagination above the table, row click opens detail, actions remain visible without masking data.
- Form: branch must precede supplier/customer; WTO also requires warehouse per product line. Godown is header free text and is distinct from warehouse.
- Product must be selected before scale-lot weight and evidence controls are enabled.
- Weight terms are Thai: น้ำหนักรวม, หักภาชนะ, หักสิ่งเจือปน, น้ำหนักสุทธิ.
- WTI and WTO share composition, but use separate labels, statuses, and stock behavior.
- Preserve all validation, image evidence, lot collapse, impurity, summary, and save actions.

## Responsive
Desktop prioritizes a wide scanning table and a two-pane product form. Mobile uses cards/filter sheet and keeps primary save/create actions reachable. Stable dimensions and horizontal overflow are preferred over wrapping headers or compressing controls below usable size.
