declare module "pizzip" {
  export default class PizZip {
    constructor(data?: string | ArrayBuffer | Uint8Array | Buffer);
    load(data: string | ArrayBuffer | Uint8Array | Buffer): PizZip;
    file(name: string, data?: unknown): unknown;
    generate(options: Record<string, unknown>): unknown;
  }
}
