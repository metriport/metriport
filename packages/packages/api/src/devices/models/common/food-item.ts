import { Aminos } from "./aminos";
import { Macros } from "./macros";
import { Micros } from "./micros";

export interface FoodItem {
  name?: string;
  brand?: string;
  amount?: number;
  unit?: string;
  nutrition_facts?: {
    macros?: Macros;
    micros?: Micros;
    aminos?: Aminos;
  };
}
