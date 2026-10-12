ALTER TABLE "orders" ADD COLUMN "ready_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "shift_id" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "kind" text DEFAULT 'refund' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;