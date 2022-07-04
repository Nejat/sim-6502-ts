/*
 Copyright (c) 2010 Brian Silverman, Barry Silverman, Ed Spittles, Achim Breidenbach

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import * as chip from "./chip_simulation.ts";
import {dump_memory, hex_byte, hex_word} from "./debugging.ts";

const chip_name = '6502';
const log_these: string[] = [];
const golden_check_sum: (string | undefined) = undefined;
const memory: number[] = [];
const node_name_reset = 'res';
const padding_log_list: number[] = [
    5,
    4, 2, 2, 10, 4, 2, 2, 2, 2, 8,
    7, 5,
];
const preset_log_list: string[][] = [
    ['cycle'],
    ['ab', 'db', 'rw', 'Fetch', 'pc', 'a', 'x', 'y', 's', 'p'],
    ['Execute', 'State'],
    ['ir', 'tcstate', '-pd'],
    ['adl', 'adh', 'sb', 'alu'],
    ['alucin', 'alua', 'alub', 'alucout', 'aluvout', 'dasb'],
    ['plaOutputs', 'DPControl'],
    ['idb', 'dor'],
    ['irq', 'nmi', node_name_reset],
];
const trace: Trace[] = [];

// triggers for breakpoints, watchpoints, input pin events
// almost always are undefined when tested, so minimal impact on performance
export const clock_triggers: Triggers = {};
export const write_triggers: Triggers = {};
export const read_triggers: Triggers = {};
export const fetch_triggers: Triggers = {};

// example instruction tracing triggers
// fetch_triggers[0x20]='console.log('0x'+read_address_bus().toString(16)+': JSR');';
// fetch_triggers[0x60]='console.log('0x'+read_address_bus().toString(16)+': RTS');';
// fetch_triggers[0x4c]='console.log('0x'+read_address_bus().toString(16)+': JMP');';

let cycle = 0;
let expert_mode = true;
let initialized = false;
let hz_sampling_rate = 10;
let prev_hz_timestamp = 0;
let prev_hz_cycle_count = 0;
let prev_hz_estimate1 = 1;
let prev_hz_estimate2 = 1;
let running = false;
let trace_check_sum = '';
let output = '';

export function go(
    user_steps: number | undefined = undefined,
    set_expert_mode = true,
) {
    if (!initialized) {
        init_chip();
    }

    expert_mode = set_expert_mode;
    running = true;

    while (running) {
        if (user_steps !== undefined) {
            if (--user_steps === 0) {
                running = false;
                user_steps = undefined;
            }
        }

        if (running) {
            step();
        }
    }
}

// run for an extended number of cycles, with low overhead, for interactive programs or for benchmarking
//    note: to run an interactive program, use an URL like
// helper function: allows us to poll 'running' without resetting it when we're re-scheduled
export function go_for_n(steps: number) {
    while (steps > 0) {
        half_step();

        cycle++;
        steps--;
    }

    instantaneous_hz();
    log_chip_status();

    running = false;
}

export function go_until_sync() {
    half_step();

    while (!chip.is_node_high(window.node_names['sync']) || chip.is_node_high(window.node_names['clk0'])) {
        half_step();
    }
}

export function go_until_sync_or_write() {
    half_step();

    cycle++;

    while (
        !chip.is_node_high(window.node_names['clk0']) ||
        (!chip.is_node_high(window.node_names['sync']) && chip.is_node_high(window.node_names['rw']))
        ) {
        half_step();

        cycle++;
    }

    log_chip_status();
}

export function load_program(program: number[], address: number, clear_memory = true) {
    console.log('\nloading program to address:', hex_word(address));

    if (clear_memory) {
        memory.length = 0;
    }

    // a moderate size of static test_program might be loaded
    for (const idx in program) {
        memory_write(address + parseInt(idx), program[idx]);
    }

    dump_memory(memory);
}

export function step_forward() {
    if (!initialized) {
        init_chip();
    }

    stop_chip();
    step();
}

export function step_back() {
    if (cycle === 0) return;

    chip.show_state(trace[--cycle].chip);
    set_memory(trace[cycle].mem);

    const clk = chip.is_node_high(window.node_names['clk0']);

    if (!clk) {
        write_data_bus(memory_read(read_address_bus()));
    }

    log_chip_status();
}

export function test_nmi(steps: number) {
    reset_chip();

    memory_write(0x0000, 0x38); // set carry
    memory_write(0x0001, 0x4c); // jump to test code
    memory_write(0x0002, 0x06);
    memory_write(0x0003, 0x23);

    memory_write(0x22ff, 0x38); // set carry
    memory_write(0x2300, 0xea);
    memory_write(0x2301, 0xea);
    memory_write(0x2302, 0xea);
    memory_write(0x2303, 0xea);
    memory_write(0x2304, 0xb0); // branch carry set to self
    memory_write(0x2305, 0xfe);

    memory_write(0x2306, 0xb0); // branch carry set to self
    memory_write(0x2307, 0x01);
    memory_write(0x2308, 0x00); // brk should be skipped
    memory_write(0x2309, 0xa9); // anything
    memory_write(0x230a, 0xde); // anything
    memory_write(0x230b, 0xb0); // branch back with page crossing
    memory_write(0x230c, 0xf2);

    memory_write(0xc018, 0x40); // nmi handler

    memory_write(0xfffa, 0x18); // nmi vector
    memory_write(0xfffb, 0xc0);
    memory_write(0xfffc, 0x00); // reset vector
    memory_write(0xfffd, 0x00);

    for (let idx = 0; idx < steps; idx++) {
        step();
    }

    chip.set_low('nmi');
    log_chip_status();

    for (let idx = 0; idx < 8; idx++) {
        step();
    }

    chip.set_high('nmi');
    log_chip_status();

    for (let idx = 0; idx < 16; idx++) {
        step();
    }
}

// simulate a single clock phase with no update to graphics or trace
function half_step() {
    const clk = chip.is_node_high(window.node_names['clk0']);

    if (clk) {
        chip.set_low('clk0');
        handle_bus_read();
    } else {
        chip.set_high('clk0');
        handle_bus_write();
    }

    eval(clock_triggers[cycle + 1]);  // pre-apply next tick's inputs now, so the updates are displayed
}

function handle_bus_read() {
    if (chip.is_node_high(window.node_names['rw'])) {
        const a = read_address_bus();
        let data = eval(read_triggers[a]);

        if (data === undefined) {
            data = memory_read(read_address_bus());
        }

        if (chip.is_node_high(window.node_names['sync'])) {
            eval(fetch_triggers[data]);
        }

        write_data_bus(data);
    }
}

function handle_bus_write() {
    if (!chip.is_node_high(window.node_names['rw'])) {
        const address = read_address_bus();
        const data = read_data_bus();

        eval(write_triggers[address]);

        memory_write(address, data);
    }
}

export function init_chip() {
    console.log('Initialize Chip ...\n');

    const start = now();

    for (const node_number in window.nodes) {
        const net_node = window.nodes[node_number];

        net_node.state = false;
        net_node.float = true;
    }

    const vcc = window.nodes[window.ngnd];

    vcc.state = false;
    vcc.float = false;

    const vss = window.nodes[window.npwr];

    vss.state = true;
    vss.float = false;

    for (const idx in window.transistors) {
        window.transistors[idx].on = false;
    }

    chip.set_low(node_name_reset);
    chip.set_low('clk0');
    chip.set_high('rdy');
    chip.set_low('so');
    chip.set_high('irq');
    chip.set_high('nmi');

    chip.recalc_node_list(chip.all_nodes());

    for (let idx = 0; idx < 8; idx++) {
        chip.set_high('clk0');
        chip.set_low('clk0');
    }

    chip.set_high(node_name_reset);

    // avoid updating graphics and trace buffer before user code
    for (let idx = 0; idx < 18; idx++) {
        half_step();
    }

    cycle = 0;
    trace.length = 0;
    output = '';

    if (expert_mode) {
        update_log_list();
    }

    log_chip_status();

    if (chip.c_trace) {
        console.log('initChip done after', now() - start);
    }

    initialized = true;
}

const memory_read = (address: number) => memory[address] === undefined ? 0 : memory[address];

const memory_write = (address: number, data: number) => memory[address] = data;

const now = (): number => new Date().getTime();

const read_accumulator = (): number => read_bits('a', 8);

const read_address_bus = (): number => read_bits('ab', 16);

const read_data_bus = (): number => read_bits('db', 8);

const read_index_x = (): number => read_bits('x', 8);

const read_index_y = (): number => read_bits('y', 8);

const _read_p = (): number => read_bits('p', 8);

const read_p_string = () =>
    (chip.is_node_high(window.node_names['p7']) ? 'N' : 'n') +
    (chip.is_node_high(window.node_names['p6']) ? 'V' : 'v') + '-' +
    (chip.is_node_high(window.node_names['p4']) ? 'B' : 'b') +
    (chip.is_node_high(window.node_names['p3']) ? 'D' : 'd') +
    (chip.is_node_high(window.node_names['p2']) ? 'I' : 'idx') +
    (chip.is_node_high(window.node_names['p1']) ? 'Z' : 'z') +
    (chip.is_node_high(window.node_names['p0']) ? 'C' : 'c');

const read_program_counter = (): number => (read_bits('pch', 8) << 8) + read_bits('pcl', 8);

const _read_program_counter_hi = (): number => read_bits('pch', 8);

const _read_program_counter_low = (): number => read_bits('pcl', 8);

const read_stack_pointer = () => read_bits('s', 8);

function signal_set(level: number): string[] {
    const signals: string[] = [];

    for (let idx = 0; (idx <= level) && (idx < preset_log_list.length); idx++) {
        for (let j = 0; j < preset_log_list[idx].length; j++) {
            signals.push(preset_log_list[idx][j]);
        }
    }

    return signals;
}

// simulate a single clock phase, updating trace and highlighting layout
function step() {
    const state = chip.state_string();
    const memory = get_memory();

    trace[cycle] = {
        chip: state,
        mem: memory
    };

    if (golden_check_sum !== undefined) {
        trace_check_sum = adler32(trace_check_sum + state + memory.slice(0, 511).toString());
    }

    half_step();

    cycle++;

    log_chip_status();
    console.log(`OUTPUT: ${output}`);
}

function update_log_list(names = '') {
    // user supplied a list of signals, which we append to the set defined by loglevel
    log_these.length = 0;
    log_these.push(...signal_set(window.log_level));

    const name_list = names.split(/[\s,]+/);

    for (let idx = 0; idx < name_list.length; idx++) {
        // could be a signal name, a node number, or a special name
        if (bus_to_string(name_list[idx]) !== undefined) {
            log_these.push(name_list[idx]);
        }
    }

    const logged: string[] =
        log_these.map(line => line.replace(/^-/, ''))
            .map((val, idx) => val.padStart(padding_log_list[idx]));

    console.log(`${logged.join(' | ')}\n`);
}

// for one-hot or few-hot signal collections we want to list the active ones
// and for brevity we remove the common prefix
function list_active_signals(pattern: string): string[] {
    const predicate = new RegExp(pattern);
    const signals: string[] = [];

    for (const idx in window.node_name_list) {
        const node_name = window.node_name_list[idx];

        if (predicate.test(node_name)) {
            if (chip.is_node_high(window.node_names[node_name]))
                // also map hyphen to a non-breaking version
                signals.push(node_name.replace(predicate, '').replace(/-/g, '&#8209'));
        }
    }

    return signals;
}

// The 6502 TCState is almost but not quite an inverted one-hot shift register
function list_active_tc_states(): string {
    const states: string[] = [];

    if (!chip.is_node_high(window.node_names['clock1'])) states.push('T0');
    if (!chip.is_node_high(window.node_names['clock2'])) states.push('T1');
    if (!chip.is_node_high(window.node_names['t2'])) states.push('T2');
    if (!chip.is_node_high(window.node_names['t3'])) states.push('T3');
    if (!chip.is_node_high(window.node_names['t4'])) states.push('T4');
    if (!chip.is_node_high(window.node_names['t5'])) states.push('T5');

    return states.join('+');
}

// Show all time code node states (active and inactive) in fixed format,
// with non-PLA-controlling internal state indication in square
// brackets, followed by RCL-resident timing state indication.
// '..' for a PLA-controlling node indicates inactive state, "T"* for a
// PLA-controlling node indicates active state.
// Bracketed codes are one of T1/V0/T6/..
// V0 indicates the VEC0 node, T6 is a synonym for the VEC1 node.
// The RCL codes are one of SD1/SD2/...
// For discussion of this reconstruction, see:
// http://visual6502.org/wiki/index.php?title=6502_Timing_States
function all_tc_states(): string {
    const spc = ' ';

    let states = '';

    states += (!chip.is_node_high(window.node_names['clock1'])) ? 'T0' : '..';
    states += spc;

    // T+ in visual6502 is called T1x in
    // http://www.weihenstephan.org/~michaste/pagetable/6502/6502.jpg
    // Notated as T+ for compatibility with PLA node names

    states += !chip.is_node_high(window.node_names['clock2']) ? 'T+' : '..';
    states += spc;
    states += !chip.is_node_high(window.node_names['t2']) ? '..' : '..';
    states += spc;
    states += !chip.is_node_high(window.node_names['t3']) ? '..' : '..';
    states += spc;
    states += !chip.is_node_high(window.node_names['t4']) ? '..' : '..';
    states += spc;
    states += !chip.is_node_high(window.node_names['t5']) ? '..' : '..';
    states += spc + '[';

    // Check three confirmed exclusive states (three nodes)
    if (chip.is_node_high(862)) {
        states += '..';
        // ...else if VEC0 is on...
    } else if (chip.is_node_high(window.node_names['VEC0'])) {
        // ...then tell the outside world
        states += '..';
        // ...else if VEC1 is on...
    } else if (chip.is_node_high(window.node_names['VEC1'])) {
        // ...then this is the canonical T6. It is a synonym for VEC1
        states += '..';
    } else {
        // ...else none of the "hidden" bits in the clock state is active
        states += '..';
    }

    states += ']' + spc;

    // Check the RCL'states two confirmed exclusive states (two window.nodes)
    // If this node is grounding ~WR...
    if (chip.is_node_high(440)) {
        // ...then we can regard this state as Store Data 1
        states += 'SD1';
        // ...else if this node is grounding ~WR...
    } else if (chip.is_node_high(1258)) {
        // ...then we can regard this state as Store Data 2
        states += 'SD2';
    } else {
        // ...else none of the RCL-resident timing bits is active
        states += '...';
    }

    return states;
}

const read_bit = (name: string) => chip.is_node_high(window.node_names[name]) ? 1 : 0;

function read_bits(name: string, bit_count: number): number {
    let bits = 0;

    for (let idx = 0; idx < bit_count; idx++) {
        const node_number = window.node_names[`${name}${idx}`];

        bits += ((chip.is_node_high(node_number)) ? 1 : 0) << idx;
    }

    return bits;
}

function bus_to_string(bus_name: string): string[] {
    // takes a signal name or prefix
    // returns an appropriate string representation
    // some 'signal names' are CPU-specific aliases to user-friendly string output
    if (bus_name === 'cycle') return [(cycle >> 1).toString()];
    if (bus_name === 'pc') return [bus_to_hex('pch') + bus_to_hex('pcl')];
    if (bus_name === 'p') return [read_p_string()];
    if (bus_name === 'tcstate') return [['clock1', 'clock2', 't2', 't3', 't4', 't5'].map(bus_to_hex).join('')];
    if (bus_name === 'State') return [list_active_tc_states()];
    if (bus_name === 'TState') return [all_tc_states()];
    if (bus_name === 'Phi')
        // Pretty-printed phase indication based on the state of cp1,
        // the internal Phase 1 node
        return ['&Phi;' + (chip.is_node_high(window.node_names['cp1']) ? '1' : '2')];
    if (bus_name === 'Execute') return [disassemble(read_bits('ir', 8))];
    if (bus_name === 'Fetch') return [chip.is_node_high(window.node_names['sync']) ? disassemble(read_data_bus()) : ''];
    // PLA outputs are mostly ^op- but some have a prefix too
    //    - we'll allow the x and xx prefix but ignore the #
    if (bus_name === 'plaOutputs') return list_active_signals('^([x]?x-)?op-');
    if (bus_name === 'DPControl') return list_active_signals('^dpc[-]?[0-9]+_');
    if (bus_name[0] === '-') {
        // invert the value of the bus for display
        const value = bus_to_hex(bus_name.slice(1));

        if (value !== undefined) {
            return [value.replace(/./g, function (x) {
                return (15 - parseInt(x, 16)).toString(16);
            })];
        } else {
            return [''];
        }
    } else {
        return [bus_to_hex(bus_name)];
    }
}

function bus_to_hex(bus_name: string): string {
    // may be passed a bus or a signal, so allow multiple signals
    let width = 0;
    const node_name_check = new RegExp('^' + bus_name + '[0-9]+$');

    for (const idx in window.node_name_list) {
        if (node_name_check.test(window.node_name_list[idx])) {
            width++;
        }
    }

    if (width === 0) {
        // not a bus, so could be a signal, a node number or a mistake
        if (window.node_names[bus_name] !== undefined) {
            return chip.is_node_high(window.node_names[bus_name]) ? '1' : '0';
        }

        const node = parseInt(bus_name);

        if ((!isNaN(node)) && (typeof window.nodes[node] !== undefined)) {
            return chip.is_node_high(node) ? '1' : '0';
        }

        return '';
    }

    if (width > 16) return '';

    // finally, convert from logic values to hex
    return (0x10000 + read_bits(bus_name, width)).toString(16).slice(-(width - 1) / 4 - 1);
}

function write_data_bus(data: number) {
    const recalc_nodes: number[] = [];

    for (let idx = 0; idx < 8; idx++) {
        const node_number = window.node_names['db' + idx];
        const node = window.nodes[node_number];

        if ((data % 2) === 0) {
            node.pull_down = true;
            node.pull_up = false;
        } else {
            node.pull_down = false;
            node.pull_up = true;
        }

        recalc_nodes.push(node_number);

        data >>= 1;
    }

    chip.recalc_node_list(recalc_nodes);
}

function _clk_nodes(): number[] {
    const nodes: number[] = [];

    nodes.push(943);

    for (const idx in window.nodes[943].gates) {
        const transistor = window.nodes[943].gates[idx];

        if (transistor.c1 === window.npwr) {
            nodes.push(transistor.c2);
        }

        if (transistor.c2 === window.npwr) {
            nodes.push(transistor.c1);
        }
    }

    return nodes;
}

const stop_chip = () => running = false;

function reset_chip() {
    initialized = false;
    console.log('resetting ' + chip_name + '...');
    stop_chip();
    init_chip();
}

function log_chip_status() {
    const address_bus = read_address_bus();

    const machine1 =
        'halfcyc:' + cycle +
        ' phi0:' + read_bit('clk0') +
        ' AB:' + hex_word(address_bus) +
        ' D:' + hex_byte(read_data_bus()) +
        ' RnW:' + read_bit('rw');

    const machine2 =
        'PC:' + hex_word(read_program_counter()) +
        ' A:' + hex_byte(read_accumulator()) +
        ' X:' + hex_byte(read_index_x()) +
        ' Y:' + hex_byte(read_index_y()) +
        ' SP:' + hex_byte(read_stack_pointer()) +
        ' ' + read_p_string();

    let machine3 = 'Hz: ' + estimate_hz().toFixed(1);

    if (expert_mode) {
        machine3 += ' Exec: ' + bus_to_string('Execute') + '(' + bus_to_string('State') + ')';

        if (chip.is_node_high(window.node_names['sync'])) {
            machine3 += ' (Fetch: ' + bus_to_string('Fetch') + ')';
        }

        if (golden_check_sum !== undefined) {
            machine3 += ' Chk:' + trace_check_sum + ((trace_check_sum === golden_check_sum) ? ' OK' : ' no match');
        }
    }

    console.log(`${[machine1, machine2, machine3].join('\n')}\n`);

    log_signals(log_these);
}

// return an averaged speed: called periodically during normal running
function estimate_hz(): number {
    if (cycle % hz_sampling_rate !== 3) return prev_hz_estimate1;

    const hz_timestamp: number = now();

    let hz_estimate = (cycle - prev_hz_cycle_count + .01) / (hz_timestamp - prev_hz_timestamp + .01);

    hz_estimate = hz_estimate * 1000 / 2; // convert from phases per millisecond to Hz

    if (hz_estimate < 5) {
        hz_sampling_rate = 5;  // quicker
    }

    if (hz_estimate > 10) {
        hz_sampling_rate = 10; // smoother
    }

    prev_hz_estimate2 = prev_hz_estimate1;
    prev_hz_estimate1 = (hz_estimate + prev_hz_estimate1 + prev_hz_estimate2) / 3; // wrong way to average speeds
    prev_hz_timestamp = hz_timestamp;
    prev_hz_cycle_count = cycle;

    return prev_hz_estimate1
}

// return instantaneous speed: called twice, before and after a timed run using go_for()
function instantaneous_hz(): number {
    const hz_timestamp: number = now();

    let hz_estimate = (cycle - prev_hz_cycle_count + .01) / (hz_timestamp - prev_hz_timestamp + .01);

    hz_estimate = hz_estimate * 1000 / 2; // convert from phases per millisecond to Hz
    prev_hz_estimate1 = hz_estimate;
    prev_hz_estimate2 = prev_hz_estimate1;
    prev_hz_timestamp = hz_timestamp;
    prev_hz_cycle_count = cycle;

    return prev_hz_estimate1
}

// update the table of signal values, by prepending or appending
function log_signals(names: string[]) {
    if (log_these.length < 2) return;

    const signals: string[] = [];

    for (const name in names) {
        const bus = bus_to_string(names[name]);
        signals.push(...bus);
    }

    const log = signals.map((val, idx) => val.padStart(padding_log_list[idx])).join(' | ');

    if (log.length > 0) {
        console.log(`${log}\n`);
    }
}

function get_memory(): number[] {
    const data: number[] = [];

    for (let idx = 0; idx < 0x200; idx++) {
        data.push(memory_read(idx));
    }

    return data;
}

function set_memory(data: number[]) {
    for (let idx = 0; idx < 0x200; idx++) {
        memory_write(idx, data[idx]);
    }
}

function adler32(x: string) {
    let lo = 1;
    let hi = 0;

    for (let idx = 0; idx < x.length; idx++) {
        lo = (lo + x.charCodeAt(idx)) % 65521;
        hi = (hi + lo) % 65521;
    }

    return (0x100000000 + (hi << 16) + lo).toString(16).slice(-8);
}

// sanitised opcode for HTML output
function disassemble(address: number) {
    const opcode = disassembly[address];

    return opcode === undefined ? 'unknown' : opcode;
}

// opcode lookup for 6502 - not quite a disassembly
//   javascript derived from Debugger.java by Achim Breidenbach
const disassembly: Disassembly = {
    0x00: 'BRK',
    0x01: 'ORA (zp,X)',
    0x05: 'ORA zp',
    0x06: 'ASL zp',
    0x08: 'PHP',
    0x09: 'ORA #',
    0x0A: 'ASL ',
    0x0D: 'ORA Abs',
    0x0E: 'ASL Abs',
    0x10: 'BPL ',
    0x11: 'ORA (zp),Y',
    0x15: 'ORA zp,X',
    0x16: 'ASL zp,X',
    0x18: 'CLC',
    0x19: 'ORA Abs,Y',
    0x1D: 'ORA Abs,X',
    0x1E: 'ASL Abs,X',
    0x20: 'JSR Abs',
    0x21: 'AND (zp,X)',
    0x24: 'BIT zp',
    0x25: 'AND zp',
    0x26: 'ROL zp',
    0x28: 'PLP',
    0x29: 'AND #',
    0x2A: 'ROL ',
    0x2C: 'BIT Abs',
    0x2D: 'AND Abs',
    0x2E: 'ROL Abs',
    0x30: 'BMI ',
    0x31: 'AND (zp),Y',
    0x35: 'AND zp,X',
    0x36: 'ROL zp,X',
    0x38: 'SEC',
    0x39: 'AND Abs,Y',
    0x3D: 'AND Abs,X',
    0x3E: 'ROL Abs,X',
    0x40: 'RTI',
    0x41: 'EOR (zp,X)',
    0x45: 'EOR zp',
    0x46: 'LSR zp',
    0x48: 'PHA',
    0x49: 'EOR #',
    0x4A: 'LSR ',
    0x4C: 'JMP Abs',
    0x4D: 'EOR Abs',
    0x4E: 'LSR Abs',
    0x50: 'BVC ',
    0x51: 'EOR (zp),Y',
    0x55: 'EOR zp,X',
    0x56: 'LSR zp,X',
    0x58: 'CLI',
    0x59: 'EOR Abs,Y',
    0x5D: 'EOR Abs,X',
    0x5E: 'LSR Abs,X',
    0x60: 'RTS',
    0x61: 'ADC (zp,X)',
    0x65: 'ADC zp',
    0x66: 'ROR zp',
    0x68: 'PLA',
    0x69: 'ADC #',
    0x6A: 'ROR ',
    0x6C: 'JMP (Abs)',
    0x6D: 'ADC Abs',
    0x6E: 'ROR Abs',
    0x70: 'BVS ',
    0x71: 'ADC (zp),Y',
    0x75: 'ADC zp,X',
    0x76: 'ROR zp,X',
    0x78: 'SEI',
    0x79: 'ADC Abs,Y',
    0x7D: 'ADC Abs,X',
    0x7E: 'ROR Abs,X',
    0x81: 'STA (zp,X)',
    0x84: 'STY zp',
    0x85: 'STA zp',
    0x86: 'STX zp',
    0x88: 'DEY',
    0x8A: 'TXA',
    0x8C: 'STY Abs',
    0x8D: 'STA Abs',
    0x8E: 'STX Abs',
    0x90: 'BCC ',
    0x91: 'STA (zp),Y',
    0x94: 'STY zp,X',
    0x95: 'STA zp,X',
    0x96: 'STX zp,Y',
    0x98: 'TYA',
    0x99: 'STA Abs,Y',
    0x9A: 'TXS',
    0x9D: 'STA Abs,X',
    0xA0: 'LDY #',
    0xA1: 'LDA (zp,X)',
    0xA2: 'LDX #',
    0xA4: 'LDY zp',
    0xA5: 'LDA zp',
    0xA6: 'LDX zp',
    0xA8: 'TAY',
    0xA9: 'LDA #',
    0xAA: 'TAX',
    0xAC: 'LDY Abs',
    0xAD: 'LDA Abs',
    0xAE: 'LDX Abs',
    0xB0: 'BCS ',
    0xB1: 'LDA (zp),Y',
    0xB4: 'LDY zp,X',
    0xB5: 'LDA zp,X',
    0xB6: 'LDX zp,Y',
    0xB8: 'CLV',
    0xB9: 'LDA Abs,Y',
    0xBA: 'TSX',
    0xBC: 'LDY Abs,X',
    0xBD: 'LDA Abs,X',
    0xBE: 'LDX Abs,Y',
    0xC0: 'CPY #',
    0xC1: 'CMP (zp,X)',
    0xC4: 'CPY zp',
    0xC5: 'CMP zp',
    0xC6: 'DEC zp',
    0xC8: 'INY',
    0xC9: 'CMP #',
    0xCA: 'DEX',
    0xCC: 'CPY Abs',
    0xCD: 'CMP Abs',
    0xCE: 'DEC Abs',
    0xD0: 'BNE ',
    0xD1: 'CMP (zp),Y',
    0xD5: 'CMP zp,X',
    0xD6: 'DEC zp,X',
    0xD8: 'CLD',
    0xD9: 'CMP Abs,Y',
    0xDD: 'CMP Abs,X',
    0xDE: 'DEC Abs,X',
    0xE0: 'CPX #',
    0xE1: 'SBC (zp,X)',
    0xE4: 'CPX zp',
    0xE5: 'SBC zp',
    0xE6: 'INC zp',
    0xE8: 'INX',
    0xE9: 'SBC #',
    0xEA: 'NOP',
    0xEC: 'CPX Abs',
    0xED: 'SBC Abs',
    0xEE: 'INC Abs',
    0xF0: 'BEQ ',
    0xF1: 'SBC (zp),Y',
    0xF5: 'SBC zp,X',
    0xF6: 'INC zp,X',
    0xF8: 'SED',
    0xF9: 'SBC Abs,Y',
    0xFD: 'SBC Abs,X',
    0xFE: 'INC Abs,X',
};