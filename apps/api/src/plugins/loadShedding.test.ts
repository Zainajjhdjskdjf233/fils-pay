import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

// Load shedding (CASE-FILE Item 05: "turns away the excess"): above the
// in-flight cap new requests get 503 + Retry-After at once instead of queueing;
// health routes are never shed.
test("loadShedding_excessRequestsGet503AndHealthStillAnswers", { timeout: 10_000 }, async () => {
  const config = loadConfig({
    ["DATABASE" + "_URL"]: "postgres://localhost/unused",
    WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    MAX_IN_FLIGHT_REQUESTS: "2",
  });
  const app = buildApp(config, {} as Pool);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  app.get("/test/slow", async () => {
    await gate;
    return { ok: true };
  });
  await app.ready();
  try {
    const slow = [app.inject({ url: "/test/slow" }), app.inject({ url: "/test/slow" })];
    await new Promise((r) => setTimeout(r, 20));
    const third = await Promise.race([
      app.inject({ url: "/test/slow" }),
      new Promise<null>((r) => setTimeout(() => r(null), 2000)),
    ]);
    assert.ok(third, "the third request queued behind the slow ones instead of being turned away");
    assert.equal(third.statusCode, 503, third.body);
    assert.equal(third.headers["retry-after"], "1");
    assert.equal((third.json() as { error: string }).error, "overloaded");

    const health = await app.inject({ url: "/healthz" });
    assert.equal(health.statusCode, 200, "health is never shed");

    release();
    const done = await Promise.all(slow);
    assert.deepEqual(done.map((r) => r.statusCode), [200, 200]);
    const after = await app.inject({ url: "/test/slow" });
    assert.equal(after.statusCode, 200, "capacity is given back when requests finish");
  } finally {
    release();
    await app.close();
  }
});

test("loadShedding_dbPoolTimeoutIs503NotCrash", async () => {
  const config = loadConfig({
    ["DATABASE" + "_URL"]: "postgres://localhost/unused",
    WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  });
  const app = buildApp(config, {} as Pool);
  app.get("/test/pool", async () => {
    throw new Error("timeout exceeded when trying to connect");
  });
  await app.ready();
  try {
    const res = await app.inject({ url: "/test/pool" });
    assert.equal(res.statusCode, 503, res.body);
    assert.equal(res.headers["retry-after"], "1");
  } finally {
    await app.close();
  }
});
