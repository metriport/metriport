import { Config } from "./config";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debug(msg: string, ...optionalParams: any[]): void {
  if (Config.isCloudEnv()) return;
  optionalParams ? console.log(msg, ...optionalParams) : console.log(msg);
}
