import "../types/global.d.ts";

//noinspection JSUnusedGlobalSymbols
export class CircuitDebugger {
    private readonly node_states: NetNodeStates;
    private readonly transistors: TransistorStates;

    private before_node_states: NetNodeStates = [];
    private before_transistors: TransistorStates = [];

    constructor(states: NetNodeStates, transistors: TransistorStates) {
        this.node_states = states;
        this.transistors = transistors;
    }

    private static dump_changes(name: string, padding: number, changed: string[]): string {
        if (changed.length == 0) return `No ${name} changes`;

        const lines = [`${name} Changes: [`];
        let line = '';
        let count = 0;

        for (const idx in changed) {
            if (count % 10 === 0 && line.length > 0) {
                lines.push(`  ${line.trimEnd()}`);
                line = '';
            }

            line += `${changed[idx]}, `.padStart(padding + 2, ' ');
            count++;
        }

        if (line.length > 0) {
            lines.push(`  ${line.trimEnd()}`);
        }

        lines.push(`];`);

        return lines.join('\n');
    }

    reset() {
        this.before_node_states = [];
        this.before_transistors = Object.assign([], this.transistors);

        for (const idx in this.node_states) {
            this.before_node_states[idx] = Object.assign({}, this.node_states[idx]);
        }
    }

    changes = (): DebugChanges => ({
        nodes: this.dump_changed_nodes(),
        transistors: this.dump_changed_transistors()
    });

    private dump_changed_nodes(): string {
        const changed: string[] = [];

        for (const idx in this.node_states) {
            const original = this.before_node_states[idx];
            const current = this.node_states[idx];

            if (original === null || current === null) continue;

            if (
                original.state !== current.state
                || original.float !== current.float
                || original.pull_up !== current.pull_up
//                || original.pull_down !== current.pull_down
            ) {
                changed.push(`${idx}:${current.state ? '+' : '-'}${current.float ? '+' : '-'}${current.pull_up ? '+' : '-'}${current.pull_down ? '+' : '-'}`);
            }
        }

        return CircuitDebugger.dump_changes('Node', 9, changed);
    }

    private dump_changed_transistors(): string {
        const changed: string[] = [];

        for (const idx in this.transistors) {
            const original = this.before_transistors[idx];
            const current = this.transistors[idx];

            if (original !== current) {
                changed.push(`${idx}:${current ? '+' : '-'}`);
            }
        }

        return CircuitDebugger.dump_changes('Transistor', 7, changed);
    }
}
