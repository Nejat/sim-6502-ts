import "../types/global.d.ts";

//noinspection JSUnusedGlobalSymbols
export class CircuitDebugger {
    private readonly node_states: NetNodeStates;
    private readonly transistors: TransistorStates;

    private baseline_nodes: NetNodeStates = [];
    private baseline_transistors: TransistorStates = [];

    constructor(states: NetNodeStates, transistors: TransistorStates) {
        this.node_states = states;
        this.transistors = transistors;
    }

    private static dump_changes(name: string ,title: string, padding: number, changed: string[]): string {
        if (changed.length == 0) return `No ${name} ${title}`;

        const lines = [`${name} ${title}: [`];
        let line = '';
        let count = 0;

        for (const idx in changed) {
            if (count % 10 === 0 && line.length > 0) {
                lines.push(`  ${line.trimEnd()}`);
                line = '';
            }

            line += `${changed[idx]}, `.padStart(padding + 1, '0');
            count++;
        }

        if (line.length > 0) {
            lines.push(`  ${line.trimEnd().slice(0, -1)}`);
        }

        lines.push(`];`);

        return lines.join('\n');
    }

    reset() {
        this.baseline_nodes.length = 0;
        this.baseline_transistors = Object.assign([], this.transistors);

        for (const idx in this.node_states) {
            const node_state = this.node_states[idx];

            this.baseline_nodes[idx] = node_state === null ? null : Object.assign({}, node_state);
        }
    }

    changes = (original_nodes = false): DebugChanges => ({
        nodes: this.dump_changed_nodes(original_nodes),
        transistors: this.dump_changed_transistors(original_nodes)
    });

    private dump_changed_nodes(original_nodes: boolean): string {
        const changed: string[] = [];
        let title = original_nodes ? "Originals" : "Changes";

        for (const idx in this.node_states) {
            const original = this.baseline_nodes[idx];

            if (original === null) continue;

            if (original_nodes) {
                changed.push(`${idx}:${original.state ? '+' : '-'}${original.float ? '+' : '-'}${original.pull_up ? '+' : '-'}${original.pull_down ? '+' : '-'}`);
            } else {
                const current = this.node_states[idx];

                if (current === null) continue;

                if (
                    original.state !== current.state
                    || original.float !== current.float
                    || original.pull_up !== current.pull_up
                    || original.pull_down !== current.pull_down
                ) {
                    changed.push(`${idx}:${current.state ? '+' : '-'}${current.float ? '+' : '-'}${current.pull_up ? '+' : '-'}${current.pull_down ? '+' : '-'}`);
                }
            }
        }

        return CircuitDebugger.dump_changes('Node', title, 9, changed);
    }

    private dump_changed_transistors(original_nodes: boolean): string {
        const changed: string[] = [];
        let title = original_nodes ? "Originals" : "Changes";

        for (const idx in this.transistors) {
            const original = this.baseline_transistors[idx];

            if (original_nodes) {
                changed.push(`${idx}:${original ? '+' : '-'}`);
            } else {
                const current = this.transistors[idx];

                if (original !== current) {
                    changed.push(`${idx}:${current ? '+' : '-'}`);
                }
            }
        }

        return CircuitDebugger.dump_changes('Transistor', title, 7, changed);
    }
}
