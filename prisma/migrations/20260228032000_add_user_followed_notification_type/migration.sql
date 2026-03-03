DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'USER_FOLLOWED'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'USER_FOLLOWED';
  END IF;
END$$;
