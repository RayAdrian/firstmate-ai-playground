# Plan: paginate GET /items

## Goal

Let clients page through `GET /items` with `?page=<n>&limit=<n>` so a large list doesn't have to be sent in one response. Existing callers that send no query must keep receiving exactly what they get today.

Out of scope: cursor pagination, sorting or filtering, changing the item shape, and any change to `GET /items/:id`.

## Files to change

- `src/app.js`: add query parsing and slicing to the `GET /items` handler. This is the only production file that changes.
- `tests/pagination.test.js`: already describes the behaviour. Read it first; it is the spec and must not be edited.
- `tests/items.test.js`: must keep passing unchanged. It is the backwards-compatibility guard.

## Steps

1. Read `src/app.js`, `src/items.js` and both test files to confirm the current contract (bare array, 45 items).
2. Add a `parsePositiveInt` helper that accepts only digit strings that are >= 1, so `1.5`, `-3`, `abc` and `0` are rejected.
3. Add `parsePagination(searchParams)`. It returns `null` when neither param is present, an error when `page` is present without `limit`, and `{ page, limit }` otherwise. `limit` is capped at 100; `page` defaults to 1.
4. In the handler: if there is no pagination, return the full array as before. On an error, respond 400 with `{ error: string }`. Otherwise slice `items` from `(page - 1) * limit` and return it as a bare array.
5. Set `X-Total-Count` (all items) and `X-Total-Pages` (`ceil(total / limit)`) headers on paginated responses only.
6. Run `npm test`; fix until the pagination tests and the existing tests all pass.

## Risks and open questions

- **Backwards compatibility.** Changing the body to `{ data, total }` would break every existing client that expects an array. Decision: keep the body a bare array and put the totals in headers. Pagination only switches on when `limit` is sent.
- **Invalid input.** Non-integer, zero, negative and oversized values return 400 with an error message, rather than being coerced. A `page` without a `limit` is also a 400, because silently ignoring it would hide a client bug.
- **Page past the end** returns 200 with `[]`, not 404, so a client can stop when it gets an empty page.
- **Ordering** is insertion order today. If items get deleted or inserted concurrently, offset pagination can skip or repeat rows. Acceptable here with an in-memory list; revisit with a real database.
- Open question for the client: is a default limit wanted for callers that send no query? Not changing it now, because it would be a breaking change.

## Verification

- `npm test` passes, including `tests/pagination.test.js` and the unchanged `tests/items.test.js`.
- Manually: `PORT=3000 npm start`, then `curl -i "localhost:3000/items?page=2&limit=10"` shows ids 11 to 20 and both headers; `curl localhost:3000/items | jq length` still prints 45.
