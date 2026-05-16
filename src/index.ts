import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { seedDB } from "./db/seed.js";

import { authRouter } from "./modules/auth/routes.js";
import { usersRouter } from "./modules/users/routes.js";
import { customersRouter } from "./modules/customers/routes.js";
import { jobsRouter } from "./modules/jobs/routes.js";
import { routesRouter } from "./modules/routes/routes.js";
import { dispatchRouter } from "./modules/routes/dispatch.js";
import { driverRouter } from "./modules/routes/driver.js";
import { assetsRouter } from "./modules/assets/routes.js";
import { invoicesRouter } from "./modules/invoices/routes.js";
import { uploadsRouter } from "./modules/uploads/routes.js";

import { inventoryRouter } from "./routes/inventoryRouter.js";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const app = new Hono();
app.use("/*", cors());

app.route("/auth", authRouter);
app.route("/users", usersRouter);
app.route("/customers", customersRouter);
app.route("/locations", customersRouter);
app.route("/jobs", jobsRouter);
app.route("/routes", routesRouter);
app.route("/dispatch", dispatchRouter);
app.route("/drivers", driverRouter);
app.route("/assets", assetsRouter);
app.route("/invoices", invoicesRouter);
app.route("/uploads", uploadsRouter);

app.route("/inventory", inventoryRouter);

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  async (info) => {
    if (process.env.SEED === "true") await seedDB();
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
