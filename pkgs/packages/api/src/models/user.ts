import { Sex } from "./common/sex";
import { MetriportData } from "./metriport-data";

export interface User extends MetriportData {
  age?: number;
  first_name?: string;
  last_name?: string;
  city?: string;
  country?: string;
  date_of_birth?: string;
  email?: string;
  region?: string; // can be state, province, etc.
  sex?: Sex;
}
