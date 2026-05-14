import jwt from "jsonwebtoken";
export const authMiddleware = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or malformed authorization header" }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
};
export const isAdmin = async (c, next) => {
  const user = c.get("user");
  if (!(user?.role === "admin"))
    return c.json({ error: "Admin access required" }, 403);
  await next();
};
