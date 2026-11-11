-- Regular / Spicy is optional: the cashier may skip it, and nothing is pre-selected.
UPDATE "modifier_groups" SET "min_select" = 0 WHERE "name" = 'Spice Level';--> statement-breakpoint
UPDATE "modifiers" SET "is_default" = false WHERE "group_id" IN (SELECT "id" FROM "modifier_groups" WHERE "name" = 'Spice Level');
