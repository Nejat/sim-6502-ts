import {} from "./types/global.d.ts";
import {initialize_definitions} from "./definitions/index.ts";
import {go, load_program} from "./macros.ts";
import {setup_simulation} from "./setup_simulation.ts";
import {test_program, test_program_address} from "./test_program.ts";

initialize_definitions();
setup_simulation();
load_program(test_program, test_program_address);

console.log('ready!\n');

go(1000, true);
