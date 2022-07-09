import {Decoder} from "./decoder.ts";

export class InstructionDecoder implements Decoder {
    private readonly op_codes: string[];

    constructor(op_codes: string[]) {
        this.op_codes = op_codes;
    }

    decode_instruction = (op_code: number): string => this.op_codes[op_code];
}