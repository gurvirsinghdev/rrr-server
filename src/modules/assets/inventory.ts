import { Hono } from "hono";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { assetsRouter } from "./routes.js";
import { productsRouter } from "./products.js";
import { logsRouter } from "./logs.js";
import { summaryRouter } from "./summary.js";

export const inventoryRouter = new Hono();
inventoryRouter.use(authMiddleware, isAdmin);

inventoryRouter.route("/assets", assetsRouter);
inventoryRouter.route("/products", productsRouter);
inventoryRouter.route("/logs", logsRouter);
inventoryRouter.route("/summary", summaryRouter);
