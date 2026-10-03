/* Run the Dreamcast data dump as CommonJS. The repo root package.json marks
   every .js file as a module, and that dump is CommonJS. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.resolve(__dirname, "../../dreamcast/tools");
const script = fs.readFileSync(path.join(dir, "dump_game_data.js"), "utf8");
const sandbox = {
    require,
    process,
    console,
    Buffer,
    __dirname: dir,
    __filename: path.join(dir, "dump_game_data.js"),
    module: { exports: {} },
    exports: {},
};
vm.createContext(sandbox);
vm.runInContext(script, sandbox, { filename: sandbox.__filename });
