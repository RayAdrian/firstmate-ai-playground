---
name: new-api-route
description: Scaffold a new API route to this repo's conventions (handler file, registration, test). Use when the user asks to add or create an API route or endpoint, for example "add an orders route".
---

Scaffold a new API route. The route name is the word the user gave after the skill name, or in their request (for example `orders`). Use lower case.

1. Read `CONVENTIONS.md` and `src/routes/health.js` and `src/routes/users.js`. They are the source of truth. Copy their shape.
2. Create `src/routes/<name>.js`. It exports `path = "/<name>"` and an async `handler(req)` that validates `req.query` first and builds every response with `src/http.js` (`ok`, `badRequest`, `notFound`).
3. Register it in `src/routes/index.js`: add the import and add it to `routes`. Keep both alphabetical.
4. Create `tests/routes/<name>.test.js` with one happy-path test and one `badRequest` test.
5. Run `npm test`. Fix anything red, then list the files you created or changed.

Do not change existing routes. Do not invent new response helpers. If the user did not say what the route should return, ask before writing the handler body.
