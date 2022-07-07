import {Memory} from "../memory.ts";
import {Disassembler} from "../disassembler.ts";

export class Disassembler6502 implements Disassembler {
    private readonly memory: Memory;

    constructor(memory: Memory) {
        this.memory = memory;
    }

    disassemble(op_code: number): string {
        let disassembled = '';

        switch (op_code) {
            case 0x0:
                disassembled = 'BRK';
                break;

            case 0x40:
                disassembled = 'RTI';
                break;

            case 0x60:
                disassembled = 'RTS';
                break;

            case 0x08:
                disassembled = 'PHP';
                break;

            case 0x28:
                disassembled = 'PLP';
                break;

            case 0x48:
                disassembled = 'PHA';
                break;

            case 0x68:
                disassembled = 'PLA';
                break;

            case 0x88:
                disassembled = 'DEY';
                break;

            case 0xa8:
                disassembled = 'TAY';
                break;

            case 0xc8:
                disassembled = 'INY';
                break;

            case 0xe8:
                disassembled = 'INX';
                break;

            case 0x18:
                disassembled = 'CLC';
                break;

            case 0x38:
                disassembled = 'SEC';
                break;

            case 0x58:
                disassembled = 'CLI';
                break;

            case 0x78:
                disassembled = 'SEI';
                break;

            case 0x98:
                disassembled = 'TYA';
                break;

            case 0xb8:
                disassembled = 'CLV';
                break;

            case 0xd8:
                disassembled = 'CLD';
                break;

            case 0xf8:
                disassembled = 'SED';
                break;

            case 0x8a:
                disassembled = 'TXA';
                break;

            case 0x9a:
                disassembled = 'TXS';
                break;

            case 0xaa:
                disassembled = 'TAX';
                break;

            case 0xba:
                disassembled = 'TSX';
                break;

            case 0xca:
                disassembled = 'DEX';
                break;

            case 0xea:
                disassembled = 'NOP';
                break;

            case 0x10:
                disassembled = 'BPL ' + '$'; // relative
                break;

            case 0x30:
                disassembled = 'BMI ' + '$'; // relative
                break;

            case 0x50:
                disassembled = 'BVC ' + '$'; // relative
                break;

            case 0x70:
                disassembled = 'BVS ' + '$'; // relative
                break;

            case 0x90:
                disassembled = 'BCC ' + '$'; // relative
                break;

            case 0xb0:
                disassembled = 'BCS ' + '$'; // relative
                break;

            case 0xd0:
                disassembled = 'BNE ' + '$'; // relative
                break;

            case 0xf0:
                disassembled = 'BEQ ' + '$'; // relative
                break;

            case 0x20:
                disassembled = 'JSR ' + '$abs';
                break;

            default: {
                const grouping = op_code & 0b11;

                switch (grouping) {
                    case 0b01: {
                        const op_code2 = (op_code >> 5) & 0b111;

                        switch (op_code2) {
                            case 0b0:
                                disassembled += 'ORA';
                                break;

                            case 0b1:
                                disassembled += 'AND';
                                break;

                            case 0b10:
                                disassembled += 'EOR';
                                break;

                            case 0b11:
                                disassembled += 'ADC';
                                break;

                            case 0b100:
                                disassembled += 'STA';
                                break;

                            case 0b101:
                                disassembled += 'LDA';
                                break;

                            case 0b110:
                                disassembled += 'CMP';
                                break;

                            case 0b111:
                                disassembled += 'SBC';
                                break;

                            default:
                                disassembled += '¿|?';
                        }

                        disassembled += ' '

                        const mode = (op_code >> 2) & 0b111;

                        switch (mode) {
                            case 0b0:
                                disassembled += '$,X';
                                break;

                            case 0b1:
                                disassembled += '$zp';
                                break;

                            case 0b10:
                                disassembled += '#$';
                                break;

                            case 0b11:
                                disassembled += '$abs';
                                break;

                            case 0b100:
                                disassembled += '$,Y';
                                break;

                            case 0b101:
                                disassembled += '$zp,X';
                                break;

                            case 0b110:
                                disassembled += '$abs,Y';
                                break;

                            case 0b111:
                                disassembled += '$abs,Y';
                                break;

                            default: {
                                disassembled += '¿|?';
                            }
                        }
                    }
                        break;

                    case 0b10: {
                        const op_code3 = (op_code >> 5) & 0b111;

                        switch (op_code3) {
                            case 0b0:
                                disassembled += 'ASL';
                                break;

                            case 0b1:
                                disassembled += 'ROL';
                                break;

                            case 0b10:
                                disassembled += 'LSR';
                                break;

                            case 0b11:
                                disassembled += 'ROR';
                                break;

                            case 0b100:
                                disassembled += 'STX';
                                break;

                            case 0b101:
                                disassembled += 'LDX';
                                break;

                            case 0b110:
                                disassembled += 'DEC';
                                break;

                            case 0b111:
                                disassembled += 'INC';
                                break;

                            default: {
                                disassembled += '¿|?';
                            }
                        }

                        disassembled += ' ';

                        const mode2 = (op_code >> 2) & 0b111;

                        switch (mode2) {
                            case 0b0:
                                disassembled += '#$';
                                break;

                            case 0b1:
                                disassembled += '$zp';
                                break;

                            case 0b10:
                                disassembled += 'A';
                                break;

                            case 0b11:
                                disassembled += '$abs';
                                break;

                            case 0b101:
                                disassembled += '$zp,X';
                                break;

                            case 0b111:
                                disassembled += '$abs,Y';
                                break;

                            default: {
                                disassembled += '¿|?';
                            }
                        }
                    }
                        break;

                    case 0b00: {
                        const op_code4 = (op_code >> 5) & 0b111;

                        switch (op_code4) {
                            case 0b0:
                                disassembled += '???';
                                break;

                            case 0b1:
                                disassembled += 'BIT';
                                break;

                            case 0b10:
                                disassembled += 'JMP';
                                break;

                            case 0b11:
                                disassembled += 'JMP';
                                break;

                            case 0b100:
                                disassembled += 'STY';
                                break;

                            case 0b101:
                                disassembled += 'LDY';
                                break;

                            case 0b110:
                                disassembled += 'CPY';
                                break;

                            case 0b111:
                                disassembled += 'CPX';
                                break;

                            default: {
                                disassembled += '¿|?';
                            }
                        }

                        disassembled += ' ';

                        const mode3 = (op_code >> 2) & 0b111;

                        switch (mode3) {
                            case 0b0:
                                disassembled += '#$';
                                break;

                            case 0b1:
                                disassembled += '$zp';
                                break;

                            case 0b11:
                                disassembled += '$abs';
                                break;

                            case 0b101:
                                disassembled += '$zp,X';
                                break;

                            case 0b111:
                                disassembled += '$abs,Y';
                                break;

                            default: {
                                disassembled += '¿|?';
                            }
                        }
                    }
                        break;

                    default:
                        disassembled = '¿Unknowable?';
                        break;
                }
            }
        }

        return disassembled;
    }
}