# Transaction History

The `/transactions` page lists past escrow activity with filters, text search,
"Load more" pagination and CSV export of the filtered set.

## Filters (persisted in the URL)

| Query param | Meaning                                              |
|-------------|------------------------------------------------------|
| `status`    | Escrow status (`pending`, `active`, `completed`, ...) |
| `asset`     | Escrow asset code, e.g. `XLM`                        |
| `type`      | Event type, e.g. `funded`, `completed`               |
| `from`/`to` | Inclusive date range (`YYYY-MM-DD`)                  |
| `q`         | Case-insensitive search over escrow title and ID     |

Example: `/transactions?status=active&asset=USDC&q=logo`

## API: `GET /events`

Cursor (keyset) pagination is opt-in so existing offset clients are unaffected.

Query params added: `paginate=cursor`, `cursor`, `status`, `assetCode`, `search`
(`limit` max 100, `dateFrom`/`dateTo`/`eventType` as before).

With `paginate=cursor` results are ordered by the monotonic event `cursor`
(`sortOrder`, default `DESC`) and the response is:

```json
{ "data": [], "limit": 20, "hasMore": true, "nextCursor": "1234" }
```

Pass `nextCursor` as `cursor` to fetch the next page. A non-numeric cursor
returns `400`.

## CSV export

"Export CSV" walks every cursor page for the current filters and downloads one
file, so the export matches the filtered set, not just the loaded rows.
