import { task } from "@trigger.dev/sdk";

export const helloWorldTask = task({
  id: "hello-world",
  run: async (payload: { message?: string } = {}) => {
    const message = payload.message ?? "Hello from Trigger.dev!";
    console.log(message);
    return {
      message,
      timestamp: new Date().toISOString(),
    };
  },
});

