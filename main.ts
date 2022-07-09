import "./types/global.d.ts";
import {read_json} from "./utilities/index.ts";
import {Circuit} from "./simulator/circuit.ts";
import {CPU6502} from "./simulator/6502/cpu_6502.ts";
import {Memory} from "./simulator/memory.ts";
import {InternalState6502} from "./simulator/6502/internal_state_6502.ts";
import {Disassembler6502} from "./simulator/6502/disassembler_6502.ts";

import {writeAll} from "https://deno.land/std/streams/conversion.ts";
import {exists} from "https://deno.land/std/fs/mod.ts"

const debug_folder = "debugging";

if (!exists(debug_folder)) {
    await Deno.mkdir(debug_folder);
}

const debug_output = await Deno.create(`${debug_folder}/debug_output_states.txt`);
const encoder = new TextEncoder();

//noinspection JSUnusedLocalSymbols
const on_trace = async (trace: string) => await writeAll(debug_output, encoder.encode(trace));
const on_state_change = async (message: Internals) => await writeAll(debug_output, encoder.encode(`${JSON.stringify(message.logged)}\n`));
const on_trigger = async (trigger: TriggerMessage) => await writeAll(debug_output, encoder.encode(trigger.output));

const net_list_6502 = await read_json<NetList>('definitions/net_list_6502.json');
const circuit = new Circuit(net_list_6502, /*on_trace*/);
const memory = new Memory();
const disassembler = new Disassembler6502(memory);
const tracer = new InternalState6502(circuit, disassembler, on_state_change);
const cpu_6502: CPU6502 = new CPU6502(circuit, memory, tracer, on_trigger);
const test_program = await read_json<Code>('programs/6502/test_program.json');

cpu_6502.load_program(test_program);
cpu_6502.go(500);
