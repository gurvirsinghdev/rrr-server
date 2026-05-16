import { uuidv7 } from "uuidv7";
import { eq } from "drizzle-orm";
import { db } from "@/db/index.js";
import { customersTable, locationsTable } from "@/db/schema.js";

export async function listCustomers() {
  return await db.select().from(customersTable);
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
}) {
  const customer = { id: uuidv7(), ...data };
  await db.insert(customersTable).values(customer);
  return customer;
}

export async function getCustomerById(id: string) {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, id))
    .limit(1);
  return customer ?? null;
}

export async function createLocation(data: {
  customerId: string;
  name?: string;
  address: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  lat?: number;
  lng?: number;
}) {
  const location = { id: uuidv7(), ...data };
  await db.insert(locationsTable).values(location);
  return location;
}

export async function getLocationsByCustomerId(customerId: string) {
  return await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.customerId, customerId));
}

export async function listLocations(customerId?: string) {
  const query = db.select().from(locationsTable);
  if (customerId) {
    return await query.where(eq(locationsTable.customerId, customerId));
  }
  return await query;
}

export async function getLocationById(id: string) {
  const [location] = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.id, id))
    .limit(1);
  return location ?? null;
}
