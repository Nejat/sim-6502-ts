import "../../types/global.d.ts";
import {Circuit} from "../circuit.ts";
import {Disassembler} from "../disassembler.ts";
import {StateType} from "../internals.ts";
import {hex_byte, hex_word, now} from "../../utilities/index.ts";
import {Disassembler6502} from "./disassembler_6502.ts";

export class InternalState6502 {
    //noinspection JSUnusedGlobalSymbols
    static readonly log_list_padding: Padding = {
        cycle: 5,
        ab: 4,
        db: 2,
        rw: 2,
        Fetch: 10,
        pc: 4,
        a: 2,
        x: 2,
        y: 2,
        s: 2,
        p: 8,
        Execute: 7,
        State: 5,
        ir: 2,
        tcstate: 7,
        '-pd': 3,
        adl: 3,
        adh: 3,
        sb: 2,
        alu: 3,
        alucin: 6,
        alua: 4,
        alub: 4,
        alucout: 7,
        aluvout: 7,
        dasb: 4,
        plaOutputs: 10,
        DPControl: 9,
        idb: 3,
        dor: 3,
        irq: 3,
        nmi: 3,
        res: 3
    };

    private readonly circuit: Circuit;
    private readonly disassembler: Disassembler;
    private readonly expert_mode: boolean;
    private readonly log_level: number;
    private readonly golden_check_sum: (string | undefined);
    private readonly on_state_change?: OnStateChange;
    private readonly log_list_preset: string[][] = [
        ['cycle'],
        ['ab', 'db', 'rw', 'Fetch', 'pc', 'a', 'x', 'y', 's', 'p'],
        ['Execute', 'State'],
        ['ir', 'tcstate', '-pd'],
        ['adl', 'adh', 'sb', 'alu'],
        ['alucin', 'alua', 'alub', 'alucout', 'aluvout', 'dasb'],
        ['plaOutputs', 'DPControl'],
        ['idb', 'dor'],
        ['irq', 'nmi', 'res'],
    ];

    private hz_sampling_rate = 10;
    private log_these: string[] = [];
    private prev_hz_timestamp = 0;
    private prev_hz_cycle_count = 0;
    private prev_hz_estimate1 = 1;
    private prev_hz_estimate2 = 1;
    private trace_check_sum = '';

    constructor(
        circuit: Circuit,
        disassembler: Disassembler6502,
        on_state_change?: OnStateChange,
        log_level = 2
    ) {
        this.on_state_change = on_state_change;
        this.expert_mode = log_level > 1;
        this.log_level = log_level;
        this.circuit = circuit;
        this.disassembler = disassembler;
        this.golden_check_sum = undefined;
    }

    private static adler32(x: string) {
        let lo = 1;
        let hi = 0;

        for (let idx = 0; idx < x.length; idx++) {
            lo = (lo + x.charCodeAt(idx)) % 65521;
            hi = (hi + lo) % 65521;
        }

        return (0x100000000 + (hi << 16) + lo).toString(16).slice(-8);
    }

    log_chip_status(cycle: number, address_bus: number, data_bus: number) {
        if (this.on_state_change === undefined) return;

        const logged: Logged = {
            'halfcyc': cycle,
            'phi0': this.circuit.read_bit('clk0'),
            'AB': hex_word(address_bus),
            'D': hex_byte(data_bus),
            'RnW:': this.circuit.read_bit('rw'),
            'PC': hex_word(this.read_program_counter()),
            'A': hex_byte(this.read_accumulator()),
            'X': hex_byte(this.read_index_x()),
            'Y': hex_byte(this.read_index_y()),
            'SP': hex_byte(this.read_stack_pointer()),
            'FLGS': this.read_p_string(),
            'Hz': this.hz_estimate(cycle).toFixed(1),
        }

        if (this.expert_mode) {
            logged['Exec'] = this.bus_to_string(cycle, 'Execute', data_bus) + '(' + this.bus_to_string(cycle, 'State', data_bus) + ')';

            if (this.circuit.is_named_node_high('sync')) {
                logged['Fetch'] = this.bus_to_string(cycle, 'Fetch', data_bus);
            }

            if (this.golden_check_sum !== undefined) {
                logged['Chk'] = this.trace_check_sum + ((this.trace_check_sum === this.golden_check_sum) ? ' OK' : ' no match');
            }
        }

        this.on_state_change({type: StateType.Trace, logged})

        this.log_signals(cycle, this.log_these, data_bus);
    }

