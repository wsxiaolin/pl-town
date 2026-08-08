# Test layout

- `smoke.spec.ts`: user-facing browser smoke coverage.
- `diagnostics/`: opt-in visual and performance diagnostics; these are not part
  of the default smoke suite.

Server integration tests live alongside the server in `server/tests/` because
they require the server's runtime and dependencies.
