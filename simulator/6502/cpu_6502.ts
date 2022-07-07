import "../../types/global.d.ts";
import {Memory} from "../memory.ts";
import {Circuit} from "../circuit.ts";
import {InternalState6502} from "./internal_state_6502.ts";
import {hex_word} from "../../utilities/index.ts";

const data_bus = ['db0', 'db1', 'db2', 'db3', 'db4', 'db5', 'db6', 'db7'];

export class CPU6502 {
    private readonly circuit: Circuit;
    private readonly memory: Memory;
    private readonly name = '6502';
    private trace: Trace[] = [];
    private readonly internals: InternalState6502;

    // triggers for breakpoints, watchpoints, input pin events
    // almost always are undefined when tested, so minimal impact on performance    private clock_triggers: Triggers = {};
    private clock_triggers: Triggers = {};
    private fetch_triggers: Triggers = {};
    private read_triggers: Triggers = {};
    private write_triggers: Triggers = {};

    // example instruction tracing triggers
    // fetch_triggers[0x20]='console.log('0x'+address_bus_read().toString(16)+': JSR');';
    // fetch_triggers[0x60]='console.log('0x'+address_bus_read().toString(16)+': RTS');';
    // fetch_triggers[0x4c]='console.log('0x'+address_bus_read().toString(16)+': JMP');';

    private cycle = 0;
    private initialized = false;
    private output = '';
    private running = false;

    constructor(
        circuit: Circuit,
        memory: Memory,
        internals: InternalState6502,
    ) {
        this.circuit = circuit;
        this.memory = memory;
        this.internals = internals;

        this.initialized = false;
        this.running = false;
    }

    go(steps: number | undefined = undefined): void {
        if (!this.initialized) {
            this.init_chip();
        }

        this.running = true;

        while (this.running) {
            if (steps !== undefined) {
                if (--steps === 0) {
                    this.running = false;
                    steps = undefined;
                }
            }

            if (this.running) {
                this.step();
            }
        }
    }

    // run for an extended number of cycles, with low overhead, for interactive programs or for benchmarking
    //    note: to run an interactive program, use a URL like
    // helper function: allows us to poll 'running' without resetting it when we're re-scheduled
    //noinspection JSUnusedGlobalSymbols
    go_for_n(steps: number) {
        while (steps > 0) {
            this.half_step();

            this.cycle++;
            steps--;
        }

        this.internals.hz_instantaneous(this.cycle);
        this.internals.log_chip_status(this.cycle, this.address_bus_read(), this.data_bus_read());

        this.running = false;
    }

    //noinspection JSUnusedGlobalSymbols
    go_until_sync() {
        this.half_step();

        while (
            !this.circuit.is_named_node_high('sync') ||
            this.circuit.is_named_node_high('clk0')
            ) {
            this.half_step();
        }
    }

    //noinspection JSUnusedGlobalSymbols
    go_until_sync_or_write() {
        this.half_step();

        this.cycle++;

        while (
            !this.circuit.is_named_node_high('clk0') ||
            (!this.circuit.is_named_node_high('sync') &&
                this.circuit.is_named_node_high('rw'))
            ) {
            this.half_step();

            this.cycle++;
        }

        this.internals.log_chip_status(this.cycle, this.address_bus_read(), this.data_bus_read());
    }

    load_program(executable: Code) {
        console.log('\nloading program to address:', hex_word(executable.address));

        this.memory.clear();

        this.clock_triggers = {};
        this.fetch_triggers = {};
        this.read_triggers = {};
        this.write_triggers = {};

        // a moderate size of static test_program might be loaded
        for (const idx in executable.code) {
            const offset = parseInt(idx);
            this.memory.write(executable.address + offset, executable.code[offset]);
        }

        if (executable.clock_triggers !== undefined) {
            for (const idx in executable.clock_triggers) {
                this.clock_triggers[idx] = executable.clock_triggers[idx];
            }
        }

        if (executable.fetch_triggers !== undefined) {
            for (const idx in executable.fetch_triggers) {
                this.fetch_triggers[idx] = executable.fetch_triggers[idx];
            }
        }

        if (executable.read_triggers !== undefined) {
            for (const idx in executable.read_triggers) {
                this.read_triggers[idx] = executable.read_triggers[idx];
            }
        }

        if (executable.write_triggers !== undefined) {
            for (const idx in executable.write_triggers) {
                this.write_triggers[idx] = executable.write_triggers[idx];
            }
        }

        this.memory.dump_memory();

        // default reset vector will be 0x0000 because undefined memory reads as zero
        if (executable.user_reset_lo != undefined) {
            this.memory.write(0xfffc, executable.user_reset_lo);
        }

        if (executable.user_reset_hi != undefined) {
            this.memory.write(0xfffd, executable.user_reset_hi);
        }
    }

    //noinspection JSUnusedGlobalSymbols
    step_forward() {
        if (!this.initialized) {
            this.init_chip();
        }

        this.stop_chip();
        this.step();
    }

    //noinspection JSUnusedGlobalSymbols
    step_back() {
        if (this.cycle === 0) return;

        this.circuit.show_state(this.trace[--this.cycle].state);
        this.memory_set(this.trace[this.cycle].memory);

        const clk = this.circuit.is_named_node_high('clk0');

        if (!clk) {
            this.data_bus_write(this.memory.read(this.address_bus_read()));
        }

        this.internals.log_chip_status(this.cycle, this.address_bus_read(), this.data_bus_read());
    }

