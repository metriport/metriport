import { Network } from "../../../domain/medical/network";
import { BaseDTO } from "./baseDTO";

export type NetworkDTO = BaseDTO & Network;

export function dtoFromModel(network: Network): NetworkDTO {
  return {
    id: "1",
    eTag: "1",
    ...network,
  };
}
