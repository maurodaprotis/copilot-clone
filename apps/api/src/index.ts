import { Hono } from "hono";
import { UserDO, type Env } from "./user-do";

export { UserDO };

type AppEnv = {
  Bindings: Env;
};

const app = new Hono<AppEnv>();

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

app.post("/auth/sign-out", (c) =>
  c.json({ ok: true, stub: true }),
);

function userStubId(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header("x-user-id") ?? "demo-user";
}

function doStub(env: Env, userId: string) {
  const id = env.USER_DO.idFromName(userId);
  return env.USER_DO.get(id);
}

app.post("/sync", async (c) => {
  const userId = userStubId(c);
  const stub = doStub(c.env, userId);
  const body = await c.req.text();
  const res = await stub.fetch("https://do/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
});

app.get("/do/health", async (c) => {
  const userId = userStubId(c);
  const stub = doStub(c.env, userId);
  const res = await stub.fetch("https://do/health");
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
});

export default app;
