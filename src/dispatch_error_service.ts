import { createServer } from "node:http";
import { ZodError } from "zod";
import { captureException, InfraiError } from "./infrai_errors.js";
import { toExceptionPayload, workOrderFailureSchema } from "./work_order_error.js";

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/work-order-errors") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = workOrderFailureSchema.parse(await readJson(request));
    const event = await captureException(toExceptionPayload(input), {
      idempotencyKey: request.headers["idempotency-key"] as string | undefined,
    });
    send(response, 202, {
      captured: true,
      group: `${input.workOrderId}:${input.dispatchStatus}:${input.followUp}`,
      event,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      send(response, 400, { error: "Invalid work-order failure", issues: error.issues });
    } else if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, detail: error.detail });
    } else {
      send(response, 500, { error: "Request could not be processed" });
    }
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Dispatch error service listening on http://localhost:${port}`));
