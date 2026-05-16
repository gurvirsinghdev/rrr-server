import { Hono } from "hono";
import { loginSchema } from "./validation.js";
import { loginUser, getMe } from "./service.js";
import { authMiddleware } from "@/middleware/authMiddleware.js";
import { getUserId } from "@/lib/helpers.js";

export const authRouter = new Hono();

authRouter.post("/login", async (c) => {
  const payload = await c.req.json();
  const result = loginSchema.safeParse(payload);
  if (!result.success) {
    return c.json({ error: "Invalid request data" }, 400);
  }

  const outcome = await loginUser(result.data.email, result.data.password);
  if (!outcome) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  return c.json(outcome);
});

authRouter.get("/me", authMiddleware, async (c) => {
  const user = await getMe(getUserId(c));
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  return c.json({ user });
});
