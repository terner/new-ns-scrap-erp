-- Convert existing OD accounts to Current accounts
UPDATE public.accounts
SET subtype = 'current'
WHERE subtype = 'od';
