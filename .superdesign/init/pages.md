# Key Page Dependency Trees

## /daily/weight-ticket-list
Entry: `apps/next/src/app/daily/weight-ticket-list/page.tsx`
Dependencies:
- `apps/next/src/components/daily/WeightTicketListPageClient.tsx`
  - `apps/next/src/components/daily/WeightTicketDetailModal.tsx`
  - `apps/next/src/components/daily/WeightTicketStockReturnDialog.tsx`
  - `apps/next/src/components/daily/WeightTicketsPageClient.tsx`
  - `apps/next/src/components/daily/weight-ticket-table-layout.ts`
  - shared Button, Card, Input, BranchSelectCombobox, DatePickerInput, Dialog, MobileFilterSheet, PageSizeDropdown, ResizableTableHead, Tabs
- `apps/next/src/components/layout/AppShell.tsx`
  - AppNavigation, MobileBottomNavigation, ThemeModeToggle

## /daily/weight-tickets?type=WTI|WTO
Entry: `apps/next/src/app/daily/weight-tickets/page.tsx`
Dependencies:
- `apps/next/src/components/daily/WeightTicketsPageClient.tsx`
  - `apps/next/src/components/daily/WeightTicketWtiForm.tsx`
  - `apps/next/src/components/daily/WeightTicketWtoForm.tsx`
  - `apps/next/src/components/daily/WeightTicketFormCore.tsx`
    - `apps/next/src/components/daily/WeightTicketTypeFormSections.tsx`
    - `apps/next/src/components/daily/WeightTicketAttachmentGrid.tsx`
    - shared Button, Card, Input, BranchSelectCombobox, SearchCombobox, Combobox, Dialog
- `apps/next/src/components/layout/AppShell.tsx`
  - AppNavigation, MobileBottomNavigation, ThemeModeToggle
