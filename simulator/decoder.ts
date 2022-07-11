export interface Decoder {
    decode_instruction(op_code: number): string;
}
