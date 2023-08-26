import { ZodError } from "zod";
import { Config } from "./config";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debug(msg: string, ...optionalParams: any[]): void {
  if (Config.isCloudEnv()) return;
  if (optionalParams) {
    if (typeof optionalParams[0] === typeof Function) {
      console.log(msg, optionalParams[0](), ...optionalParams.slice(1));
    } else {
      console.log(msg, ...optionalParams);
    }
  } else {
    console.log(msg);
  }
}

export function errorToString(err: unknown): string {
  return err instanceof ZodError
    ? Object.values(err.flatten().fieldErrors).join("; ")
    : (err as any)["message"] ?? String(err); // eslint-disable-line @typescript-eslint/no-explicit-any
}
