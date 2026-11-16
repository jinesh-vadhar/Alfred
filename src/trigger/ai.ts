import { task } from "@trigger.dev/sdk";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const generateAiTask = task({
  id: "generate-ai-text",
  run: async (payload: { prompt?: string } = {}) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment");
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const prompt = payload.prompt ?? "Say hello from Trigger.dev and AI SDK in one short sentence!";

    const result = await generateText({
      model: google("gemini-3.5-flash-lite"),
      prompt,
    });

    return {
      prompt,
      text: result.text,
      model: "gemini-3.5-flash-lite",
      timestamp: new Date().toISOString(),
    };
  },
});

