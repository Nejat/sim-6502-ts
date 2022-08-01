import {read_json} from "../../utilities/index.ts";
import {CPU6502} from "./cpu.ts";
import {Circuit} from "../circuit.ts";
import {InstructionDecoder} from "../instruction_decoder.ts";
import {InternalState6502} from "./internal_state.ts";
import {Memory} from "../memory.ts";

export class CPU6502Builder {
    private net_list?: NetList;
    private op_codes?: string[];
    private log_level?: number;
    private code?: Code;
    private traced_nodes?: number[] | boolean;
    private traced_transistors?: number[] | boolean;

    build(on_trace?: OnTrace, on_state_change?: OnStateChange, on_trigger?: OnTrigger): CPU6502 {
        if (this.net_list === undefined || this.net_list == null) {
            throw new Error("You must provide a net list definition")
        }

        if (this.op_codes === undefined || this.op_codes == null) {
            throw new Error("You must provide op code definitions")
        }

        const circuit_6502 = new Circuit(this.net_list!, on_trace);

        if (this.traced_nodes !== undefined) {
            circuit_6502.trace_nodes(this.traced_nodes);
        }

        if (this.traced_transistors !== undefined) {
            circuit_6502.trace_transistors(this.traced_transistors);
        }

        const decoder = new InstructionDecoder(this.op_codes);
        const internals = new InternalState6502(circuit_6502, decoder, on_state_change)
        const memory = new Memory();

        return new CPU6502(circuit_6502, memory, internals, on_trigger);
    }

    async load_code(path: string): Promise<CPU6502Builder> {
        this.code = await read_json<Code>(path);

        return this;
    }

    async load_net_list(path: string): Promise<CPU6502Builder> {
        this.net_list = await read_json<NetList>(path);

        return this;
    }

    async load_op_codes(path: string): Promise<CPU6502Builder> {
        this.op_codes = await read_json<string[]>(path);

        return this;
    }

    trace_nodes(nodes: number[] | boolean): CPU6502Builder {
        this.traced_nodes = nodes;

        return this;
    }

    trace_transistors(transistors: number[] | boolean): CPU6502Builder {
        this.traced_transistors = transistors;

        return this;
    }

    with_code(code: Code): CPU6502Builder {
        this.code = code;

        return this;
    }

    with_log_level(log_level: number): CPU6502Builder {
        this.log_level = log_level;

        return this;
    }

    with_net_list(net_list: NetList): CPU6502Builder {
        this.net_list = net_list;

        return this;
    }

    with_op_codes(op_codes: string[]): CPU6502Builder {
        this.op_codes = op_codes

        return this;
    }
}