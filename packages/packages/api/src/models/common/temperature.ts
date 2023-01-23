import { Sample } from "./sample";

export interface Temperature {
  core?: {
    avg_celcius?: number;
    samples_celcius?: Sample[];
  };
  delta_celcius?: number;
  skin?: {
    avg_celcius?: number;
    samples_celcius?: Sample[];
  };
}
