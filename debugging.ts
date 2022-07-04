export function node_comparer(): CompareNode {
    const before_nodes: NetNode[] = [];
    const before_transistors: Transistors = Object.assign({}, window.transistors);

    window.nodes.forEach(nd => before_nodes[nd.num] = Object.assign({}, nd));

    return () => {
        dump_changed_nodes(before_nodes);
        dump_changed_transistors(before_transistors);
    };
}

function dump_changed_nodes(before_nodes: NetNode[]) {
    const changed: string[] = [];

    for (const idx in window.nodes) {
        const original = before_nodes[idx];
        const current = window.nodes[idx];

        if (
            original.state !== current.state
            || original.float !== current.float
            || original.pull_up !== current.pull_up
//                || original.pull_down !== current.pull_down
        ) {
            changed.push(`${current.num}:${current.state ? '+' : '-'}${current.float ? '+' : '-'}${current.pull_up ? '+' : '-'}${current.pull_down ? '+' : '-'}`);
        }
    }

    dump_changes('Nodes', 9, changed);
}

function dump_changed_transistors(before_transistors: Transistors) {
    const changed: string[] = [];

    for (const idx in window.transistors) {
        const original = before_transistors[idx];
        const current = window.transistors[idx];

        if (original.on !== current.on) {
            changed.push(`${current.name}:${current.on ? '+' : '-'}`);
        }
    }

    dump_changes('Transistors', 7, changed);
}

function dump_changes(name: string, padding: number, changed: string[]) {
    if (changed.length == 0) return;

    const lines = [`Changed ${name}: [`]
    let line = '';
    let count = 0;

    for (const idx in changed) {
        if (count % 10 === 0 && line.length > 0) {
            lines.push(`  ${line}`);
            line = '';
        }

        line += `${changed[idx]}, `.padStart(padding + 2, ' ');
        count++;
    }

    if (line.length > 0) {
        lines.push(`  ${line}`);
    }

    lines.push(`];`);

    console.log(lines.join('\n'), '\n');
}

export function dump_memory(memory: number[]) {
    const lines: string[] = [];
    let line = ''

    for (const array_index in memory) {
        const idx = parseInt(array_index);

        if (idx % 8 === 0) {
            line += '  ';
        }

        if (idx % 16 === 0) {
            line = line.trim();

            if (line.length > 0) {
                lines.push(line);
                line = '';
            }
        }

        if (line.length === 0) {
            line = `${hex_word(idx)}: `;
        }

        line += `${hex_byte(memory[idx])} `;
    }

    line = line.trim();

    if (line.length > 0) {
        lines.push(line);
    }

    console.log(`\n${lines.join('\n')}\n`);
}

export const hex_word = (value: number): string => (0x10000 + value).toString(16).substring(1);

export const hex_byte = (value: number): string => (0x100 + value).toString(16).substring(1);
