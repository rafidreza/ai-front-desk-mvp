DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketPriority') THEN
    CREATE TYPE "TicketPriority" AS ENUM ('P1', 'P2', 'P3');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketStatus') THEN
    CREATE TYPE "TicketStatus" AS ENUM ('open', 'assigned', 'waiting_client', 'resolved');
  END IF;
END $$;

ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Ticket"
  ALTER COLUMN "priority" TYPE "TicketPriority" USING "priority"::"TicketPriority",
  ALTER COLUMN "status" TYPE "TicketStatus" USING "status"::"TicketStatus";
