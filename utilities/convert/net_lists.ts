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

export function build_net_list(
    node_names: NodeNames,
    segment_definitions: SegmentDefinitions,
    transistor_definitions: TransistorDefinitions
): NetList {
    const ngnd = node_names['vss'];
    const npwr = node_names['vcc'];
    const node_name_list = get_node_name_list(node_names);
    const nodes = get_nodes(segment_definitions, ngnd, npwr);
    const transistors = get_transistors(transistor_definitions, ngnd, npwr, nodes);

    return {
        nodes,
        node_names,
        node_name_list,
        ngnd,
        npwr,
        transistors,
    };
}

function get_node_name_list(node_names: NodeNames): string[] {
    const node_name_list: string[] = [];

    for (const node_name in node_names) {
        node_name_list.push(node_name);
    }

    return node_name_list;
}

function get_nodes(segment_defs: SegmentDefinitions, ngnd: number, npwr: number): NetNodes {
    const nodes: NetNodes = [];

    for (const idx in segment_defs) {
        const segment: (string | number)[] = segment_defs[idx];
        const node_number: number = segment[0] as number;

        if (nodes[node_number] === undefined) {
            nodes[node_number] = {
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

        if (node_number === ngnd) continue;
        if (node_number === npwr) continue;

        nodes[node_number]!.segments.push(segment.slice(3) as number[]);
    }

    let last = 0;

    for (const idx in nodes) {
        const node_num = parseInt(idx);

        while (node_num - last > 1) {
            last++;
            nodes[last] = null;
        }

        last = node_num;
    }

    return nodes;
}

function get_transistors(
    transistor_defs: TransistorDefinitions,
    ngnd: number,
    npwr: number,
    nodes: NetNodes
): Transistors {
    const transistors: Transistors = [];

    for (const idx in transistor_defs) {
        const definition: (string | number | number[])[] = transistor_defs[idx];
        const name: number = parseInt((definition[0] as string).substring(1));
        const gate: number = definition[1] as number;
        const bb: number = definition[4] as number;

        let c1: number = definition[2] as number;
        let c2: number = definition[3] as number;

        if (c1 === ngnd) {
            c1 = c2;
            c2 = ngnd;
        }

        if (c1 === npwr) {
            c1 = c2;
            c2 = npwr;
        }

        if (nodes[gate] === undefined || nodes[gate] === null) {
            throw new Error(`Transistor: ${name} has an undefined gate node ${gate}`);
        } else {
            nodes[gate]!.gates.push(name);
        }

        if (nodes[c1] === undefined || nodes[c1] === null) {
            throw new Error(`Transistor: ${name} has an undefined c1 node ${c1}`);
        } else {
            nodes[c1]!.c1c2s.push(name);
        }

        if (nodes[c2] === undefined || nodes[c2] === null) {
            throw new Error(`Transistor: ${name} has an undefined c2 node ${c2}`);
        } else {
            nodes[c2]!.c1c2s.push(name);
        }

        transistors[name] = {name, on: false, gate, c1, c2, bb};
    }

    return transistors;
}
