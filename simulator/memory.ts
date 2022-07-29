import {hex_byte, hex_word} from "../utilities/index.ts";

export class Memory {
    private memory: number[] = [];

    clear(): void {
        this.memory.length = 0;
    }

    dump_memory(): void {
        const lines: string[] = [];
        let line = ''
        let last = -1;
        const write_byte = (idx: number, byte: string) => {
            if (idx % 8 === 0) {
                line += ' ';
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

            line += `${byte} `;
        };

        const write_tail = () => {
            const tail = 16 - (last + 1) % 16;

            if (tail < 16) {
                for (let idx_fill = 0; idx_fill < tail; idx_fill++) {
                    write_byte(last + idx_fill + 1, '--');
                }
            }
        };

        for (const array_index in this.memory) {
            let idx = parseInt(array_index);

            if (idx - last !== 1) {
                write_tail();

                const start = idx % 16;
                last = idx;

                if (start !== 0) {
                    for (let idx_fill = 0; idx_fill < start; idx_fill++) {
                        idx = last - start + idx_fill;
                        write_byte(idx, '--');
                    }
                    idx++;
                }
            }

            write_byte(idx, hex_byte(this.memory[idx]));

            last = idx;
        }

        write_tail();

        line = line.trim();

        if (line.length > 0) {
            lines.push(line);
        }

        console.log(`\n${lines.join('\n')}\n`);
    }

    read(address: number): number {
        return this.memory[address] === undefined ? 0 : this.memory[address];
    }

    write(address: number, data: number): void {
        this.memory[address] = data;
    }
}
