import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";

const autocompleteSchema = z.object({
  input: z.string().min(1),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().optional(),
});

type PlacesAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction: {
      placeId: string;
      text: { text: string };
      structuredFormat: {
        mainText: { text: string };
        secondaryText: { text: string };
      };
    };
  }>;
  error?: { message: string };
};

export const geocodeRouter = new Hono();
geocodeRouter.use(authMiddleware, isAdmin);

geocodeRouter.post("/", async (c) => {
  const body = await c.req.json();
  const result = autocompleteSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: "Input is required" }, 400);
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return c.json({ error: "Places service is not configured" }, 500);
  }

  const { input, lat, lng, radius } = result.data;

  const requestBody: Record<string, unknown> = { input };

  if (lat !== undefined && lng !== undefined) {
    requestBody.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radius ?? 50000,
      },
    };
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify(requestBody),
    },
  );

  const data = (await response.json()) as PlacesAutocompleteResponse;

  if (data.error) {
    return c.json({ error: `Places error: ${data.error.message}` }, 502);
  }

  const suggestions = (data.suggestions || []).map((s) => ({
    description: s.placePrediction.text.text,
    mainText: s.placePrediction.structuredFormat.mainText.text,
    secondaryText: s.placePrediction.structuredFormat.secondaryText.text,
    placeId: s.placePrediction.placeId,
  }));

  return c.json({ suggestions });
});
