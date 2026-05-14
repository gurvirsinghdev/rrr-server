import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const userRoleEmum = pgEnum("user_role_enum", ["admin", "driver"]);
export const usersTable = pgTable("users", {
  id: text("id").primaryKey().notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: userRoleEmum("role").notNull().default("driver"),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fenceTypeEnum = pgEnum("fence_type_enum", [
  "fence_4ft",
  "fence_6ft",
]);
export const fencesTable = pgTable("fences", {
  id: text("id").primaryKey().notNull(),
  type: fenceTypeEnum("type").notNull().unique(),
  totalQuantity: integer("total_quantity").notNull().default(0),
  availableQuantity: integer("available_quantity").notNull().default(0),
  damagedQuantity: integer("damaged_quantity").notNull().default(0),
  maintenanceQuantity: integer("maintenance_quantity").notNull().default(0),

  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const toiletTypeEnum = pgEnum("toilet_type_enum", ["portable"]);
export const toiletStatusEnum = pgEnum("toilet_status_enum", [
  "available",
  "in_use",
  "maintenance",
  "damaged",
]);
export const toiletsTable = pgTable("toilets", {
  id: text("id").primaryKey().notNull(),
  sno: serial("sno"),
  type: toiletTypeEnum("type").notNull(),
  status: toiletStatusEnum("status").default("available"),
  currentLocation: text("current_location"),

  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const inventoryItemEnum = pgEnum("inventory_item_enum", [
  "fence",
  "toilet",
]);
export const inventoryActionEnum = pgEnum("inventory_action_enum", [
  "add",
  "remove",
  "assign",
  "return",
  "damage",
  "maintenance",
  "restore",
]);
export const inventoryLogsTable = pgTable("inventory_logs", {
  id: text("id").primaryKey().notNull(),
  itemType: inventoryItemEnum("item_type").notNull(),
  action: inventoryActionEnum("action").notNull(),
  quantity: integer("quantity").notNull(),
  referenceId: text("reference_id"),
  performedBy: text("performed_by")
    .notNull()
    .references(() => usersTable.id),
  note: text("note"),

  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});
