import "../types/global.d.ts";
import {codes} from "./codes.ts";
import {array_contains} from "../utilities/index.ts";
import {CircuitDebugger} from "./debugging.ts";

const sort_number = (a: number, b: number) => a - b;

export class Circuit {
    private readonly net_list: NetList;
    private readonly on_trace?: OnTrace;

    private group: number[] = [];
    private node_states: NetNodeStates = [];
    private recalc_list: number[] = [];
    private recalc_hash: RecalculateHash = {};
    private traced_nodes: number[] | boolean = false;
    private traced_transistors: number[] | boolean = false;
    private transistors: TransistorStates = [];

    constructor(net_list: NetList, on_trace?: OnTrace) {
        this.net_list = net_list;
        this.on_trace = on_trace;
    }

    // for one-hot or few-hot signal collections we want to list the active ones
    // and for brevity we remove the common prefix
    active_signals(pattern: string): string[] {
        const predicate = new RegExp(pattern);
        const signals: string[] = [];
        const net_list = this.net_list;

        for (const idx in net_list.node_name_list) {
            const node_name = net_list.node_name_list[idx];

            if (predicate.test(node_name)) {
                if (this.is_named_node_high(node_name)) {
                    // also map hyphen to a non-breaking version
                    signals.push(node_name.replace(predicate, '').replace(/-/g, '&#8209'));
                }
            }
        }

        return signals;
    }

    bus_to_hex(bus_name: string): string {
        // may be passed a bus or a signal, so allow multiple signals
        let width = 0;
        const node_name_check = new RegExp('^' + bus_name + '[0-9]+$');
        const net_list = this.net_list;

        for (const idx in net_list.node_name_list) {
            if (node_name_check.test(net_list.node_name_list[idx])) {
                width++;
            }
        }

        if (width === 0) {
            // not a bus, so could be a signal, a node number or a mistake
            if (net_list.node_names[bus_name] !== undefined) {
                return this.is_named_node_high(bus_name) ? '1' : '0';
            }

            const node = parseInt(bus_name);

            if ((!isNaN(node)) && (net_list.nodes[node] !== null && net_list.nodes[node] !== undefined)) {
                return this.is_node_high(node) ? '1' : '0';
            }

            return '';
        }

        if (width > 16) return '';

        // finally, convert from logic values to hex
        return (0x10000 + this.read_bits(bus_name, width)).toString(16).slice(-(width - 1) / 4 - 1);
    }

    //noinspection JSUnusedGlobalSymbols
    get_debugger = (): CircuitDebugger => new CircuitDebugger(this.node_states, this.transistors);

    get_nodes(source: (number | string)): number[] {
        const node_number = typeof source === "string" ? this.net_list.node_names[source as string] : source as number;
        const nodes: number[] = [];
        const net_list = this.net_list;

        nodes.push(node_number);

        const node = net_list.nodes[node_number];

        if (node === null) return nodes;

        for (const idx in node.gates) {
            const transistor_name: number = node!.gates[idx];
            const transistor = net_list.transistors[transistor_name];

            if (transistor.c1 === net_list.npwr) {
                nodes.push(transistor.c2);
            }

            if (transistor.c2 === net_list.npwr) {
                nodes.push(transistor.c1);
            }
        }

        return nodes;
    }

    is_named_node_high = (node: string): boolean => this.node_states[this.net_list.node_names[node]]!.state;

    is_node_high = (node_number: number): boolean => this.node_states[node_number]!.state;

    read_bit = (name: string): number => this.is_named_node_high(name) ? 1 : 0;

    read_bits(name: string, bit_count: number): number {
        let bits = 0;

        for (let idx = 0; idx < bit_count; idx++) {
            bits += ((this.is_named_node_high(`${name}${idx}`)) ? 1 : 0) << idx;
        }

        return bits;
    }

    reset() {
        const net_list = this.net_list;

        this.node_states.length = 0;
        this.transistors.length = 0;

        for (const node_number in net_list.nodes) {
            const net_node = net_list.nodes[node_number];

            if (net_node === null) {
                this.node_states[node_number] = null
                continue;
            }

            this.node_states[node_number] = {
                pull_up: net_node.pull_up,
                pull_down: false,
                state: false,
                float: true
            };
        }

        const vcc = net_list.nodes[net_list.ngnd]!;

        this.node_states[net_list.ngnd] = {
            pull_up: vcc.pull_up,
            pull_down: false,
            state: false,
            float: false
        };

        const vss = net_list.nodes[net_list.npwr]!;

        this.node_states[net_list.npwr] = {
            pull_up: vss.pull_up,
            pull_down: false,
            state: true,
            float: false
        };

        for (const idx in net_list.transistors) {
            this.transistors[idx] = false;
        }
    }

    recalc_all_nodes = () => this.recalc_node_list(this.all_nodes());

