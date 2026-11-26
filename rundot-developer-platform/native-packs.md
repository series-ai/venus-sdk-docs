# Native Packs (Retired)

Native pack builds have been retired. The `pack preflight`, `pack submit`, and
`pack status` commands remain available to return a retirement error. They do
not compile, upload, or queue a build. Each command returns exit code 1.

With `--json`, stdout contains one error object and stderr is empty:

```json
{"code":"KINETIX_PACK_RETIRED","error":"Native pack builds have been retired."}
```

Without `--json`, the command writes the message to stderr. Existing command
options remain accepted. These commands do not require login, Git, Node.js,
or a game project.

The server pack routes keep their existing authorization and rate limits.
Authorized requests return HTTP 410 with the same error object and
`Cache-Control: no-store`. Unauthorized requests keep their authorization
errors.

Syncplay runtime APIs and published compiler exports remain unchanged. The
hosted pack build service is retired.
