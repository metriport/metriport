import { Aminos } from "./common/aminos";
import { Macros } from "./common/macros";
import { Micros } from "./common/micros";
import { FoodItem } from "./common/food-item";
import { MetriportData } from "./metriport-data";

export interface Nutrition extends MetriportData {
  summary?: { macros?: Macros; micros?: Micros; aminos?: Aminos };
  foods?: FoodItem[];
}
