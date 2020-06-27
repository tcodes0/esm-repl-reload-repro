# Decache esm node code reload repro

1. clone this repo
- ensure you have yarn installed
2. run `yarn`
3. run `yarn repl`

expect to see repl:
``` shell
~> yarn repl
yarn run v1.22.4
$ yarn workspace @zet/repl start
$ node --loader ts-node/esm --experimental-specifier-resolution=node --experimental-top-level-await --no-warnings index.ts --transpile-only -r tsconfig-paths/register index.ts
> { 'decache reloading module': '@zet/stuff' }

INFO: Welcome to the REPL
      .help 		 see commands
      global.watchers 	 auto-reload watchers, if you need them
      global.s 		 saves results, also unwraps promises. Aliases: save
      global.__ 	 last saved result
      global.__h 	 history of all saved results. Aliases: __history
      .lastReload 	 last reload status
      .r 		 reload manually
      .e or .exit 	 leave :(
      .c 		 See available code on context
      global.stuff 	 stuff package


>
```

4. type `stuff` hit enter, expect to see this
```
> stuff
[Module] {
  description: 'bar'
}
```

5. modify `packages/stuff/index.ts` in some way, like changing `description` export to another string, like `foo`.
- `{ 'decache reloading module': '@zet/stuff' }` will print, meaning the file change was picked up.
6. type `stuff` hit enter, expect to see this (same as before)
```
> stuff
[Module] {
  description: 'bar'
}
```

## Wanted description to have value `foo` after reload event, but it had same value.

Check branch `working` and retry these steps to see it working.