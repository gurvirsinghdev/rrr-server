import { boolean, integer, jsonb, pgEnum, pgTable, real, text, timestamp, } from "drizzle-orm/pg-core";
export const userRoleEnum = pgEnum("user_role_enum", ["admin", "driver"]);
export const usersTable = pgTable("users", {
    id: text("id").primaryKey().notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    role: userRoleEnum("role").notNull().default("driver"),
    isActive: boolean("is_active").default(true),
    certifications: jsonb("certifications"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
export const productsTable = pgTable("products", {
    id: text("id").primaryKey().notNull(),
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
    productId: text("product_id")
        .notNull()
        .references(() => productsTable.id),
    label: text("label"),
    serialNumber: text("serial_number"),
    status: assetStatusEnum("status").default("available"),
    currentJobId: text("current_job_id"),
    lastServiceAt: timestamp("last_service_at"),
    metadata: jsonb("metadata"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
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
export const locationsTable = pgTable("locations", {
    id: text("id").primaryKey().notNull(),
    customerId: text("customer_id")
        .notNull()
        .references(() => customersTable.id),
    name: text("name"),
    address: text("address").notNull(),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    notes: text("notes"),
    lat: real("lat"),
    lng: real("lng"),
    createdAt: timestamp("created_at").defaultNow(),
});
export const jobStatusEnum = pgEnum("job_status_enum", [
    "scheduled",
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
    locationId: text("location_id")
        .notNull()
        .references(() => locationsTable.id),
    scheduledDate: timestamp("scheduled_date").notNull(),
    status: jobStatusEnum("status").default("scheduled"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
export const jobEventTypeEnum = pgEnum("job_event_type_enum", [
    "started",
    "completed",
    "failed",
    "note_added",
]);
export const jobEventsTable = pgTable("job_events", {
    id: text("id").primaryKey().notNull(),
    jobId: text("job_id")
        .notNull()
        .references(() => jobsTable.id),
    type: jobEventTypeEnum("type").notNull(),
    notes: text("notes"),
    performedBy: text("performed_by").references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow(),
});
export const jobItemsTable = pgTable("job_items", {
    id: text("id").primaryKey().notNull(),
    jobId: text("job_id")
        .notNull()
        .references(() => jobsTable.id),
    productId: text("product_id")
        .notNull()
        .references(() => productsTable.id),
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
    locationId: text("location_id")
        .notNull()
        .references(() => locationsTable.id),
    recurrenceRule: text("recurrence_rule").notNull(),
    nextRunAt: timestamp("next_run_at"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
});
export const routesTable = pgTable("routes", {
    id: text("id").primaryKey().notNull(),
    date: timestamp("date").notNull(),
    driverId: text("driver_id")
        .notNull()
        .references(() => usersTable.id),
    status: text("status").default("active"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
export const routeJobsTable = pgTable("route_jobs", {
    id: text("id").primaryKey().notNull(),
    routeId: text("route_id")
        .notNull()
        .references(() => routesTable.id),
    jobId: text("job_id")
        .notNull()
        .references(() => jobsTable.id),
    order: integer("order").notNull().default(0),
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
export const invoiceStatusEnum = pgEnum("invoice_status_enum", [
    "draft",
    "sent",
    "paid",
    "void",
]);
export const invoicesTable = pgTable("invoices", {
    id: text("id").primaryKey().notNull(),
    customerId: text("customer_id")
        .notNull()
        .references(() => customersTable.id),
    invoiceNumber: text("invoice_number").notNull().unique(),
    status: invoiceStatusEnum("status").default("draft"),
    subtotal: integer("subtotal").notNull().default(0),
    total: integer("total").notNull().default(0),
    issuedAt: timestamp("issued_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
});
export const invoiceItemsTable = pgTable("invoice_items", {
    id: text("id").primaryKey().notNull(),
    invoiceId: text("invoice_id").references(() => invoicesTable.id),
    jobId: text("job_id")
        .notNull()
        .references(() => jobsTable.id),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: integer("unit_price").notNull(),
    total: integer("total").notNull(),
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
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
});
