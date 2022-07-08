import {InternalStateType} from "../simulator/internals.ts";
import {TriggerType} from "../simulator/6502/cpu_6502.ts";

declare global {
    type OnStateChange = (internals: Internals) => void;
    type OnTrace = (trace: string) => void;
    type OnTrigger = (message: TriggerMessage) => void;

    interface Code {
        address: number,
        code: number[],
        clock_triggers?: Triggers,
        fetch_triggers?: Triggers,
        read_triggers?: Triggers,
        write_triggers?: Triggers,
        user_reset_hi?: number,
        user_reset_lo?: number,
    }

    interface DebugChanges {
        nodes: string,
        transistors: string
    }

    interface Internals {
        type: InternalStateType,
        logged: Logged
    }

    interface Logged {
        [name: string]: (string | string[] | number);
    }

    interface NetList {
        readonly nodes: NetNodes;
        readonly node_names: NodeNames;
        readonly node_name_list: string[];
        readonly ngnd: number;
        readonly npwr: number;
        readonly transistors: Transistors;
    }

    interface NetNode {
        segments: number[][],
        num: number,
        pull_up: boolean,
        pull_down: boolean,
        state: boolean,
        float: boolean,
        gates: number[],
        c1c2s: number[]
    }

    interface NetNodes {
        length: number;

        [node: number]: (NetNode | null);
    }

    interface NodeNames {
        [node_name: string]: number
    }

    interface Padding {
        [name: string]: number
    }

    interface SegmentDefinitions {
        length: number;

        [index: number]: (number | string)[];
    }

    interface Trace {
        state: string,
        memory: number[]
    }

    interface Transistor {
        name: number,
        on: boolean,
        gate: number,
        c1: number,
        c2: number,
        bb: number,
    }

    interface TransistorDefinitions {
        length: number;

        [index: number]: (string | number | number[])[];
    }

    interface Transistors {
        length: number;

        [name: number]: Transistor;

        forEach(each: (tn: Transistor) => void): void;
    }

    interface TriggerMessage {
        type: TriggerType,
        output: string
    }

    interface Triggers {
        [trigger: number]: string,
    }
}

export {}