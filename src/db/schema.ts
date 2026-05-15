import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role_enum", ["admin", "driver"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),

  firstName: text("first_name"),
  lastName: text("last_name"),
  role: userRoleEnum("role").notNull().default("driver"),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productTypeTable = pgTable("product_types", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productVariantTable = pgTable("product_variants", {
  id: text("id").primaryKey().notNull(),
  productTypeId: text("product_type_id")
    .notNull()
    .references(() => productTypeTable.id),

  name: text("name").notNull(),
  sku: text("sku"),
  metadata: jsonb("metadata"),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
});

export const assetStatusEnum = pgEnum("asset_status_enum", [
  "available",
  "reserved",
  "in_use",
  "maintenance",
  "damaged",
  "retired",
]);

export const assetsTable = pgTable("assets", {
  id: text("id").primaryKey().notNull(),

  productVariantId: text("product_variant_id")
    .notNull()
    .references(() => productVariantTable.id),

  label: text("label"),
  serialNumber: text("serial_number"),
  status: assetStatusEnum("status").default("available"),
  currentJobId: text("current_job_id"),
  lastServiceAt: timestamp("last_service_at"),
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customersTable = pgTable("customers", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobSitesTable = pgTable("job_sites", {
  id: text("id").primaryKey().notNull(),

  customerId: text("customer_id")
    .notNull()
    .references(() => customersTable.id),
  name: text("name"),
  address: text("address").notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const jobStatusEnum = pgEnum("job_status_enum", [
  "pending",
  "assigned",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

export const jobsTable = pgTable("jobs", {
  id: text("id").primaryKey().notNull(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customersTable.id),
  jobSiteId: text("job_site_id")
    .notNull()
    .references(() => jobSitesTable.id),
  scheduledDate: timestamp("scheduled_date").notNull(),
  status: jobStatusEnum("status").default("pending"),
  assignedDriverId: text("assigned_driver_id").references(() => usersTable.id),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobItemsTable = pgTable("job_items", {
  id: text("id").primaryKey().notNull(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobsTable.id),
  productVariantId: text("product_variant_id")
    .notNull()
    .references(() => productVariantTable.id),
  quantity: integer("quantity").notNull(),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const jobAssetsTable = pgTable("job_assets", {
  id: text("id").primaryKey().notNull(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobsTable.id),
  assetId: text("asset_id")
    .notNull()
    .references(() => assetsTable.id),

  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const jobSchedulesTable = pgTable("job_schedules", {
  id: text("id").primaryKey().notNull(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customersTable.id),
  jobSiteId: text("job_site_id")
    .notNull()
    .references(() => jobSitesTable.id),
  recurrenceRule: text("recurrence_rule").notNull(), // cron or custom
  nextRunAt: timestamp("next_run_at"),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
});

export const driverShiftsTable = pgTable("driver_shifts", {
  id: text("id").primaryKey().notNull(),
  driverId: text("driver_id")
    .notNull()
    .references(() => usersTable.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const jobPhotoTypeEnum = pgEnum("job_photo_type_enum", [
  "before",
  "after",
  "failure",
]);

export const jobPhotosTable = pgTable("job_photos", {
  id: text("id").primaryKey().notNull(),

  jobId: text("job_id")
    .notNull()
    .references(() => jobsTable.id),
  url: text("url").notNull(),
  type: jobPhotoTypeEnum("type"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const inventoryActionEnum = pgEnum("inventory_action_enum", [
  "created",
  "assigned",
  "returned",
  "maintenance",
  "damage",
  "status_change",
]);

export const inventoryLogsTable = pgTable("inventory_logs", {
  id: text("id").primaryKey().notNull(),
  assetId: text("asset_id")
    .notNull()
    .references(() => assetsTable.id),
  action: inventoryActionEnum("action").notNull(),
  performedBy: text("performed_by").references(() => usersTable.id),
  note: text("note"),

  createdAt: timestamp("created_at").defaultNow(),
});
