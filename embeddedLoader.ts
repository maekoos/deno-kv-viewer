import nunjucks from "npm:nunjucks";

import * as path from "https://deno.land/std@0.204.0/path/mod.ts";
import { getFile } from "./embedded.ts";

export const EmbeddedLoader = nunjucks.Loader.extend({
  resolve(from: string, to: string) {
    return path.join(path.dirname(from), to);
  },

  getSource: function (name: string) {
    const p = path.join("views", name);
    const f = getFile(p);
    if (!f) return null;

    const source = {
      src: f.text(),
      path: name,
    };
    this.emit("load", name, source);
    return source;
  },
});
