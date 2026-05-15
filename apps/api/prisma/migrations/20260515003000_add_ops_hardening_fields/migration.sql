-- Add manual QA fields to conversation records.
ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "qaGrade" TEXT,
  ADD COLUMN IF NOT EXISTS "hallucinationFlag" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "gradedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "gradedAt" TIMESTAMP(3);

-- Add internal ownership to tickets.
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;

CREATE INDEX IF NOT EXISTS "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");

-- Add internal operator comments.
CREATE TABLE IF NOT EXISTS "TicketComment" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TicketComment_ticketId_fkey'
  ) THEN
    ALTER TABLE "TicketComment"
      ADD CONSTRAINT "TicketComment_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
