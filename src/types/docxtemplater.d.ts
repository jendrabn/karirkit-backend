declare module "docxtemplater" {
  import PizZip from "pizzip";

  interface DocxtemplaterOptions {
    paragraphLoop?: boolean;
    linebreaks?: boolean;
  }

  interface GenerateOptions {
    type: string;
    compression?: "DEFLATE" | "STORE" | string;
  }

  export default class Docxtemplater {
    constructor(zip: PizZip, options?: DocxtemplaterOptions);
    render(data: Record<string, unknown>): void;
    getZip(): {
      generate(options: GenerateOptions): Buffer;
    };
  }
}
