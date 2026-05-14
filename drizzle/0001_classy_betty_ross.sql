CREATE TYPE "public"."fence_type_enum" AS ENUM('fence_4ft', 'fence_6ft');--> statement-breakpoint
CREATE TYPE "public"."inventory_action_enum" AS ENUM('add', 'remove', 'assign', 'return', 'damage');--> statement-breakpoint
CREATE TYPE "public"."inventory_item_enum" AS ENUM('fence', 'toilets');--> statement-breakpoint
CREATE TYPE "public"."toilet_status_enum" AS ENUM('available', 'in_use', 'maintenance', 'damaged');--> statement-breakpoint
CREATE TYPE "public"."toilet_type_enum" AS ENUM('portable');--> statement-breakpoint
CREATE TABLE "fences_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "fence_type_enum" NOT NULL,
	"total_quantity" integer DEFAULT 0 NOT NULL,
	"available_quantity" integer DEFAULT 0 NOT NULL,
	"damaged_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"item_type" "inventory_item_enum" NOT NULL,
	"action" "inventory_action_enum" NOT NULL,
	"quantity" integer NOT NULL,
	"reference_id" text,
	"performed_by" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "toilets" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "toilet_type_enum" NOT NULL,
	"status" "toilet_status_enum" DEFAULT 'available',
	"current_location" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;