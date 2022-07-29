import {StateType} from "../simulator/internals.ts";
import {Trigger} from "../simulator/trigger.ts";

declare global {
    type ConsoleOutput = (debug: string) => Promise<any>;
    type DebugOutput = (debug: string) => Promise<void>;
    type OnStateChange = (internals: Internals) => void;
    type OnTrace = (trace: string) => void;
    type OnTrigger = (message: TriggerMessage) => void;

    interface Code {
        code: CodeSegment[],
        clock_triggers?: Triggers,
        fetch_triggers?: Triggers,
        read_triggers?: Triggers,
        write_triggers?: Triggers,
        user_reset_hi?: number,
        user_reset_lo?: number,
    }

    interface CodeSegment {
        address: number,
        code: number[],
    }

    interface CPUTest {
        program: Code,
        test_steps: Instructions
    }

    interface DebugChanges {
        nodes: string,
        transistors: string
    }

    interface Internals {
        type: StateType,
        logged: Logged
    }

    interface Instruction {
        type: string,
        value: (string | number | undefined)
    }

    interface Instructions {
        [index: number]: Instruction,

        forEach(each: (instr: Instruction) => void): void;
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
        gates: number[],
        c1c2s: number[]
    }

    interface NetNodes {
        length: number;

        [node_number: number]: (NetNode | null);
    }

    interface NetNodeState {
        pull_up: boolean,
        pull_down: boolean,
        state: boolean,
        float: boolean,
    }

    interface NetNodeStates {
        length: number;

        [node_number: number]: (NetNodeState | null);
    }

    interface NodeNames {
        [node_name: string]: number
    }

    interface Padding {
        [name: string]: number
    }

    interface RecalculateHash {
        [node_number: number]: (boolean | undefined);
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
        gate: number,
        c1: number,
        c2: number,
        bb: number[],
    }

    interface TransistorDefinitions {
        length: number;

        [index: number]: (string | number | number[])[];
    }

    interface Transistors {
        length: number;

        [transistor_name: number]: Transistor;

        forEach(each: (tn: Transistor) => void): void;
    }

    interface TransistorStates {
        length: number;

        [transistor_name: number]: boolean;
    }

    interface TriggerMessage {
        type: Trigger,
        output: string
    }

    interface Triggers {
        [trigger: number]: string,
    }
}

export {}