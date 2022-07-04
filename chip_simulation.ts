/*
 Copyright (c) 2010 Brian Silverman, Barry Silverman

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

export const c_trace = false;
const codes: Codes = {g: false, h: true, v: true, l: false};

const traced_nodes: number[] = [];
const traced_transistors: string[] = [];
const recalc_list: number[] = [];
const recalc_hash: number[] = [];
const group: number[] = [];

export function recalc_node_list(node_list: number[]) {
    const node_number: number = node_list[0];

    recalc_list.length = 0;
    recalc_hash.length = 0;

    for (let limiter = 0; limiter < 100; limiter++) {		// loop limiter
        if (node_list.length === 0) return;

        if (c_trace) {
            let idx: number;

            for (idx = 0; idx < traced_nodes.length; idx++) {
                if (node_list.indexOf(traced_nodes[idx]) !== -1) {
                    break;
                }
            }

            console.log('recalc window.nodes: ', limiter, node_list.length, node_list);
        }

        node_list.forEach(recalc_node);

        node_list.length = 0;

        recalc_list.forEach(itm => node_list.push(itm));

        recalc_list.length = 0;
        recalc_hash.length = 0;
    }

    if (c_trace) {
        console.log(node_number, 'looping...');
    }
}

function recalc_node(node: number) {
    if (node === window.ngnd || node === window.npwr) return;

    get_node_group(node);

    const new_state: boolean = get_node_value();

    if (c_trace && (traced_nodes.indexOf(node) !== -1)) {
        console.log('recalc', node, group);
    }

    group.forEach(function (idx) {
        const node: NetNode = window.nodes[idx];

        if (node.state === new_state) return;

        node.state = new_state;

        node.gates.forEach(function (transistor: Transistor) {
            node.state
                ? turn_transistor_on(transistor)
                : turn_transistor_off(transistor);
        });
    });
}

function turn_transistor_on(transistor: Transistor) {
    if (transistor.on) return;

    if (c_trace && (traced_transistors.indexOf(transistor.name) !== -1)) {
        console.log(transistor.name, 'on', transistor.gate, transistor.c1, transistor.c2);
    }

    transistor.on = true;

    add_recalc_node(transistor.c1);
}

function turn_transistor_off(transistor: Transistor) {
    if (!transistor.on) {
        return;
    }

    if (c_trace && (traced_transistors.indexOf(transistor.name) !== -1)) {
        console.log(transistor.name, 'off', transistor.gate, transistor.c1, transistor.c2);
    }

    transistor.on = false;

    add_recalc_node(transistor.c1);
    add_recalc_node(transistor.c2);
}

function add_recalc_node(node_number: number) {
    if (node_number === window.ngnd || node_number === window.npwr) {
        return;
    }

    if (recalc_hash[node_number] === 1) {
        return;
    }

    recalc_list.push(node_number);

    recalc_hash[node_number] = 1;
}

function get_node_group(node_number: number) {
    group.length = 0;

    add_node_to_group(node_number);
}

function add_node_to_group(node_number: number) {
    if (group.indexOf(node_number) !== -1) return;

    group.push(node_number);

    if (node_number === window.ngnd || node_number === window.npwr) return;

    window.nodes[node_number].c1c2s.forEach(
        function (transistor: Transistor) {
            if (!transistor.on) return;

            let other: (number | undefined) = undefined;

            if (transistor.c1 === node_number) {
                other = transistor.c2;
            }

            if (transistor.c2 === node_number) {
                other = transistor.c1;
            }

            if (other !== undefined) {
                add_node_to_group(other as number);
            }
        });
}

function get_node_value(): boolean {
    if (array_contains(group, window.ngnd)) {
        return false;
    }

    if (array_contains(group, window.npwr)) {
        return true;
    }

    for (const idx in group) {
        const node: NetNode = window.nodes[group[idx]];

        if (node.pull_up) {
            return true;
        }

        if (node.pull_down) {
            return false;
        }

        if (node.state) {
            return true;
        }
    }

    return false;
}

export function is_node_high(node_number: number): boolean {
    return window.nodes[node_number].state;
}

export function all_nodes(): number[] {
    const all_nodes: number[] = [];

    for (const idx in window.nodes) {
        // Don't feed numeric strings to recalc_node_list(). Numeric
        // strings can cause a (data dependent) duplicate node number
        // hiccup when accumulating a node group's list, ie:
        // group => [ '49', 483, 49 ]
        const ii = Number(idx);

        if ((ii !== window.npwr) && (ii !== window.ngnd)) {
            all_nodes.push(ii);
        }
    }

    return all_nodes;
}

export function state_string(): string {
    let state = '';

    for (let idx = 0; idx < window.nodes.length; idx++) {
        const node = window.nodes[idx];

        if (node === undefined) {
            state += 'x';
        } else if (idx === window.ngnd) {
            state += 'g';
        } else if (idx === window.npwr) {
            state += 'v';
        } else {
            state += node.state ? 'h' : 'l';
        }
    }

    return state;
}

export function show_state(state_value: string) {
    for (let idx = 0; idx < state_value.length; idx++) {
        if (state_value[idx] === 'x') continue;

        const state = codes[state_value[idx]];

        window.nodes[idx].state = state;

        const gates = window.nodes[idx].gates;

        gates.forEach(function (transistor: Transistor) {
            transistor.on = state;
        });
    }
}

export function set_high(node_name: string) {
    const node_number = window.node_names[node_name];

    window.nodes[node_number].pull_up = true;
    window.nodes[node_number].pull_down = false;

    recalc_node_list([node_number]);
}

export function set_low(node_name: string) {
    const node_number = window.node_names[node_name];

    window.nodes[node_number].pull_up = false;
    window.nodes[node_number].pull_down = true;

    recalc_node_list([node_number]);
}

function array_contains<T>(source: T[], item: T): boolean {
    return source.indexOf(item) !== -1;
}
