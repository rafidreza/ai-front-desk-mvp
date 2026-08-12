-- Seed a test client for the agent↔backend loop. Idempotent. Run AFTER _apply_all.sql.
-- CLIENT_ID for the voice agent = 'pilot-abc'.

INSERT INTO "Client" (id, "businessName", "pageId", "defaultLanguage", tone, "escalationKeywords", "createdAt", "updatedAt")
VALUES ('pilot-abc', 'ABC Telecom', 'pilot-abc-page', 'bn', 'friendly', ARRAY['refund','complaint','cancel'], now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "KnowledgeEntry" (id, "clientId", title, answer, keywords, "createdAt", "updatedAt")
VALUES
  ('kb-abc-1','pilot-abc','Plans','500 Mbps for 1500 taka per month; 1 Gbps for 2500 taka per month.',ARRAY['plan','price','mbps'],now(),now()),
  ('kb-abc-2','pilot-abc','Installation','Installation is free this month.',ARRAY['install','installation','free'],now(),now()),
  ('kb-abc-3','pilot-abc','Coverage','Service is available in Dhaka and Chittagong city areas.',ARRAY['coverage','area','available'],now(),now()),
  ('kb-abc-4','pilot-abc','Support hours','Support is open 9am to 9pm, 7 days a week.',ARRAY['support','hours','time'],now(),now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "ClientVoiceConfig" (id, "clientId", config, "updatedAt")
VALUES ('vcfg-abc','pilot-abc','{"languagePosture":"bn-first","greeting":"Assalamu alaikum, ABC Telecom e call korar jonno dhonnobad. Ki bhabe help korte pari?"}'::jsonb,now())
ON CONFLICT ("clientId") DO NOTHING;
