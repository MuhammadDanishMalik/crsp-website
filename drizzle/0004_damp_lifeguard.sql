CREATE TABLE "sadqa_given" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"given_on" date NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sadqa_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"percent_bps" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sadqa_rules_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "sadqa_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sadqa_given" ADD CONSTRAINT "sadqa_given_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sadqa_given" ADD CONSTRAINT "sadqa_given_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sadqa_rules" ADD CONSTRAINT "sadqa_rules_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;