    set_hi(node_name: string): void {
        const node_number = this.net_list.node_names[node_name];
        const node_state = this.node_states[node_number]!;

        this.on_trace?.(`hi - ${node_number}: ${node_state.state ? '+' : '-'}${node_state.float ? '+' : '-'}${node_state.pull_up ? '+' : '-'}${node_state.pull_down ? '+' : '-'}`);

        node_state!.pull_up = true;
        node_state!.pull_down = false;

        this.on_trace?.(`hi - ${node_number}: ${node_state.state ? '+' : '-'}${node_state.float ? '+' : '-'}${node_state.pull_up ? '+' : '-'}${node_state.pull_down ? '+' : '-'}`);

        this.recalc_node_list([node_number]);
    }

    set_lo(node_name: string): void {
        const node_number = this.net_list.node_names[node_name];
        const node_state = this.node_states[node_number]!;

        this.on_trace?.(`lo - ${node_number}: ${node_state.state ? '+' : '-'}${node_state.float ? '+' : '-'}${node_state.pull_up ? '+' : '-'}${node_state.pull_down ? '+' : '-'}`);

        node_state.pull_up = false;
        node_state.pull_down = true;

        this.on_trace?.(`lo - ${node_number}: ${node_state.state ? '+' : '-'}${node_state.float ? '+' : '-'}${node_state.pull_up ? '+' : '-'}${node_state.pull_down ? '+' : '-'}`);

        this.recalc_node_list([node_number]);
    }

    show_state(state_value: string): void {
        for (let idx = 0; idx < state_value.length; idx++) {
            if (state_value[idx] === 'x') continue;

            const state = codes[state_value[idx]];

            this.node_states[idx]!.state = state;

            this.net_list.nodes[idx]!.gates
                .forEach((transistor_name: number) => {
                    this.transistors[transistor_name] = state;
                });
        }
    }

    state_string(): string {
        let state = '';
        const net_list = this.net_list;

        for (let idx = 0; idx < net_list.nodes.length; idx++) {
            const node = this.node_states[idx];

            if (node === null) {
                state += 'x';
            } else if (idx === net_list.ngnd) {
                state += 'g';
            } else if (idx === net_list.npwr) {
                state += 'v';
            } else {
                state += node.state ? 'h' : 'l';
            }
        }

        return state;
    }

    trace_nodes(nodes: number[] | boolean): void {
        this.traced_nodes = typeof nodes === "boolean" ? nodes : Object.assign([], nodes);
    }

    trace_transistors(transistors: number[] | boolean): void {
        this.traced_transistors = typeof transistors === "boolean" ? transistors : Object.assign([], transistors);
    }

    write_bits(data: number, nodes: string[]): void {
        const recalc_nodes: number[] = [];

        nodes.forEach(
            nd => {
                const node_number = this.net_list.node_names[nd];
                const node_state = this.node_states[node_number]!;

                this.on_trace?.(`write bits - ${node_number}: ${node_state.state ? '+' : '-'}${node_state.float ? '+' : '-'}${node_state.pull_up ? '+' : '-'}${node_state.pull_down ? '+' : '-'}`);

                if ((data % 2) === 0) {
                    node_state.pull_down = true;
                    node_state.pull_up = false;
                } else {
                    node_state.pull_down = false;
                    node_state.pull_up = true;
                }

                this.on_trace?.(`write bits - ${node_number}: ${node_state.state ? '+' : '-'}${node_state.float ? '+' : '-'}${node_state.pull_up ? '+' : '-'}${node_state.pull_down ? '+' : '-'}`);

                recalc_nodes.push(node_number);

                data >>= 1;
            }
        )

        this.on_trace?.(`write: ${JSON.stringify(recalc_nodes)}, data: ${data}`);

        this.recalc_node_list(recalc_nodes);
    }

    private all_nodes(): number[] {
        const all_nodes: number[] = [];
        const net_list = this.net_list;

        for (const idx in net_list.nodes) {
            if (this.net_list.nodes[idx] === null) continue;

            // Don't feed numeric strings to recalc_node_list(). Numeric
            // strings can cause a (data dependent) duplicate node number
            // hiccup when accumulating a node group's list, ie:
            // group => [ '49', 483, 49 ]
            const ii = parseInt(idx);

            if ((ii !== net_list.npwr) && (ii !== net_list.ngnd)) {
                all_nodes.push(ii);
            }
        }

        return all_nodes;
    }

    private add_node_to_group(node_number: number): void {
        if (this.group.indexOf(node_number) !== -1) return;

        this.group.push(node_number);

        const net_list = this.net_list;

        if (node_number === net_list.ngnd || node_number === net_list.npwr) return;

        net_list.nodes[node_number]!.c1c2s.forEach(
            (transistor_name: number) => {
                if (!this.transistors[transistor_name]) return;

                const transistor = net_list.transistors[transistor_name];

                let other: (number | undefined) = undefined;

                if (transistor.c1 === node_number) {
                    other = transistor.c2;
                }

                if (transistor.c2 === node_number) {
                    other = transistor.c1;
                }

                if (other !== undefined) {
                    this.add_node_to_group(other as number);
                }
            });
    }

