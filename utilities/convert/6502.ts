import {get_node_names} from "./definitions/6502/node_names.ts";
import {get_segment_definitions} from "./definitions/6502/segment_defs.ts";
import {get_transistor_definitions} from "./definitions/6502/tansistor_defs.ts";
import {build_net_list} from "./net_lists.ts";

export function build_6502_net_list(): NetList {
    const node_names = get_node_names();
    const segment_definitions = get_segment_definitions();
    const transistor_definitions = get_transistor_definitions();

    return build_net_list(node_names, segment_definitions, transistor_definitions);
}