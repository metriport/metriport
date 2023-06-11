import { Aminos } from "./common/aminos";
import { Macros } from "./common/macros";
import { Micros } from "./common/micros";
import { Food } from "./common/food";
import { MetriportData } from "./metriport-data";

export interface Nutrition extends MetriportData {
  summary?: { macros?: Macros; micros?: Micros; aminos?: Aminos };
  foods?: Food[];
}
