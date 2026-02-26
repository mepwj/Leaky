-- Add sort order for account/card list ordering
ALTER TABLE "Account"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Card"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ordered_accounts AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) - 1 AS rn
  FROM "Account"
)
UPDATE "Account" a
SET "sortOrder" = oa.rn
FROM ordered_accounts oa
WHERE a.id = oa.id;

WITH ordered_cards AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) - 1 AS rn
  FROM "Card"
)
UPDATE "Card" c
SET "sortOrder" = oc.rn
FROM ordered_cards oc
WHERE c.id = oc.id;
