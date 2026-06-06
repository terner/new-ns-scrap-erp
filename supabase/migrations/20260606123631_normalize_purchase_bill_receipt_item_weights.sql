update public.purchase_bill_items pbi
set
  gross_weight = pbra.allocated_gross_weight,
  deduct_weight = pbra.allocated_deduct_weight,
  qty = pbra.allocated_qty,
  source_snapshot = case
    when pbi.source_snapshot is null or jsonb_typeof(pbi.source_snapshot) <> 'object' then pbi.source_snapshot
    else jsonb_set(
      jsonb_set(
        jsonb_set(pbi.source_snapshot, '{grossWeight}', to_jsonb(pbra.allocated_gross_weight), true),
        '{deductWeight}', to_jsonb(pbra.allocated_deduct_weight), true
      ),
      '{qty}', to_jsonb(pbra.allocated_qty), true
    )
  end,
  updated_at = now()
from public.purchase_bill_receipt_allocations pbra
where pbra.purchase_bill_item_id = pbi.id
  and (
    abs(coalesce(pbi.gross_weight, 0) - coalesce(pbra.allocated_gross_weight, 0)) > 0.0001
    or abs(coalesce(pbi.deduct_weight, 0) - coalesce(pbra.allocated_deduct_weight, 0)) > 0.0001
    or abs(coalesce(pbi.qty, 0) - coalesce(pbra.allocated_qty, 0)) > 0.0001
  );
