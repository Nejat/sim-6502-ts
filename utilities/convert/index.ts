import "../../types/global.d.ts";
import {build_6502_net_list} from "./6502.ts";
import {write_json} from "../index.ts";

const net_list_6502: NetList = build_6502_net_list();

await write_json('definitions/net_list.json', net_list_6502);
