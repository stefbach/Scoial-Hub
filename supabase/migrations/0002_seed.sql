-- ============================================================
-- Social Hub — seed de démonstration (DDS Group)
-- Idempotent : toutes les insertions utilisent ON CONFLICT DO NOTHING
-- ============================================================

-- ── Organisation ────────────────────────────────────────────
INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'DDS Group')
ON CONFLICT (id) DO NOTHING;

-- ── Marques (companies) ─────────────────────────────────────
INSERT INTO companies (id, org_id, code, name, brand_voice, accent, default_platforms, default_posting_time, default_needs_review)
VALUES
  (
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'OCC',
    'Obesity Care Clinic',
    'warm, professional, evidence-based',
    '#2563eb',
    ARRAY['facebook','instagram'],
    '09:00',
    false
  ),
  (
    '00000000-0000-0000-0001-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'TI',
    'Tibok',
    'friendly, modern, accessible',
    '#d62976',
    ARRAY['facebook','instagram'],
    '10:00',
    false
  ),
  (
    '00000000-0000-0000-0001-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'CV',
    'Cabo Verde Medical International',
    'authoritative, international, medical',
    '#16a34a',
    ARRAY['facebook'],
    '12:00',
    false
  )
ON CONFLICT (id) DO NOTHING;

-- ── Réglages ad_safety par défaut ───────────────────────────
INSERT INTO ad_safety (company_id, monthly_cap, used_this_month, require_budget_cap, confirm_ai_spend, double_confirm_threshold, daily_digest)
VALUES
  ('00000000-0000-0000-0001-000000000001', 5000, 0, true, true, 500, true),
  ('00000000-0000-0000-0001-000000000002', 4000, 0, true, true, 400, true),
  ('00000000-0000-0000-0001-000000000003', 3000, 0, true, true, 500, false)
ON CONFLICT (company_id) DO NOTHING;

-- ── Connexions vides par défaut ──────────────────────────────
INSERT INTO connections (company_id, meta, linkedin)
VALUES
  ('00000000-0000-0000-0001-000000000001', '{"connected": false}'::jsonb, '{"connected": false}'::jsonb),
  ('00000000-0000-0000-0001-000000000002', '{"connected": false}'::jsonb, '{"connected": false}'::jsonb),
  ('00000000-0000-0000-0001-000000000003', '{"connected": false}'::jsonb, '{"connected": false}'::jsonb)
ON CONFLICT (company_id) DO NOTHING;
