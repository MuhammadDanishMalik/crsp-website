CREATE TABLE "website_orders" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid NOT NULL,
	"state" text DEFAULT 'new' NOT NULL,
	"phone" text NOT NULL,
	"whatsapp" text,
	"lat" double precision,
	"lng" double precision,
	"location_text" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" uuid
);
--> statement-breakpoint
ALTER TABLE "website_orders" ADD CONSTRAINT "website_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_orders" ADD CONSTRAINT "website_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_orders" ADD CONSTRAINT "website_orders_decided_by_staff_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "website_orders_state_idx" ON "website_orders" USING btree ("branch_id","state");