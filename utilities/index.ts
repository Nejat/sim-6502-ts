import {exists} from "https://deno.land/std/fs/mod.ts";
import {writeAll} from "https://deno.land/std/streams/conversion.ts";

const debug_folder = "debugging";

export const array_contains = <T>(source: T[], item: T): boolean => source.indexOf(item) !== -1;

export const hex_word = (value: number): string => (0x10000 + value).toString(16).substring(1);

export const hex_byte = (value: number): string => (0x100 + value).toString(16).substring(1);

export const now = (): number => new Date().getTime();

export async function read_json<T>(file_name: string): Promise<T> {
    const decoder = new TextDecoder('utf-8');
    const data = await Deno.readFile(file_name);

    return JSON.parse(decoder.decode(data)) as T;
}

export async function write_json<T>(file_name: string, value: T): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(value));

    await Deno.writeFile(file_name, data);
}

export async function debug_writer(filename: string): Promise<DebugOutput> {
    if (!await exists(debug_folder)) {
        await Deno.mkdir(debug_folder);
    }

    const debug_output = await Deno.create(`${debug_folder}/${filename}`);
    const encoder = new TextEncoder();

    return async (debug: string) => await writeAll(debug_output, encoder.encode(`${debug}\n`));
}

export function console_ln_writer(): ConsoleOutput {
    const encoder = new TextEncoder();

    return async (debug: string) => await Deno.stdout.write(encoder.encode(`${debug}\n`));
}

export function console_writer(): ConsoleOutput {
    const encoder = new TextEncoder();

    return async (debug: string) => await Deno.stdout.write(encoder.encode(debug));
}