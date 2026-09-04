import { Hono } from "hono";
import { cors } from "hono/cors";
import { UserDO, type Env } from "./user-do";

export { UserDO };

type AppEnv = {
  Bindings: Env;
};

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "x-user-id"],
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "copilot-clone-api" }));

/** Better Auth stub — placeholder routes only. */
app.get("/auth/session", (c) =>
  c.json({
    user: null,
    session: null,
    stub: true,
    message: "Better Auth not wired yet",
  }),
);

app.post("/auth/sign-in", (c) =>
  c.json({ ok: false, stub: true, message: "Better Auth sign-in stub" }, 501),
);

app.post("/auth/sign-out", (c) => c.json({ ok: true, stub: true }));

function userStubId(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header("x-user-id") ?? "demo-user";
}

function doStub(env: Env, userId: string) {
  const id = env.USER_DO.idFromName(userId);
  return env.USER_DO.get(id);
}

async function proxyDo(
  c: { env: Env; req: { header: (n: string) => string | undefined; url: string } },
  pathAndQuery: string,
  init?: RequestInit,
): Promise<Response> {
  const userId = userStubId(c);
  const stub = doStub(c.env, userId);
  const res = await stub.fetch(`https://do${pathAndQuery}`, init);
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

app.post("/sync", async (c) => {
  const body = await c.req.text();
  return proxyDo(c, "/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
});

app.get("/transactions", async (c) => proxyDo(c, "/transactions"));

app.get("/categories", async (c) => {
  const month = c.req.query("month");
  const q = month ? `?month=${encodeURIComponent(month)}` : "";
  return proxyDo(c, `/categories${q}`);
});

app.get("/budgets", async (c) => {
  const month = c.req.query("month");
  const q = month ? `?month=${encodeURIComponent(month)}` : "";
  return proxyDo(c, `/budgets${q}`);
});

app.get("/dashboard/spending", async (c) => {
  const month = c.req.query("month");
  const q = month ? `?month=${encodeURIComponent(month)}` : "";
  return proxyDo(c, `/dashboard/spending${q}`);
});


app.get("/cash-flow", async (c) => {
  const month = c.req.query("month");
  const q = month ? `?month=${encodeURIComponent(month)}` : "";
  return proxyDo(c, `/cash-flow${q}`);
});

app.get("/accounts", async (c) => proxyDo(c, "/accounts"));

app.get("/do/health", async (c) => proxyDo(c, "/health"));

export default app;
