import "./types/global.d.ts";
import {debug_writer, read_json} from "./utilities/index.ts";
import {Circuit} from "./simulator/circuit.ts";
import {CPU6502} from "./simulator/6502/cpu_6502.ts";
import {Memory} from "./simulator/memory.ts";
import {InternalState6502} from "./simulator/6502/internal_state_6502.ts";
import {InstructionDecoder} from "./simulator/instruction_decoder.ts";

const debug_output_file = "debug_output_states.txt";
const net_list_6502_definition = 'definitions/6502/net_list.json';
// https://masswerk.at/6502/6502_instruction_set.html
const op_codes_6502_definitions = 'definitions/6502/op_codes.json';
const test_program_6502 = 'programs/6502/test_program.json';

const debug: DebugOutput = await debug_writer(debug_output_file);

//const_on_trace = async (trace: string) => await debug(trace);
const on_state_change = async (message: Internals) => await debug(JSON.stringify(message.logged));
const on_trigger = async (trigger: TriggerMessage) => await debug(trigger.output);

const net_list_6502 = await read_json<NetList>(net_list_6502_definition);
const circuit = new Circuit(net_list_6502, /*on_trace*/);
const op_codes_6502 = await read_json<NetList>(op_codes_6502_definitions);
const decoder = new InstructionDecoder(op_codes_6502);
const tracer = new InternalState6502(circuit, decoder, on_state_change);
const memory = new Memory();
const test_program = await read_json<Code>(test_program_6502);

const cpu_6502: CPU6502 = new CPU6502(circuit, memory, tracer, on_trigger);

cpu_6502.load_program(test_program);
cpu_6502.go(500);
