do $$
declare
  updated_rows integer;
begin
  update public.preorder_sales_controls
     set sales_status = 'paused',
         unit_limit = 100,
         updated_by = 'launch-plan:initial-100-units',
         updated_at = now()
   where environment = 'live'
     and inventory_limit = 1000;

  get diagnostics updated_rows = row_count;
  if updated_rows <> 1 then
    raise exception
      'Expected one live pre-order control with a 1,000-unit inventory ceiling; updated % rows',
      updated_rows;
  end if;
end
$$;

comment on column public.preorder_sales_controls.unit_limit is
  'Cumulative unit ceiling released for sale. The initial live batch is 100 units; later batches may increase this value up to inventory_limit.';