    // return instantaneous speed: called twice, before and after a timed run using go_for()
    hz_instantaneous(cycle: number): number {
        const hz_timestamp: number = now();

        this.prev_hz_estimate1 = ((cycle - this.prev_hz_cycle_count + .01) / (hz_timestamp - this.prev_hz_timestamp + .01)) * 1000 / 2;
        this.prev_hz_estimate2 = this.prev_hz_estimate1;
        this.prev_hz_timestamp = hz_timestamp;
        this.prev_hz_cycle_count = cycle;

        return this.prev_hz_estimate1;
    }

    // return an averaged speed: called periodically during normal running
    hz_estimate(cycle: number): number {
        if (cycle % this.hz_sampling_rate !== 3) return this.prev_hz_estimate1;

        const hz_timestamp: number = now();

        let hz_estimate = (cycle - this.prev_hz_cycle_count + .01) / (hz_timestamp - this.prev_hz_timestamp + .01);

        hz_estimate = hz_estimate * 1000 / 2; // convert from phases per millisecond to Hz

        if (hz_estimate < 5) {
            this.hz_sampling_rate = 5;  // quicker
        }

        if (hz_estimate > 10) {
            this.hz_sampling_rate = 10; // smoother
        }

        this.prev_hz_estimate2 = this.prev_hz_estimate1;
        this.prev_hz_estimate1 = (hz_estimate + this.prev_hz_estimate1 + this.prev_hz_estimate2) / 3; // wrong way to average speeds
        this.prev_hz_timestamp = hz_timestamp;
        this.prev_hz_cycle_count = cycle;

        return this.prev_hz_estimate1;
    }

    trace_step(trace: Trace) {
        if (this.golden_check_sum !== undefined) {
            this.trace_check_sum = InternalState6502.adler32(this.trace_check_sum + trace.state + trace.memory.slice(0, 511).toString());
        }
    }

    setup_log_list(data_bus: number, names = '') {
        if (this.expert_mode) {
            this.update_log_list(data_bus, names);
        }
    }

    // Show all time code node states (active and inactive) in fixed format,
    // with non-PLA-controlling internal state indication in square
    // brackets, followed by RCL-resident timing state indication.
    // '..' for a PLA-controlling node indicates inactive state, "T"* for a
    // PLA-controlling node indicates active state.
    // Bracketed codes are one of T1/V0/T6/..
    // V0 indicates the VEC0 node, T6 is a synonym for the VEC1 node.
    // The RCL codes are one of SD1/SD2/...
    // For discussion of this reconstruction, see:

    // http://visual6502.org/wiki/index.php?title=6502_Timing_States
    private all_tc_states(): string {
        const spc = ' ';
        let states = '';

        states += (!this.circuit.is_named_node_high('clock1')) ? 'T0' : '..';
        states += spc;

        // T+ in visual6502 is called T1x in
        // http://www.weihenstephan.org/~michaste/pagetable/6502/6502.jpg
        // Notated as T+ for compatibility with PLA node names

        states += !this.circuit.is_named_node_high('clock2') ? 'T+' : '..';
        states += spc;
        states += !this.circuit.is_named_node_high('t2') ? '..' : '..';
        states += spc;
        states += !this.circuit.is_named_node_high('t3') ? '..' : '..';
        states += spc;
        states += !this.circuit.is_named_node_high('t4') ? '..' : '..';
        states += spc;
        states += !this.circuit.is_named_node_high('t5') ? '..' : '..';
        states += spc + '[';

        // Check three confirmed exclusive states (three nodes)
        if (this.circuit.is_node_high(862)) {
            states += '..';
            // ...else if VEC0 is on...
        } else if (this.circuit.is_named_node_high('VEC0')) {
            // ...then tell the outside world
            states += '..';
            // ...else if VEC1 is on...
        } else if (this.circuit.is_named_node_high('VEC1')) {
            // ...then this is the canonical T6. It is a synonym for VEC1
            states += '..';
        } else {
            // ...else none of the "hidden" bits in the clock state is active
            states += '..';
        }

        states += ']' + spc;

        // Check the RCL' states two confirmed exclusive states (two net_list.nodes)
        // If this node is grounding ~WR...
        if (this.circuit.is_node_high(440)) {
            // ...then we can regard this state as Store Data 1
            states += 'SD1';
            // ...else if this node is grounding ~WR...
        } else if (this.circuit.is_node_high(1258)) {
            // ...then we can regard this state as Store Data 2
            states += 'SD2';
        } else {
            // ...else none of the RCL-resident timing bits is active
            states += '...';
        }

        return states;
    }

