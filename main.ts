import "./types/global.d.ts";
import {console_writer, debug_writer, read_json} from "./utilities/index.ts";
import {CPU6502Builder} from "./simulator/6502/builder.ts";

const run_nmi = Deno.args[0] == "nmi";

const net_list_6502_file = 'definitions/6502/net_list.json';
const op_codes_6502_file = 'definitions/6502/op_codes.json';
const debug_output_file = run_nmi ? "debug_output_nmi_cpu_test.txt" : "debug_output_states.txt";

const trace = true;
const state_changes = false;
//const trace_nodes = trace ? true : false;
//const trace_nodes = trace ? [89, 103, 159, 958, 1171, 1297, 1672] : false;
const trace_nodes = trace ? [1393] : false;

const debug = run_nmi || (!trace && !state_changes) ? undefined : await debug_writer(debug_output_file);
const console_debug = run_nmi ? undefined : console_writer();

const on_trace = run_nmi || !trace || debug === undefined
    ? undefined
    : async (trace: string) => await debug(trace);

const on_state_change = run_nmi || !state_changes || debug === undefined
    ? undefined
    : async (message: Internals) => await debug(JSON.stringify(message.logged));

const on_trigger = run_nmi || console_debug === undefined ?
    undefined
    : async (trigger: TriggerMessage) => await console_debug(`${trigger.output}\r`);

const cpu_6502 = await new CPU6502Builder()
    .load_net_list(net_list_6502_file)
    .then(builder => builder.load_op_codes(op_codes_6502_file))
    .then(builder => trace ? builder.trace_nodes(trace_nodes) : builder)
    .then(builder => builder.trace_transistors(trace))
    .then(builder => builder.build(on_trace, on_state_change, on_trigger));

if (run_nmi) {
    const nmi_cpu_test_6502_file = 'programs/6502/nmi_cpu_test.json';
    const nmi_cpu_test_6502 = await read_json<CPUTest>(nmi_cpu_test_6502_file);

    cpu_6502.test_cpu(nmi_cpu_test_6502);
    cpu_6502.memory.dump_memory();
} else {
    const test_program_6502_file = 'programs/6502/test_program.json';
    const test_program_6502 = await read_json<Code>(test_program_6502_file);

    cpu_6502.load_program(test_program_6502);
    cpu_6502.go(0);
}

if (console_debug !== undefined) {
    await console_debug('\n');
}
