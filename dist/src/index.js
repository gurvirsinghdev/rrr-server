import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { seedDB } from "./db/seed.js";
import { authRouter } from "./routes/authRouter.js";
import { cors } from "hono/cors";
import { inventoryRouter } from "./routes/inventoryRouter.js";
import { jobsRouter } from "./routes/jobsRouter.js";
import { customersRouter } from "./routes/customersRouter.js";
import { jobSitesRouter } from "./routes/jobSitesRouter.js";
import { driversRouter } from "./routes/driversRouter.js";
if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
}
const app = new Hono();
app.use("/*", cors());
app.route("/auth", authRouter);
app.route("/inventory", inventoryRouter);
app.route("/jobs", jobsRouter);
app.route("/customers", customersRouter);
app.route("/job-sites", jobSitesRouter);
app.route("/drivers", driversRouter);
serve({
    fetch: app.fetch,
    port: 3000,
}, async (info) => {
    if (process.env.SEED === "true")
        await seedDB();
    console.log(`Server is running on http://localhost:${info.port}`);
});
