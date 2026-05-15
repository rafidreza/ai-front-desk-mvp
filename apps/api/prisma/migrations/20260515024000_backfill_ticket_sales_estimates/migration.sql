UPDATE "Ticket"
SET "salesRecoveredEstimate" = CASE
  WHEN "priority" = 'P1' THEN 2500
  WHEN "priority" = 'P2' THEN 1200
  ELSE 500
END
WHERE "salesRecoveredEstimate" = 0;
