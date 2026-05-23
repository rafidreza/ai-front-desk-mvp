CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_clientId_name_key" ON "Tag"("clientId", "name");
CREATE INDEX "Tag_clientId_idx" ON "Tag"("clientId");

ALTER TABLE "Tag"
    ADD CONSTRAINT "Tag_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TicketTag" (
    "ticketId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTag_pkey" PRIMARY KEY ("ticketId", "tagId")
);

CREATE INDEX "TicketTag_tagId_idx" ON "TicketTag"("tagId");

ALTER TABLE "TicketTag"
    ADD CONSTRAINT "TicketTag_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketTag"
    ADD CONSTRAINT "TicketTag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
