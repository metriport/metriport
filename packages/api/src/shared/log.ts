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
