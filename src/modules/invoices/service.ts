import { and, eq, inArray, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/index.js";
import {
  invoicesTable,
  invoiceItemsTable,
  jobsTable,
  customersTable,
} from "@/db/schema.js";

export async function generateInvoices(customerId?: string) {
  const result = await db.transaction(async (tx) => {
    const itemsQuery = tx
      .select({
        id: invoiceItemsTable.id,
        jobId: invoiceItemsTable.jobId,
        description: invoiceItemsTable.description,
        quantity: invoiceItemsTable.quantity,
        unitPrice: invoiceItemsTable.unitPrice,
        total: invoiceItemsTable.total,
        customerId: jobsTable.customerId,
      })
      .from(invoiceItemsTable)
      .innerJoin(jobsTable, eq(invoiceItemsTable.jobId, jobsTable.id))
      .where(
        and(
          isNull(invoiceItemsTable.invoiceId),
          eq(jobsTable.status, "completed"),
        ),
      );

    const items = customerId
      ? (await itemsQuery).filter((i) => i.customerId === customerId)
      : await itemsQuery;

    if (items.length === 0) return { invoices: [] };

    const grouped = new Map<string, typeof items>();
    for (const item of items) {
      const existing = grouped.get(item.customerId) ?? [];
      existing.push(item);
      grouped.set(item.customerId, existing);
    }

    const created: any[] = [];

    for (const [custId, custItems] of grouped) {
      const subtotal = custItems.reduce((sum, i) => sum + i.total, 0);

      const invoiceId = uuidv7();
      const invoiceNumber = `INV-${Date.now()}-${custId.slice(0, 8)}`;

      await tx.insert(invoicesTable).values({
        id: invoiceId,
        customerId: custId,
        invoiceNumber,
        status: "draft",
        subtotal,
        total: subtotal,
        issuedAt: new Date(),
      });

      await tx
        .update(invoiceItemsTable)
        .set({ invoiceId })
        .where(
          inArray(
            invoiceItemsTable.id,
            custItems.map((i) => i.id),
          ),
        );

      const [customer] = await tx
        .select({ name: customersTable.name })
        .from(customersTable)
        .where(eq(customersTable.id, custId))
        .limit(1);

      created.push({
        id: invoiceId,
        invoiceNumber,
        customerId: custId,
        customerName: customer?.name ?? "Unknown",
        status: "draft",
        subtotal,
        total: subtotal,
        itemCount: custItems.length,
      });
    }

    return { invoices: created };
  });

  return result;
}

export async function listInvoices() {
  return await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      status: invoicesTable.status,
      subtotal: invoicesTable.subtotal,
      total: invoicesTable.total,
      issuedAt: invoicesTable.issuedAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id));
}

export async function getInvoiceById(id: string) {
  const [invoice] = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      status: invoicesTable.status,
      subtotal: invoicesTable.subtotal,
      total: invoicesTable.total,
      issuedAt: invoicesTable.issuedAt,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(eq(invoicesTable.id, id))
    .limit(1);

  if (!invoice) return null;

  const items = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, id));

  return { ...invoice, items };
}
