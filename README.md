# KV-Viewer 📺
A web interface for inspecting your DenoKV databases.

```
$ PORT=3000 DENO_KV_PATH=./kv deno run --unstable -A https://deno.land/x/kvviewer@v0.0.1/main.ts
```


## Features
1. [x] Get entry by exact key
2. [x] List entries by prefix
3. [ ] List entries by start & end
4. [x] Delete entry
5. [ ] Update single entry (json only)
6. [ ] Set expiration date
7. [ ] Rename single entry
8. [ ] Inspect queues

- [x] Run using a single `deno run https://...` command, or via compiled standalone executable
- [x] Connect with remote database using env vars
- [ ] Embedding into other backends (`/admin/kv` for example)
  - `Oak.handle`
- [ ] Authentication


## License
MIT.