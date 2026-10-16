ALTER TABLE "ingredients" ADD COLUMN "kcal" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "protein_g" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "carbs_g" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "fat_g" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "nutrition_override" jsonb;