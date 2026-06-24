-- AlterTable: Add routing and active fields to line_groups
ALTER TABLE public.line_groups ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE public.line_groups ADD COLUMN IF NOT EXISTS notify_wti BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.line_groups ADD COLUMN IF NOT EXISTS notify_wto BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.line_groups ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Migrate config values from old system_settings key
DO $$
DECLARE
  old_auto_send_val text;
  default_target_val text;
BEGIN
  SELECT value INTO old_auto_send_val FROM public.system_settings WHERE key = 'LINE_AUTO_SEND';
  IF old_auto_send_val IS NOT NULL THEN
    INSERT INTO public.system_settings (key, description, value) VALUES
      ('LINE_AUTO_SEND_WTI', 'Enable automatic LINE notifications on WTI weight ticket creation', old_auto_send_val),
      ('LINE_AUTO_SEND_WTO', 'Enable automatic LINE notifications on WTO weight ticket creation', old_auto_send_val)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  ELSE
    INSERT INTO public.system_settings (key, description, value) VALUES
      ('LINE_AUTO_SEND_WTI', 'Enable automatic LINE notifications on WTI weight ticket creation', 'false'),
      ('LINE_AUTO_SEND_WTO', 'Enable automatic LINE notifications on WTO weight ticket creation', 'false')
    ON CONFLICT (key) DO NOTHING;
  END IF;

  -- If default target exists, set its config in line_groups if it matches
  SELECT value INTO default_target_val FROM public.system_settings WHERE key = 'LINE_DEFAULT_TARGET_ID';
  IF default_target_val IS NOT NULL THEN
    UPDATE public.line_groups
    SET is_active = true, notify_wti = true, notify_wto = true
    WHERE group_id = default_target_val;
  END IF;
END $$;
