/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "saxon-js" {
  type GetResourceOptions = {
    type: "text" | "json" | "xml";
    encoding?: "utf8" | "ucs2" | "utf16le" | "latin1" | "ascii";
  } & (
    | {
        location: string;
      }
    | {
        file: string;
      }
    | {
        text: string;
      }
  );
  function getResource(params: GetResourceOptions, processing?: "async"): Promise<unknown>;

  type TransformOptions = {
    stylesheetText: string;
    stylesheetParams?: Record<string, any>;
    sourceText?: string;
    sourceNode?: any;
    sourceFileName?: string;
    sourceBaseURI?: string;
    destination?:
      | "replaceBody"
      | "appendToBody"
      | "prependToBody"
      | "raw"
      | "document"
      | "application"
      | "file"
      | "stdout"
      | "serialized";
    initialTemplate?: string;
    initialMode?: string;
    initialFunction?: string;
  };

  function transform(
    options: TransformOptions,
    processing?: "async"
  ): Promise<{ principalResult: string }>;
}