    //noinspection JSUnusedGlobalSymbols
    test_nmi(steps: number) {
        this.reset_chip();

        this.memory.write(0x0000, 0x38); // set carry
        this.memory.write(0x0001, 0x4c); // jump to test code
        this.memory.write(0x0002, 0x06);
        this.memory.write(0x0003, 0x23);

        this.memory.write(0x22ff, 0x38); // set carry
        this.memory.write(0x2300, 0xea);
        this.memory.write(0x2301, 0xea);
        this.memory.write(0x2302, 0xea);
        this.memory.write(0x2303, 0xea);
        this.memory.write(0x2304, 0xb0); // branch carry set to self
        this.memory.write(0x2305, 0xfe);

        this.memory.write(0x2306, 0xb0); // branch carry set to self
        this.memory.write(0x2307, 0x01);
        this.memory.write(0x2308, 0x00); // brk should be skipped
        this.memory.write(0x2309, 0xa9); // anything
        this.memory.write(0x230a, 0xde); // anything
        this.memory.write(0x230b, 0xb0); // branch back with page crossing
        this.memory.write(0x230c, 0xf2);

        this.memory.write(0xc018, 0x40); // nmi handler

        this.memory.write(0xfffa, 0x18); // nmi vector
        this.memory.write(0xfffb, 0xc0);
        this.memory.write(0xfffc, 0x00); // reset vector
        this.memory.write(0xfffd, 0x00);

        for (let idx = 0; idx < steps; idx++) {
            this.step();
        }

        this.circuit.set_lo('nmi');
        this.internals.log_chip_status(this.cycle, this.address_bus_read(), this.data_bus_read());

        for (let idx = 0; idx < 8; idx++) {
            this.step();
        }

        this.circuit.set_hi('nmi');
        this.internals.log_chip_status(this.cycle, this.address_bus_read(), this.data_bus_read());

        for (let idx = 0; idx < 16; idx++) {
            this.step();
        }
    }

    private address_bus_read = (): number => this.circuit.read_bits('ab', 16);

    //noinspection JSUnusedLocalSymbols
    private _clk_nodes = (): number[] => this.circuit.get_nodes(943);

    private data_bus_read = (): number => this.circuit.read_bits('db', 8);

    private data_bus_write = (data: number) => this.circuit.write_bits(data, data_bus);

    private half_step() {
        const clk = this.circuit.is_named_node_high('clk0');

        if (clk) {
            this.circuit.set_lo('clk0');
            this.handle_bus_read();
        } else {
            this.circuit.set_hi('clk0');
            this.handle_bus_write();
        }

        eval(this.clock_triggers[this.cycle + 1]);  // pre-apply next tick's inputs now, so the updates are displayed
    }

    private handle_bus_read() {
        if (this.circuit.is_named_node_high('rw')) {
            const address = this.address_bus_read();
            let data = eval(this.read_triggers[address]);

            if (data === undefined) {
                data = this.memory.read(address);
            }

            if (this.circuit.is_named_node_high('sync')) {
                eval(this.fetch_triggers[data]);
            }

            this.data_bus_write(data);
        }
    }

    private handle_bus_write() {
        if (!this.circuit.is_named_node_high('rw')) {
            const address = this.address_bus_read();
            const data = this.data_bus_read();

            eval(this.write_triggers[address]);

            this.memory.write(address, data);
        }
    }

    private init_chip() {
        console.log('Initialize Chip ...\n');

        this.circuit.reset();

        this.circuit.set_lo('res');
        this.circuit.set_lo('clk0');
        this.circuit.set_hi('rdy');
        this.circuit.set_lo('so');
        this.circuit.set_hi('irq');
        this.circuit.set_hi('nmi');

        this.circuit.recalc_all_nodes();

        for (let idx = 0; idx < 8; idx++) {
            this.circuit.set_hi('clk0');
            this.circuit.set_lo('clk0');
        }

        this.circuit.set_hi('res');

        // avoid updating graphics and trace buffer before user code
        for (let idx = 0; idx < 18; idx++) {
            this.half_step();
        }

        this.output = '';
        this.cycle = 0;
        this.initialized = true;

        this.internals.setup_log_list(this.data_bus_read());
        this.internals.log_chip_status(this.cycle, this.address_bus_read(), this.data_bus_read());
    }

    private memory_get(): number[] {
        const data: number[] = [];

        for (let idx = 0; idx < 0x200; idx++) {
            data.push(this.memory.read(idx));
        }

        return data;
    }

    private memory_set(data: number[]) {
        for (let idx = 0; idx < 0x200; idx++) {
            this.memory.write(idx, data[idx]);
        }
    }

    private reset_chip() {
        this.initialized = false;
        console.log('resetting ' + this.name + '...');
        this.stop_chip();
        this.init_chip();
    }

    // simulate a single clock phase, updating trace and highlighting layout
    private step() {
        const state = this.circuit.state_string();
        const memory = this.memory_get();
        const trace: Trace = {state, memory};

        this.trace[this.cycle] = trace;
        this.internals.trace_step(trace)

        this.half_step();

        this.cycle++;

        this.internals.log_chip_status(this.cycle, this.address_bus_read(), this.data_bus_read());
    }

    private stop_chip = () => this.running = false;

}
