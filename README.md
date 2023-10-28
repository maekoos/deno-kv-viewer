## Requirements:

1. [x] Get single value by exact key
2. [x] List entries by prefix
3. [ ] List entries by start & end
4. [x] Delete entry
5. [ ] Update single value (to json - no complex javascript objects)

- [x] Must be able to run using `deno run https://.....` (or similar)
  - [x] Must be compilable into a single executable
- [x] Connect with backend using env or args (both file and remote, with access token if necessary)


### Maybe in the future:

1. [ ] Queues
2. [ ] Expiration date
3. [ ] Scripting? (`update itm.x+=1 on all itm.y=5 and prefix=['hello']`)
4. [ ] Set to javascript objects - not just json

- [ ] Embedding into other backends (`/admin/kv`)
  - `Oak.handle`
- [ ] Authentication