    private add_recalc_node(node_number: number): void {
        const net_list = this.net_list;

        if (node_number === net_list.ngnd || node_number === net_list.npwr) return;

        if (this.recalc_hash[node_number]) return;

        this.recalc_list.push(node_number);

        this.recalc_hash[node_number] = true;

        const hash = [];

        for (const idx in this.recalc_hash) {
            hash.push(parseInt(idx));
        }

//        hash.sort(sort_number);

        const list: number[] = [];

        this.recalc_list.forEach(v => list.push(v));

//        list.sort(sort_number);

//        this.on_trace?(`${JSON.stringify(hash)} - ${JSON.stringify(list)}`);
    }

    private node_is_traced(node_number: number | number[]): boolean {
        if (typeof this.traced_nodes === "boolean") {
            return this.traced_nodes;
        } else if (typeof node_number === "number") {
            return  this.traced_nodes.indexOf(node_number) !== -1;
        } else {
            let idx: number;

            for (idx = 0; idx < this.traced_nodes.length; idx++) {
                if (node_number.indexOf(this.traced_nodes[idx]) !== -1) break;
            }

            return (this.traced_nodes.length > 0) || (node_number.indexOf(this.traced_nodes[idx]) !== -1);
        }
    }

    private recalc_node(node_number: number): void {
        const net_list = this.net_list;

        if (node_number === net_list.ngnd || node_number === net_list.npwr) return;

        this.get_node_group(node_number);

        const new_state: boolean = this.get_node_value();

        if (this.on_trace !== undefined && this.node_is_traced(node_number)) {
            this.on_trace(`recalc ${node_number} ${JSON.stringify(this.group)}`);
        }

        this.group.forEach((idx) => {
            const node: NetNode = net_list.nodes[idx]!;
            const node_state: NetNodeState = this.node_states[idx]!;

            if (node_state.state === new_state) return;

            node_state.state = new_state;

            node.gates.forEach((transistor_name: number) => {
                const transistor = net_list.transistors[transistor_name];

                node_state.state
                    ? this.turn_transistor_on(transistor)
                    : this.turn_transistor_off(transistor);
            });
        });
    }

    private recalc_node_list(node_list: number[]): void {
        const node_number: number = node_list[0];

        this.recalc_list.length = 0;
        this.recalc_hash = {};

        const debug = this.get_debugger();
        debug.reset();

        for (let iteration = 0; iteration < 100; iteration++) {		// loop limiter
            if (node_list.length === 0) {
                this.on_trace?.(`${debug.changes().transistors}`);
                return;
            }

            if (this.on_trace != null) {
                if (this.node_is_traced(node_list)) {
                    this.on_trace(`recalc node list iteration: ${iteration} ${node_list.length} nodes ${JSON.stringify(node_list)}`);
                } else {
                    this.on_trace(`recalc node list iteration: ${iteration} ${node_list.length} nodes`);
                }
            }

            node_list.forEach(nd => this.recalc_node(nd));

            node_list.length = 0;

            this.recalc_list.forEach(itm => node_list.push(itm));

            this.recalc_list.length = 0;
            this.recalc_hash = {};
        }

        this.on_trace?.(`${node_number} looping...`);
    }

    private transistor_is_traced = (transistor_name: number): boolean =>
        typeof this.traced_transistors === "boolean"
            ? this.traced_transistors
            : this.traced_transistors.indexOf(transistor_name) !== -1;

    private turn_transistor_on(transistor: Transistor): void {
        if (this.transistors[transistor.name]) return;

        if (this.on_trace != null && this.transistor_is_traced(transistor.name)) {
            this.on_trace(`On - Transistor { name: ${transistor.name}, gate: ${transistor.gate}, c1: ${transistor.c1}, c2: ${transistor.c2} }`);
        }

        this.transistors[transistor.name] = true;

        this.add_recalc_node(transistor.c1);
    }

    private turn_transistor_off(transistor: Transistor): void {
        if (!this.transistors[transistor.name]) return;

        if (this.on_trace != null && this.transistor_is_traced(transistor.name)) {
            this.on_trace(`Off - Transistor { name: ${transistor.name}, gate: ${transistor.gate}, c1: ${transistor.c1}, c2: ${transistor.c2} }`);
        }

        this.transistors[transistor.name] = false;

        this.add_recalc_node(transistor.c1);
        this.add_recalc_node(transistor.c2);
    }

    private get_node_group(node_number: number): void {
        this.group.length = 0;

        this.add_node_to_group(node_number);

        this.group.sort(sort_number);
    }

    private get_node_value(): boolean {
        const net_list = this.net_list;

        if (array_contains(this.group, net_list.ngnd)) return false;

        if (array_contains(this.group, net_list.npwr)) return true;

        for (const idx in this.group) {
            const node: NetNodeState = this.node_states[this.group[idx]]!;

            if (node.pull_up) return true;
            if (node.pull_down) return false;
            if (node.state) return true;
        }

        return false;
    }
}