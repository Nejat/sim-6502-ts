import {hex_byte, hex_word} from "../utilities/index.ts";

export class Memory {
    private memory: number[] = [];

    clear(): void {
        this.memory = [];
    }

    dump_memory(): void {
        const lines: string[] = [];
        let line = ''

        for (const array_index in this.memory) {
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

            line += `${hex_byte(this.memory[idx])} `;
        }

        line = line.trim();

        if (line.length > 0) {
            lines.push(line);
        }

        console.log(`\n${lines.join('\n')}\n`);
    }

    read(address: number): number {
        return this.memory[address] === undefined ? 0 : this.memory[address];
    }

    write(address: number, data: number) {
        this.memory[address] = data;
    }
}
