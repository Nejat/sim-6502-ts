// This file testprogram.js can be substituted by one of several tests
// which may not be redistributable
// for example
//    cbmbasic  loaded at 0xa000 with entry point 0xe394
//    test6502 (by Bird Computer) loaded at 0x8000 with entry point 0x8000
//
// (can use xxd -idx to convert binary into C include syntax, as a starting point)
//

import {write_triggers} from "./macros.ts";

export const test_program_address = 0x0000;

write_triggers[0x000F] = "output += String.fromCharCode(data);";

export const test_program: number[] = [
    0xa9, 0x00,              // LDA #$00
    0x20, 0x10, 0x00,        // JSR $0010
    0x4c, 0x02, 0x00,        // JMP $0002

    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x40,

    0xe8,                    // INX
    0x88,                    // DEY
    0xe6, 0x0F,              // INC $0F
    0x38,                    // SEC
    0x69, 0x02,              // ADC #$02
    0x60                     // RTS
];
