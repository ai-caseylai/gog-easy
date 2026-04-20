CREATE OR REPLACE FUNCTION public.increment_otp_attempts(otp_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.phone_otps
  SET attempts = attempts + 1
  WHERE id = otp_id;
$$;

