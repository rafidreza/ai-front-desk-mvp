ALTER TABLE "InternalUser"
  ADD COLUMN "passwordHash" TEXT;

UPDATE "InternalUser"
SET "role" = 'operator'
WHERE "role" IN ('support', 'sales', 'qa');

UPDATE "InternalUser"
SET "role" = 'read-only'
WHERE "role" = 'viewer';
