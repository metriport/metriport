export { detailedErrorToString, errorToString, ErrorToStringOptions } from "@metriport/shared";

type LogParamBasic = string | number | boolean | unknown | null | undefined;
export type LogParam = LogParamBasic | (() => LogParamBasic);
