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

export function setup_simulation() {
    window.nodes = [];
    window.transistors = {};
    window.node_name_list = [];
    window.ngnd = window.node_names['vss'];
    window.npwr = window.node_names['vcc'];
    window.user_code = [];
    window.log_level = 2;

    console.log('\nSimulation setup ...')
    console.log('  - setup nodes ...')
    setup_nodes();
    console.log('  - setup transistors ...')
    setup_transistors();
    console.log('  - setup node name list ...')
    setup_node_name_list();
}

function setup_node_name_list() {
    for (const node_name in window.node_names) {
        window.node_name_list.push(node_name);
    }
}

function setup_nodes() {
    for (const idx in window.segment_defs) {
        const segment: (string | number)[] = window.segment_defs[idx];
        const node_number: number = segment[0] as number;

        if (window.nodes[node_number] === undefined) {
            window.nodes[node_number] = {
                segments: [],
                num: node_number,
                pull_up: segment[1] == '+',
                pull_down: false,
                state: false,
                float: false,
                gates: [],
                c1c2s: []
            };
        }

        if (node_number === window.ngnd) continue;
        if (node_number === window.npwr) continue;

        window.nodes[node_number].segments.push(segment.slice(3) as number[]);
    }
}

function setup_transistors() {
    for (const idx in window.transistor_defs) {
        const definition: (string | number | number[])[] = window.transistor_defs[idx];
        const name: string = definition[0] as string;
        const gate: number = definition[1] as number;
        const bb: number = definition[4] as number;

        let c1: number = definition[2] as number;
        let c2: number = definition[3] as number;

        if (c1 === window.ngnd) {
            c1 = c2;
            c2 = window.ngnd;
        }

        if (c1 === window.npwr) {
            c1 = c2;
            c2 = window.npwr;
        }

        const transistor: Transistor = {
            name: name,
            on: false,
            gate: gate,
            c1: c1,
            c2: c2,
            bb: bb
        };

        window.nodes[gate].gates.push(transistor);
        window.nodes[c1].c1c2s.push(transistor);
        window.nodes[c2].c1c2s.push(transistor);

        window.transistors[name] = transistor;
    }
}
