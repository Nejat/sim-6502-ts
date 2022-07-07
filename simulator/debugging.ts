import "../types/global.d.ts";

//noinspection JSUnusedGlobalSymbols
export class CircuitDebugger {
    private readonly before_nodes: NetNodes = [];
    private readonly before_transistors: Transistors = [];
    private readonly net_list: NetList;

    constructor(net_list: NetList) {
        this.net_list = net_list;
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
        this.before_nodes.length = 0;
        this.before_transistors.length = 0;

        for (const idx in this.net_list.nodes) {
            this.before_nodes[idx] = Object.assign({}, this.net_list.nodes[idx]);
        }

        this.net_list.transistors.forEach(tn => {
            this.before_transistors[tn.name] = Object.assign({}, tn);
        });
    }

    changes = (): DebugChanges => ({
        nodes: this.dump_changed_nodes(),
        transistors: this.dump_changed_transistors()
    });

    private dump_changed_nodes(): string {
        const changed: string[] = [];

        for (const idx in this.net_list.nodes) {
            const original = this.before_nodes[idx];
            const current = this.net_list.nodes[idx];

            if (original === null || current === null) continue;

            if (
                original.state !== current.state
                || original.float !== current.float
                || original.pull_up !== current.pull_up
//                || original.pull_down !== current.pull_down
            ) {
                changed.push(`${current.num}:${current.state ? '+' : '-'}${current.float ? '+' : '-'}${current.pull_up ? '+' : '-'}${current.pull_down ? '+' : '-'}`);
            }
        }

        return CircuitDebugger.dump_changes('Node', 9, changed);
    }

    private dump_changed_transistors(): string {
        const changed: string[] = [];

        for (const idx in this.net_list.transistors) {
            const original = this.before_transistors[idx];
            const current = this.net_list.transistors[idx];

            if (original.on !== current.on) {
                changed.push(`${current.name}:${current.on ? '+' : '-'}`);
            }
        }

        return CircuitDebugger.dump_changes('Transistor', 7, changed);
    }
}
