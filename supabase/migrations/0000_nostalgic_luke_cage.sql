CREATE TABLE "collaborators" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'qhs-engenharia' NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"registration_date" text DEFAULT '' NOT NULL,
	"display_updated_at" text DEFAULT '' NOT NULL,
	"owner_uid" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deletion_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'qhs-engenharia' NOT NULL,
	"origin" text NOT NULL,
	"request_id" text,
	"record_type" text NOT NULL,
	"target_id" text NOT NULL,
	"target_code" text DEFAULT '' NOT NULL,
	"target_name" text NOT NULL,
	"target_details" text DEFAULT '' NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"requested_by" text NOT NULL,
	"requested_by_date" text NOT NULL,
	"approved_by" text,
	"approved_at" text,
	"deleted_by" text NOT NULL,
	"deleted_by_email" text NOT NULL,
	"deleted_by_uid" text NOT NULL,
	"deleted_at" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deletion_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'qhs-engenharia' NOT NULL,
	"record_type" text NOT NULL,
	"target_id" text NOT NULL,
	"target_code" text DEFAULT '' NOT NULL,
	"target_name" text NOT NULL,
	"target_details" text DEFAULT '' NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"requested_by" text NOT NULL,
	"requested_by_email" text NOT NULL,
	"requested_by_uid" text NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"reviewed_by" text,
	"reviewed_by_email" text,
	"reviewed_at" text,
	"executed_by" text,
	"executed_at" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "managed_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"groups" jsonb NOT NULL,
	"roles" jsonb NOT NULL,
	"destinations" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'qhs-engenharia' NOT NULL,
	"product_id" text NOT NULL,
	"product_code" text NOT NULL,
	"product_name" text NOT NULL,
	"group_name" text NOT NULL,
	"type" text NOT NULL,
	"quantity" double precision NOT NULL,
	"stock_after_movement" double precision NOT NULL,
	"date" text NOT NULL,
	"withdrawn_by" text,
	"collaborator_id" text,
	"responsible_user" text NOT NULL,
	"destination" text,
	"notes" text,
	"is_negative_stock_authorized" boolean,
	"authorized_by" text,
	"owner_uid" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negative_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'qhs-engenharia' NOT NULL,
	"product_id" text NOT NULL,
	"product_code" text NOT NULL,
	"product_name" text NOT NULL,
	"group_name" text NOT NULL,
	"requested_quantity" double precision NOT NULL,
	"available_stock" double precision NOT NULL,
	"deficit_quantity" double precision NOT NULL,
	"withdrawn_by" text NOT NULL,
	"collaborator_id" text,
	"destination" text NOT NULL,
	"requested_by" text NOT NULL,
	"requested_by_uid" text NOT NULL,
	"reason" text NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'qhs-engenharia' NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"group_name" text NOT NULL,
	"current_stock" double precision DEFAULT 0 NOT NULL,
	"min_stock" double precision DEFAULT 0 NOT NULL,
	"photo_url" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"registration_date" text DEFAULT '' NOT NULL,
	"display_updated_at" text DEFAULT '' NOT NULL,
	"owner_uid" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"show_product_photos" boolean DEFAULT true NOT NULL,
	"company_name" text NOT NULL,
	"company_subtitle" text NOT NULL,
	"cnpj" text NOT NULL,
	"contact_email" text NOT NULL,
	"low_stock_alert_notification" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"uid" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"permissions" jsonb NOT NULL,
	"registration_date" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negative_requests" ADD CONSTRAINT "negative_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negative_requests" ADD CONSTRAINT "negative_requests_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;