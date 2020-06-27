import decache from "decache";
import { watch, FSWatcher } from "fs";
import REPL from "repl";

type JSObject<Value = any> = Record<string, Value>;
type ReloadConfig = { newline?: boolean };

const AUTO_RELOAD = true;
/**
 * path to the main module you'll be developing and reloading.
 * [0] path
 * [1] lib
 * [2] contextKey
 * [3] greeting
 */
const CONFIG = [
  ["../stuff", "@zet/stuff", "stuff", "global.stuff \t stuff package"],
];
let lastReload = { ok: true, error: null };
const prompt = `> `;
process.env.NODE_ENV = "REPL";

/**
 * Instantiate REPL, define prompt
 */
const tsRepl = REPL.start({
  prompt,
  replMode: REPL.REPL_MODE_STRICT,
});

/**
 * Wrapper on console.log for manipulating REPL output before printing
 */
const print = function (this: REPL.REPLServer, message: string | string[]) {
  /**
   * Repl is available as 'this'.
   * use console.log to print messages, end with this.write('\n') to avoid the cursor being stuck.
   */
  let padding = "      ";
  let prefix = "\nINFO: ";
  if (typeof message === "string") {
    console.log(`${padding}${prefix}${message}`);
  } else {
    let output = `${padding}${prefix}`;
    for (const line of message) {
      output += line + "\n" + padding;
    }
    console.log(output);
  }
  this.write("\n");
  return;
};

/**
 * Curried function that reloads a module the REPL imports.
 * Used by auto-reloading
 */
const reload = function (
  repl: REPL.REPLServer,
  modulePath: string,
  contextKey: string,
  config: ReloadConfig = {}
) {
  /**
   * unload the module
   */
  console.log({ 'decache reloading module': modulePath })
  decache(modulePath);
  /**
   * reload module, this may throw.
   * It normally throws because you didn't finish typing and the code reloaded
   * leaving it with broken syntax
   */
  // console.log({ reload: { contextKey, modulePath } })
  import(modulePath)
    .then((module) => {
      repl.context[contextKey] = module;
    })
    .catch((error) => {
      /**
       * set the lastReload object to fail state
       * capture error to inspection if desired
       * "why isn't my code reloading"?
       * maybe it is, just has an error!
       */
      lastReload.ok = false;
      lastReload.error = error;
    });
  /**
   * kindaof a hack. Some use cases use newline, other don't.
   * nice refactor opportunity
   */
  if (config.newline) {
    repl.write("\n");
  }
  /**
   * set the lastRelaod object to success state
   */
  lastReload.ok = true;
  lastReload.error = null;
};

const greetings = ["Welcome to the REPL", ".help \t\t see commands"];

/**
 * reload all modules in REPL
 */
function reloadAll(
  repl: REPL.REPLServer,
  input?: string,
  config?: ReloadConfig
) {
  if (input) {
    print.call(repl, "Reload global.Zet code");
    return;
  }
  CONFIG.forEach(([_path, lib, contextKey, greeting]) => {
    if (!greetings.includes(greeting)) {
      greetings.push(greeting);
    }
    reload(tsRepl, lib, contextKey);
  });
  if (config?.newline) {
    tsRepl.write("\n");
  }
}

if (AUTO_RELOAD) {
  /**
   * create a filesystem watcher on the given path
   * currently only handles one path, maybe expand to array of paths in the future?
   */
  var watchers = CONFIG.reduce<JSObject<FSWatcher>>(
    (acc, [path, lib, contextKey]) => {
      if (!acc[lib]) {
        acc[lib] = watch(path, { recursive: true }, (_event, _filename) => {
          // console.log({ watcher: { _event, _filename, lib, contextKey } })
          reload(tsRepl, lib, contextKey);
        });
      }
      return acc;
    },
    {}
  );

  /**
   * push watchers into context to allow inspection/manipulation
   */
  tsRepl.context.watchers = watchers;
  greetings.push("global.watchers \t auto-reload watchers, if you need them");
  /**
   * w helper to unwrap promises
   */
  tsRepl.context.__history = tsRepl.context.__h = [];
  tsRepl.context.__ = "nothing here yet!";
  tsRepl.context.save = tsRepl.context.s = function save<T = any>(
    prom: Promise<T> | unknown
  ) {
    const _save = (result) => {
      tsRepl.context.__history.push(result);
      tsRepl.context.__ = result;
    };
    /**
     * save falsey input as is
     */
    if (!prom) {
      return _save(prom);
    }
    /**
     * save non promises as is
     */
    if (!(prom as JSObject).then) {
      _save(prom);
      /**
       * unwrap promises, save result
       */
    } else {
      (prom as Promise<T>).then(_save).catch(_save);
    }
  };
  greetings.push(
    "global.s \t\t saves results, also unwraps promises. Aliases: save"
  );
  greetings.push("global.__ \t last saved result");
  greetings.push(
    "global.__h \t history of all saved results. Aliases: __history"
  );
  /**
   * defines lastReload command to inspect last reload state, if failed or succeeded
   */
  tsRepl.defineCommand("lastReload", {
    help: "Check reload Status",
    action: function () {
      console.log(lastReload);
      this.write("\n");
    },
  });
  greetings.push(".lastReload \t last reload status");
}

tsRepl.on("exit", () => {
  /**
   * exit trap. Do any cleanup here.
   */
  console.log("Bye :)");
  tsRepl.write("\n");
  process.nextTick(() => {
    process.exit(0);
  });
});
/**
 * careful here to use a unique file path
 */
tsRepl.setupHistory(
  `${process.env.HOME}/.zet_repl_node_history`,
  (err) => err && print.call(tsRepl, ["Repl history error:", err.message])
);
/**
 * normally not used but manual reload exposed just in case anyway.
 * use with .r
 */
tsRepl.defineCommand("r", {
  help: "Reload Zet",
  action: (input) => reloadAll(tsRepl, input, { newline: true }),
});
greetings.push(".r \t\t reload manually");
/**
 * quick exit
 * use with .e
 */
tsRepl.defineCommand("e", {
  help: "Exit Repl",
  action: tsRepl.close,
});
greetings.push(".e or .exit \t leave :(");
/**
 * see available code on context
 * use with .c
 */
tsRepl.defineCommand("c", {
  help: "See available code on context",
  action: (_input) => {
    const message = CONFIG.map((c) => c[3]);
    print.call(tsRepl, message);
  },
});
greetings.push(".c \t\t See available code on context");

reloadAll(tsRepl);

print.call(tsRepl, greetings);
