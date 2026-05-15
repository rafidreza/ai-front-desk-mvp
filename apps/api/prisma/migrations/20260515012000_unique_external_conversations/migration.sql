DROP INDEX IF EXISTS "Conversation_channel_externalConversationId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_clientId_channel_externalConversationId_key"
  ON "Conversation"("clientId", "channel", "externalConversationId");
