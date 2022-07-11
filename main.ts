import "./types/global.d.ts";
import {CPU6502} from "./simulator/6502/cpu.ts";
import {InternalState6502} from "./simulator/6502/internal_state.ts";
import {Circuit} from "./simulator/circuit.ts";
import {InstructionDecoder} from "./simulator/instruction_decoder.ts";
import {Memory} from "./simulator/memory.ts";
import {debug_writer, read_json} from "./utilities/index.ts";

const debug_output_file = "debug_output_states.txt";
//const debug_output_file = "debug_output_nmi_cpu_test.txt";
const net_list_6502_file = 'definitions/6502/net_list.json';
// https://masswerk.at/6502/6502_instruction_set.html
const op_codes_6502_file = 'definitions/6502/op_codes.json';
const test_program_6502_file = 'programs/6502/test_program.json';
//const nmi_cpu_test_6502_file = 'programs/6502/nmi_cpu_test.json';

const debug: DebugOutput = await debug_writer(debug_output_file);

//const_on_trace = async (trace: string) => await debug(trace);
const on_state_change = async (message: Internals) => await debug(JSON.stringify(message.logged));
const on_trigger = async (trigger: TriggerMessage) => await debug(trigger.output);

const net_list_6502 = await read_json<NetList>(net_list_6502_file);
const circuit_6502 = new Circuit(net_list_6502, /*on_trace*/);
const op_codes_6502 = await read_json<string[]>(op_codes_6502_file);
const decoder = new InstructionDecoder(op_codes_6502);
const internals = new InternalState6502(circuit_6502, decoder, on_state_change);
const memory = new Memory();
const test_program_6502 = await read_json<Code>(test_program_6502_file);
//const nmi_cpu_test_6502 = await read_json<CPUTest>(nmi_cpu_test_6502_file);

const cpu_6502: CPU6502 = new CPU6502(circuit_6502, memory, internals, on_trigger);

//cpu_6502.test_cpu(nmi_cpu_test_6502);
cpu_6502.load_program(test_program_6502);
cpu_6502.go(500);
