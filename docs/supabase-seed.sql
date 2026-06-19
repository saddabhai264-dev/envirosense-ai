insert into public.public_reports (
  reporter_name,
  phone,
  city,
  location_text,
  latitude,
  longitude,
  report_type,
  severity,
  description,
  affected_families,
  status
) values
  (
    null,
    null,
    'Dadu',
    'Union Council 6',
    26.7329,
    67.7763,
    'Flooding',
    'Emergency',
    'Standing water reported near low-lying houses.',
    34,
    'New'
  ),
  (
    null,
    null,
    'Hyderabad',
    'Latifabad',
    25.396,
    68.3578,
    'Drainage overflow',
    'High',
    'Drainage line overflow after rain.',
    12,
    'Verified'
  ),
  (
    null,
    null,
    'Badin',
    'Ward 3',
    24.6558,
    68.8383,
    'Unsafe drinking water',
    'High',
    'Residents report odor and cloudy drinking water.',
    18,
    'In progress'
  )
on conflict do nothing;

insert into public.water_tests (
  city,
  location_text,
  latitude,
  longitude,
  ph,
  tds,
  turbidity,
  residual_chlorine,
  e_coli_detected,
  arsenic,
  nitrate,
  temperature,
  result,
  recommendation
) values
  (
    'Hyderabad',
    'Latifabad',
    25.396,
    68.3578,
    7.40,
    420,
    2.10,
    0.300,
    false,
    0.0040,
    18,
    27,
    'Safe to drink',
    'Continue routine monitoring.'
  ),
  (
    'Badin',
    'Ward 3',
    24.6558,
    68.8383,
    6.80,
    920,
    6.40,
    0.050,
    true,
    0.0120,
    42,
    29,
    'Unsafe to drink',
    'Do not drink without confirmed treatment and retesting.'
  )
on conflict do nothing;

insert into public.web_alerts (
  city,
  title,
  message,
  level,
  status,
  published_at
) values
  (
    'Dadu',
    'Critical flood watch',
    'Field teams should monitor low-lying areas.',
    'Critical',
    'Active',
    now()
  ),
  (
    'Hyderabad',
    'Drainage overflow risk',
    'Public reports increasing in Latifabad.',
    'High',
    'Active',
    now()
  )
on conflict do nothing;
