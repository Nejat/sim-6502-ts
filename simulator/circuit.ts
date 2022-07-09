import "../types/global.d.ts";
import {codes} from "./codes.ts";
import {array_contains} from "../utilities/index.ts";
import {CircuitDebugger} from "./debugging.ts";

export class Circuit {
    private readonly net_list: NetList;
    private readonly on_trace?: OnTrace;
    //noinspection JSMismatchedCollectionQueryUpdate
    private readonly traced_nodes: number[] = [];
    //noinspection JSMismatchedCollectionQueryUpdate
    private readonly traced_transistors: number[] = [];

    private group: number[] = [];
    private node_states: NetNodeStates = [];
    private recalc_list: number[] = [];
    private recalc_hash: number[] = [];
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

    is_node_high = (node: number): boolean => this.node_states[node]!.state;

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

        this.node_states = [];
        this.transistors = [];

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

    set_hi(node_name: string) {
        const node_number = this.net_list.node_names[node_name];

        this.node_states[node_number]!.pull_up = true;
        this.node_states[node_number]!.pull_down = false;

        this.recalc_node_list([node_number]);
    }

    set_lo(node_name: string) {
        const node_number = this.net_list.node_names[node_name];

        this.node_states[node_number]!.pull_up = false;
        this.node_states[node_number]!.pull_down = true;

        this.recalc_node_list([node_number]);
    }

    show_state(state_value: string) {
        for (let idx = 0; idx < state_value.length; idx++) {
            if (state_value[idx] === 'x') continue;

            const state = codes[state_value[idx]];

            this.node_states[idx]!.state = state;

            this.net_list.nodes[idx]!.gates
                .forEach((name: number) => {
                    this.transistors[name] = state;
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

    write_bits(data: number, nodes: string[]) {
        const recalc_nodes: number[] = [];

        nodes.forEach(
            nd => {
                const node_number = this.net_list.node_names[nd];
                const node_state = this.node_states[node_number]!;

                if ((data % 2) === 0) {
                    node_state.pull_down = true;
                    node_state.pull_up = false;
                } else {
                    node_state.pull_down = false;
                    node_state.pull_up = true;
                }

                recalc_nodes.push(node_number);

                data >>= 1;
            }
        )

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

    private add_node_to_group(node_number: number) {
        if (this.group.indexOf(node_number) !== -1) return;

        this.group.push(node_number);

        const net_list = this.net_list;

        if (node_number === net_list.ngnd || node_number === net_list.npwr) return;

        net_list.nodes[node_number]!.c1c2s.forEach(
            (name: number) => {
                if (!this.transistors[name]) return;

                const transistor = net_list.transistors[name];

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

    private add_recalc_node(node_number: number) {
        const net_list = this.net_list;

        if (node_number === net_list.ngnd || node_number === net_list.npwr) return;

        if (this.recalc_hash[node_number] === 1) return;

        this.recalc_list.push(node_number);

        this.recalc_hash[node_number] = 1;
    }

    private recalc_node(node: number): void {
        const net_list = this.net_list;

        if (node === net_list.ngnd || node === net_list.npwr) return;

        this.get_node_group(node);

        const new_state: boolean = this.get_node_value();

        if (this.on_trace !== undefined && (this.traced_nodes.indexOf(node) !== -1)) {
            this.on_trace(`recalc ${node} ${this.group}`);
        }

        this.group.forEach((idx) => {
            const node: NetNode = net_list.nodes[idx]!;
            const node_state: NetNodeState = this.node_states[idx]!;

            if (node_state.state === new_state) return;

            node_state.state = new_state;

            node.gates.forEach((name: number) => {
                const transistor = net_list.transistors[name];

                node_state.state
                    ? this.turn_transistor_on(transistor)
                    : this.turn_transistor_off(transistor);
            });
        });
    }

    private recalc_node_list(node_list: number[]) {
        const node_number: number = node_list[0];

        this.recalc_list = [];
        this.recalc_hash = [];

        for (let limiter = 0; limiter < 100; limiter++) {		// loop limiter
            if (node_list.length === 0) return;

            if (this.on_trace != null) {
                let idx: number;

                for (idx = 0; idx < this.traced_nodes.length; idx++) {
                    if (node_list.indexOf(this.traced_nodes[idx]) !== -1) break;
                }

                if ((this.traced_nodes.length === 0) || (node_list.indexOf(this.traced_nodes[idx]) === -1)) {
                    this.on_trace(`recalc node list iteration: ${limiter} ${node_list.length} nodes`);
                } else {
                    this.on_trace(`recalc node list iteration: ${limiter} ${node_list.length} nodes ${node_list}`);
                }
            }

            node_list.forEach(nd => this.recalc_node(nd));

            node_list = [];

            this.recalc_list.forEach(itm => node_list.push(itm));

            this.recalc_list = [];
            this.recalc_hash = [];
        }

        this.on_trace?.(`${node_number} looping...`);
    }

    private turn_transistor_on(transistor: Transistor) {
        if (this.transistors[transistor.name]) return;

        if (this.on_trace != null && (this.traced_transistors.indexOf(transistor.name) !== -1)) {
            this.on_trace(`${transistor.name} on ${transistor.gate}, ${transistor.c1}, ${transistor.c2}`);
        }

        this.transistors[transistor.name] = true;

        this.add_recalc_node(transistor.c1);
    }

    private turn_transistor_off(transistor: Transistor) {
        if (!this.transistors[transistor.name]) return;

        if (this.on_trace != null && (this.traced_transistors.indexOf(transistor.name) !== -1)) {
            this.on_trace(`${transistor.name} off ${transistor.gate}, ${transistor.c1}, ${transistor.c2}`);
        }

        this.transistors[transistor.name] = false;

        this.add_recalc_node(transistor.c1);
        this.add_recalc_node(transistor.c2);
    }

    private get_node_group(node_number: number) {
        this.group = [];

        this.add_node_to_group(node_number);
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