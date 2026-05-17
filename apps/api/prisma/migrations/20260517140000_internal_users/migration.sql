CREATE TABLE "InternalUser" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'support',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalUser_email_key" ON "InternalUser"("email");
CREATE INDEX "InternalUser_status_idx" ON "InternalUser"("status");
CREATE INDEX "InternalUser_role_idx" ON "InternalUser"("role");

INSERT INTO "InternalUser" ("id", "label", "role", "status", "updatedAt")
VALUES
  ('ops-nabil', 'Nabil', 'admin', 'active', CURRENT_TIMESTAMP),
  ('ops-support', 'Support', 'support', 'active', CURRENT_TIMESTAMP),
  ('ops-sales', 'Sales', 'sales', 'active', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
