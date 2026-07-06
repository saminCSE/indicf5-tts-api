# Load Test Report — 2026-07-04

Tool: `autocannon`. Target: API in prod build (`node dist/main`), mock TTS backend, queue cap 100, rate limit raised out of the way (isolating queue behavior). Hardware: M-series MacBook, all services local.

## 1. Baseline — `GET /v1/health`, 100 connections, 10s

| Metric | Value |
|---|---|
| Throughput | **~31,000 req/s** |
| Latency p50 / p99 | 2.8 ms / 6 ms |
| Errors | 0 |

Framework + envelope overhead is negligible.

## 2. The real test — `POST /v1/tts` burst, 50 connections, 10s

33,000 submissions in 10 seconds against a worker that drains ~3 jobs/second.

| Metric | Value |
|---|---|
| Total requests | 33,000 |
| Accepted (202) | **125** — queue cap 100 + drain during the burst |
| Rejected (503 + Retry-After) | 32,763 |
| Latency p50 / p99 | **14.7 ms / 43 ms** |
| API process | alive, responsive throughout |

**Interpretation — this is the design working:**
- A naive implementation (inference in the request handler) would have held 33k connections open against a 300ms+ operation and collapsed within seconds.
- Every accepted job returned in ~15ms; every rejection was **fast and explicit** (503 + `Retry-After: 30`), so clients know to back off rather than pile on.
- Accepted jobs all completed after the burst — nothing lost, nothing orphaned (rejections create no DB documents; verified by e2e test).

## 3. Read path under pressure — `GET /v1/jobs`, 100 connections, 10s

| Metric | Value |
|---|---|
| Throughput | ~1,830 req/s |
| Latency p50 / p99 | 54 ms / 109 ms |
| Errors | 0 |

Paginated Mongo queries (compound index `{userId, createdAt}`) stay healthy while the queue is saturated — polling clients don't degrade the system.

## Reproduce

```bash
cd api && npm run build
RATE_LIMIT_PER_MINUTE=1000000 PORT=3003 node dist/main &
# register, capture KEY, then:
npx autocannon -c 100 -d 10 http://localhost:3003/v1/health
npx autocannon -c 50 -d 10 -m POST \
  -H "content-type: application/json" -H "x-api-key: $KEY" \
  -b '{"text":"আমার সোনার বাংলা আমি তোমায় ভালোবাসি"}' \
  http://localhost:3003/v1/tts
npx autocannon -c 100 -d 10 -H "x-api-key: $KEY" "http://localhost:3003/v1/jobs?limit=10"
```
