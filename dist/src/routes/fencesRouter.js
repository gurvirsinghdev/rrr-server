import { db } from "@/db/index.js";
import { fencesTable, fenceTypeEnum, inventoryLogsTable } from "@/db/schema.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";
import { uuidv7 } from "uuidv7";
import { getUserId, parseBody } from "@/lib/helpers.js";
export const fencesRouter = new Hono();
fencesRouter.use(authMiddleware, isAdmin);
async function findFence(type) {
    const rows = await db
        .select()
        .from(fencesTable)
        .where(eq(fencesTable.type, type))
        .limit(1);
    return rows[0] ?? null;
}
const fenceActionSchema = z.object({
    type: z.enum(fenceTypeEnum.enumValues),
    quantity: z.number().int().positive(),
});
fencesRouter.get("fence-types", async (c) => {
    return c.json({ types: fenceTypeEnum.enumValues });
});
fencesRouter.post("/add", async (c) => {
    const { data, errorResponse } = await parseBody(c, fenceActionSchema);
    if (errorResponse)
        return errorResponse;
    const { quantity, type } = data;
    await db.transaction(async (tx) => {
        const existing = await tx
            .select()
            .from(fencesTable)
            .where(eq(fencesTable.type, type))
            .limit(1);
        if (existing.length === 0)
            await tx
                .insert(fencesTable)
                .values({
                id: uuidv7(),
                type,
                totalQuantity: quantity,
                availableQuantity: quantity,
                damagedQuantity: 0,
            })
                .onConflictDoUpdate({
                target: fencesTable.type,
                set: {
                    totalQuantity: sql `${fencesTable.totalQuantity} + ${quantity}`,
                    availableQuantity: sql `${fencesTable.availableQuantity} + ${quantity}`,
                },
            });
        else {
            const targetRow = existing[0];
            await tx
                .update(fencesTable)
                .set({
                totalQuantity: sql `${fencesTable.totalQuantity} + ${quantity}`,
                availableQuantity: sql `${fencesTable.availableQuantity} + ${quantity}`,
            })
                .where(eq(fencesTable.id, targetRow.id));
        }
        await tx.insert(inventoryLogsTable).values({
            id: uuidv7(),
            itemType: "fence",
            action: "add",
            quantity,
            performedBy: getUserId(c),
        });
    });
    return c.json({ status: true, message: "Fences added successfully" });
});
fencesRouter.post("/damage", async (c) => {
    const { data, errorResponse } = await parseBody(c, fenceActionSchema);
    if (errorResponse)
        return errorResponse;
    const { quantity, type } = data;
    const fence = await findFence(type);
    if (!fence)
        return c.json({ error: "No such fence type exists" }, 400);
    if (fence.availableQuantity < quantity)
        return c.json({ error: "Not enough available fences to mark as damaged" }, 400);
    await db.transaction(async (tx) => {
        await tx
            .update(fencesTable)
            .set({
            availableQuantity: sql `${fencesTable.availableQuantity} - ${quantity}`,
            damagedQuantity: sql `${fencesTable.damagedQuantity} + ${quantity}`,
        })
            .where(eq(fencesTable.id, fence.id));
        await tx.insert(inventoryLogsTable).values({
            id: uuidv7(),
            itemType: "fence",
            action: "damage",
            quantity,
            performedBy: getUserId(c),
        });
    });
    return c.json({ status: true, message: "Fences marked as damaged" });
});
fencesRouter.post("/remove", async (c) => {
    const { data, errorResponse } = await parseBody(c, fenceActionSchema);
    if (errorResponse)
        return errorResponse;
    const { quantity, type } = data;
    const fence = await findFence(type);
    if (!fence)
        return c.json({ error: "No such fence type exists" }, 400);
    if (fence.availableQuantity < quantity)
        return c.json({ error: "Not enough available fences to remove" }, 400);
    await db.transaction(async (tx) => {
        await tx
            .update(fencesTable)
            .set({
            totalQuantity: sql `${fencesTable.totalQuantity} - ${quantity}`,
            availableQuantity: sql `${fencesTable.availableQuantity} - ${quantity}`,
        })
            .where(eq(fencesTable.id, fence.id));
        await tx.insert(inventoryLogsTable).values({
            id: uuidv7(),
            itemType: "fence",
            action: "remove",
            quantity,
            performedBy: getUserId(c),
        });
    });
    return c.json({ status: true, message: "Fences removed successfully" });
});
fencesRouter.post("/remove-damaged", async (c) => {
    const { data, errorResponse } = await parseBody(c, fenceActionSchema);
    if (errorResponse)
        return errorResponse;
    const { quantity, type } = data;
    const fence = await findFence(type);
    if (!fence)
        return c.json({ error: "No such fence type exists" }, 400);
    if (fence.damagedQuantity < quantity)
        return c.json({ error: "Not enough damaged fences to remove" }, 400);
    await db.transaction(async (tx) => {
        await tx
            .update(fencesTable)
            .set({
            totalQuantity: sql `${fencesTable.totalQuantity} - ${quantity}`,
            damagedQuantity: sql `${fencesTable.damagedQuantity} - ${quantity}`,
        })
            .where(eq(fencesTable.id, fence.id));
        await tx.insert(inventoryLogsTable).values({
            id: uuidv7(),
            itemType: "fence",
            action: "remove",
            note: `Permanently removed ${quantity} damaged ${quantity > 1 ? "fences" : "fence"}.`,
            quantity,
            performedBy: getUserId(c),
        });
    });
    return c.json({
        status: true,
        message: "Damaged fences removed successfully",
    });
});
fencesRouter.post("/maintenance", async (c) => {
    const { data, errorResponse } = await parseBody(c, fenceActionSchema);
    if (errorResponse)
        return errorResponse;
    const { quantity, type } = data;
    const fence = await findFence(type);
    if (!fence)
        return c.json({ error: "No such fence type exists" }, 400);
    if (fence.availableQuantity < quantity)
        return c.json({
            error: "Not enough available fences to mark as under maintenance",
        });
    await db.transaction(async (tx) => {
        await tx
            .update(fencesTable)
            .set({
            availableQuantity: sql `${fencesTable.availableQuantity} - ${quantity}`,
            maintenanceQuantity: sql `${fencesTable.maintenanceQuantity} + ${quantity}`,
        })
            .where(eq(fencesTable.id, fence.id));
        await tx.insert(inventoryLogsTable).values({
            id: uuidv7(),
            itemType: "fence",
            action: "maintenance",
            quantity,
            performedBy: getUserId(c),
        });
    });
    return c.json({
        status: true,
        message: "Fences marked as under maintenance",
    });
});
fencesRouter.post("/restore", async (c) => {
    const { data, errorResponse } = await parseBody(c, fenceActionSchema);
    if (errorResponse)
        return errorResponse;
    const { quantity, type } = data;
    const fence = await findFence(type);
    if (!fence)
        return c.json({ error: "No such fence type exists" }, 400);
    if (fence.maintenanceQuantity < quantity)
        return c.json({ error: "Not enough fences under maintenance to restore" });
    await db.transaction(async (tx) => {
        await tx
            .update(fencesTable)
            .set({
            availableQuantity: sql `${fencesTable.availableQuantity} + ${quantity}`,
            maintenanceQuantity: sql `${fencesTable.maintenanceQuantity} - ${quantity}`,
        })
            .where(eq(fencesTable.id, fence.id));
        await tx.insert(inventoryLogsTable).values({
            id: uuidv7(),
            itemType: "fence",
            action: "restore",
            quantity,
            performedBy: getUserId(c),
        });
    });
    return c.json({
        status: true,
        message: "Fences restored from maintenance successfully",
    });
});
