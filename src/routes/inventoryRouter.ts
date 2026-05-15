import { Hono } from "hono";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";

import { assetsRouter } from "./assetsRouter.js";
import { variantsRouter } from "./variantsRouter.js";
import { logsRouter } from "./logsRouter.js";
import { summaryRouter } from "./summaryRouter.js";
import { inventoryTypesRouter } from "./inventoryTypesRouter.js";

export const inventoryRouter = new Hono();
inventoryRouter.use(authMiddleware, isAdmin);

inventoryRouter.route("/assets", assetsRouter);
inventoryRouter.route("/variants", variantsRouter);
inventoryRouter.route("/logs", logsRouter);
inventoryRouter.route("/summary", summaryRouter);
inventoryRouter.route("/types", inventoryTypesRouter);
