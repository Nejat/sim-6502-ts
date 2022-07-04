declare global {
    type CompareNode = () => void;

    interface Codes {
        [code: string]: boolean,
    }

    interface Disassembly {
        [byte: number]: string,
    }

    interface NetNode {
        segments: number[][],
        num: number,
        pull_up: boolean,
        pull_down: boolean,
        state: boolean,
        float: boolean,
        gates: Transistor[],
        c1c2s: Transistor[]
    }

    interface NodeNames {
        [node_name: string]: number
    }

    interface Trace {
        chip: string,
        mem: number[]
    }

    interface Triggers {
        [trigger: number]: string,
    }

    interface Transistor {
        name: string,
        on: boolean,
        gate: number,
        c1: number,
        c2: number,
        bb: number,
    }

    interface Transistors {
        [transistor: string]: Transistor
    }

    //noinspection JSUnusedGlobalSymbols
    interface Window {
        log_level: number;
        nodes: NetNode[];
        node_names: NodeNames;
        node_name_list: string[];
        ngnd: number;
        npwr: number;
        segment_defs: (number | string)[][];
        transistor_defs: (string | number | number[])[][];
        transistors: Transistors;
        user_code: number[];
        user_reset_low: number;
        user_reset_hi: number;
    }
}

export {}