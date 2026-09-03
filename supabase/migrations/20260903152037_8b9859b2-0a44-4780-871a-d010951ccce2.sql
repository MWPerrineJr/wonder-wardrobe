ALTER TABLE public.owner_signups
  ADD COLUMN heard_about text,
  ADD COLUMN heard_about_detail text;

ALTER TABLE public.owner_signups
  ADD CONSTRAINT owner_signups_heard_about_check CHECK (
    heard_about IS NULL OR heard_about IN (
      'linkedin','instagram','facebook','tiktok','google','referral','other'
    )
  );