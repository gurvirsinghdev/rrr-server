ALTER TABLE "inventory_logs" ALTER COLUMN "item_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."inventory_item_enum";--> statement-breakpoint
CREATE TYPE "public"."inventory_item_enum" AS ENUM('fence', 'toilet');--> statement-breakpoint
ALTER TABLE "inventory_logs" ALTER COLUMN "item_type" SET DATA TYPE "public"."inventory_item_enum" USING "item_type"::"public"."inventory_item_enum";