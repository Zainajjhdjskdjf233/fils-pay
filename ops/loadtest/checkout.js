// k6 checkout load test (CASE-FILE Item 05, capacity).
// One iteration = one buyer: open the payment link, then pay it.
// Open model: RATE new checkouts per second for DURATION, whatever the server
// does (a closed model would slow down with the server and flatter it).
//
//   k6 run -e BASE=http://localhost:8080 -e RATE=10 -e DURATION=45s -e OFFSET=0 ops/loadtest/checkout.js
//
// Links lt-1 … lt-N must exist (ops/loadtest/README.md). OFFSET skips links
// already used by earlier runs.
import http from "k6/http";
import { check } from "k6";
import exec from "k6/execution";
import { Counter, Trend } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:8080";
const RATE = Number(__ENV.RATE || 5);
const OFFSET = Number(__ENV.OFFSET || 0);

// VUS=N switches to a closed model: N users, each checking out back to back
// (no think time) — the "how many users at once" view of the same limit.
const VUS = Number(__ENV.VUS || 0);
export const options = {
  scenarios: {
    checkout: VUS > 0
      ? { executor: "constant-vus", vus: VUS, duration: __ENV.DURATION || "45s" }
      : {
          executor: "constant-arrival-rate",
          rate: RATE,
          timeUnit: "1s",
          duration: __ENV.DURATION || "45s",
          preAllocatedVUs: Math.max(20, RATE * 4),
          maxVUs: Math.max(100, RATE * 10),
        },
  },
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
};

const payOk = new Counter("checkout_paid");
const payShed = new Counter("checkout_shed");      // 503/429: turned away on purpose
const payError = new Counter("checkout_error");    // anything else
const payTime = new Trend("checkout_pay_ms", true);

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function () {
  const token = `lt-${OFFSET + exec.scenario.iterationInTest + 1}`;
  const view = http.get(`${BASE}/v1/payment-links/${token}`, { tags: { step: "view" } });
  check(view, { "view 200": (r) => r.status === 200 });

  const res = http.post(
    `${BASE}/v1/payment-links/${token}/pay`,
    JSON.stringify({ card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" } }),
    { headers: { "Content-Type": "application/json", "Idempotency-Key": uuid() }, tags: { step: "pay" }, timeout: "30s" },
  );
  if (res.status === 200) {
    payOk.add(1);
    payTime.add(res.timings.duration);
  } else if (res.status === 503 || res.status === 429) {
    payShed.add(1);
  } else {
    payError.add(1);
  }
  check(res, { "pay 200": (r) => r.status === 200 });
}
