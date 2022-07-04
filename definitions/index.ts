import {initialize_node_names} from "./node_names.ts";
import {initialize_segment_definitions} from "./segment_defs.ts";
import {initialize_transistor_definitions} from "./tansistor_defs.ts";

export function initialize_definitions() {
    console.log('\nInitializing definitions ...')
    console.log('  - node names ...')
    initialize_node_names();
    console.log('  - segment definitions ...')
    initialize_segment_definitions();
    console.log('  - transistor definition ...')
    initialize_transistor_definitions();
}