    private bus_to_string(cycle: number, bus_name: string, data_bus: number): (string | string[] | number) {
        // takes a signal name or prefix
        // returns an appropriate string representation
        // some 'signal names' are Cpu_6502-specific aliases to user-friendly string output
        if (bus_name === 'cycle') return (cycle >> 1);
        if (bus_name === 'pc') return this.circuit.bus_to_hex('pch') + this.circuit.bus_to_hex('pcl');
        if (bus_name === 'p') return this.read_p_string();
        if (bus_name === 'tcstate') return [['clock1', 'clock2', 't2', 't3', 't4', 't5'].map(this.circuit.bus_to_hex).join('')];
        if (bus_name === 'State') return this.list_active_tc_states();
        if (bus_name === 'TState') return this.all_tc_states();
        if (bus_name === 'Phi')
            // Pretty-printed phase indication based on the state of cp1,
            // the internal Phase 1 node
            return '&Phi;' + (this.circuit.is_named_node_high('cp1') ? '1' : '2');
        if (bus_name === 'Execute') return this.disassembler.disassemble(this.circuit.read_bits('ir', 8));
        if (bus_name === 'Fetch') return this.circuit.is_named_node_high('sync') ? this.disassembler.disassemble(data_bus) : '';
        // PLA outputs are mostly ^op- but some have a prefix too
        //    - we'll allow the x and xx prefix but ignore the #
        if (bus_name === 'plaOutputs') return this.circuit.active_signals('^([x]?x-)?op-');
        if (bus_name === 'DPControl') return this.circuit.active_signals('^dpc[-]?[0-9]+_');
        if (bus_name[0] === '-') {
            // invert the value of the bus for display
            const value = this.circuit.bus_to_hex(bus_name.slice(1));

            return value !== undefined ? value.replace(/./g, x => (15 - parseInt(x, 16)).toString(16)) : '';
        } else {
            return this.circuit.bus_to_hex(bus_name);
        }
    }

    // The 6502 TCState is almost but not quite an inverted one-hot shift register
    private list_active_tc_states(): string {
        const states: string[] = [];

        if (!this.circuit.is_named_node_high('clock1')) states.push('T0');
        if (!this.circuit.is_named_node_high('clock2')) states.push('T1');
        if (!this.circuit.is_named_node_high('t2')) states.push('T2');
        if (!this.circuit.is_named_node_high('t3')) states.push('T3');
        if (!this.circuit.is_named_node_high('t4')) states.push('T4');
        if (!this.circuit.is_named_node_high('t5')) states.push('T5');

        return states.join('+');
    }

    // update the table of signal values, by prepending or appending
    private log_signals(cycle: number, names: string[], data_bus: number) {
        if (this.log_these.length < 2 || this.on_state_change === undefined) return;

        const logged: Logged = {};

        for (const name in names) {
            const signal = names[name];
            logged[signal] = this.bus_to_string(cycle, signal, data_bus);
        }

        this.on_state_change?.({type: StateType.Signals, logged});
    }

    private read_accumulator = (): number => this.circuit.read_bits('a', 8);

    private read_index_x = (): number => this.circuit.read_bits('x', 8);

    private read_index_y = (): number => this.circuit.read_bits('y', 8);

    private read_p_string = (): string => (this.circuit.is_named_node_high('p7') ? 'N' : 'n') +
        (this.circuit.is_named_node_high('p6') ? 'V' : 'v') + '-' +
        (this.circuit.is_named_node_high('p4') ? 'B' : 'b') +
        (this.circuit.is_named_node_high('p3') ? 'D' : 'd') +
        (this.circuit.is_named_node_high('p2') ? 'I' : 'idx') +
        (this.circuit.is_named_node_high('p1') ? 'Z' : 'z') +
        (this.circuit.is_named_node_high('p0') ? 'C' : 'c');

    private read_program_counter = (): number => (this.circuit.read_bits('pch', 8) << 8) + this.circuit.read_bits('pcl', 8);

//    private _read_program_counter_hi = (): number => this.circuit.read_bits('pch', 8);

//    private _read_program_counter_low = (): number => this.circuit.read_bits('pcl', 8);

    private read_stack_pointer = () => this.circuit.read_bits('s', 8);

    private signal_set(level: number): string[] {
        const signals: string[] = [];

        for (let idx = 0; (idx <= level) && (idx < this.log_list_preset.length); idx++) {
            for (let j = 0; j < this.log_list_preset[idx].length; j++) {
                signals.push(this.log_list_preset[idx][j]);
            }
        }

        return signals;
    }

    private update_log_list(data_bus: number, names = '') {
        if (this.on_state_change === undefined) return;

        // user supplied a list of signals, which we append to the set defined by loglevel
        this.log_these = [];
        this.log_these.push(...this.signal_set(this.log_level));

        names = names.trim();

        if (names.length > 0) {
            const name_list = names.split(/[\s,]+/);

            for (let idx = 0; idx < name_list.length; idx++) {
                // could be a signal name, a node number, or a special name
                if (this.bus_to_string(0, name_list[idx], data_bus) !== undefined) {
                    this.log_these.push(name_list[idx]);
                }
            }
        }
    }
}