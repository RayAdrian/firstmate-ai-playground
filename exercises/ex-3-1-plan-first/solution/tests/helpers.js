import { createServer } from "../src/app.js";

/** Starts the app on an ephemeral port and returns a fetch helper plus a stop function. */
export async function startApp() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return {
    get: (path) => fetch(`http://127.0.0.1:${port}${path}`),
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}
