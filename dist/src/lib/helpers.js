export async function parseBody(c, schema) {
    const payload = await c.req.json();
    const result = schema.safeParse(payload);
    if (!result.success) {
        console.error(result.error);
        return {
            data: null,
            errorResponse: c.json({ error: "Invalid request data" }, 400),
        };
    }
    return { data: result.data, errorResponse: null };
}
export function getUserId(c) {
    return c.get("user").userId;
}
