-- CreateTable
CREATE TABLE IF NOT EXISTS public.line_groups (
    id BIGSERIAL PRIMARY KEY,
    group_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    picture_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (if active, but since system runs under postgres schema/role, standard defaults are fine)
ALTER TABLE public.line_groups ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all actions for service role / authenticated admins
CREATE POLICY "Allow authenticated/admin users full access to line_groups"
    ON public.line_groups FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
