# API route conventions

Every route in `src/routes/` follows these rules. `src/routes/health.js` and `src/routes/users.js` are the reference examples.

1. One file per route: `src/routes/<name>.js`, lower-case, singular or plural as the resource reads.
2. The file exports `path` (a string, `"/<name>"`) and `handler(req)`, an async function. `req` is `{ method, query, body }`. Leave `req` out of the signature when the handler does not use it, as `health.js` does.
3. `handler` returns a response built with the helpers in `src/http.js` (`ok`, `created`, `badRequest`, `notFound`). Never return a bare object.
4. Validate input first. Missing or invalid input returns `badRequest("<what is wrong>")`.
5. Register the route in `src/routes/index.js`: import it and add it to `routes`. Keep both the imports and the array alphabetical.
6. Add `tests/routes/<name>.test.js` with at least one happy-path test and one `badRequest` test.
