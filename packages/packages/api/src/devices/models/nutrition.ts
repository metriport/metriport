import { Aminos } from "./common/aminos";
import { Macros } from "./common/macros";
import { Micros } from "./common/micros";
import { MetriportData } from "./metriport-data";

export interface Nutrition extends MetriportData {
  summary?: { macros?: Macros; micros?: Micros; aminos?: Aminos };
  // todo: meals/food?
}
