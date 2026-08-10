do $$
declare
  preorder_sequence regclass := pg_get_serial_sequence(
    'public.preorders',
    'order_number'
  )::regclass;
  sequence_last_value bigint;
  highest_order_number bigint;
begin
  execute format('select last_value from %s', preorder_sequence)
    into sequence_last_value;

  select max(order_number)
    into highest_order_number
    from public.preorders;

  perform setval(
    preorder_sequence,
    greatest(
      9,
      coalesce(sequence_last_value, 0),
      coalesce(highest_order_number, 0)
    ),
    true
  );
end;
$$;

comment on column public.preorders.order_number is
  'Customer-facing pre-order sequence. The first generated number is at least 10.';
