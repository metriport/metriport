import { faker } from "@faker-js/faker";
import { USState } from "@metriport/shared";

/**
 * Generates a random driver's license number based on state format rules
 * See: https://www.starpointscreening.com/blog/drivers-license-format-by-state/
 */
export function generateDriversLicenseForState(state: USState): string {
  switch (state) {
    case USState.AL:
      return randomNum(faker.number.int({ min: 7, max: 8 }));
    case USState.AK:
      return randomNum(7);
    case USState.AZ:
      return randomAlpha(1) + randomNum(8);
    case USState.AR:
      return randomNum(9);
    case USState.CA:
      return randomAlpha(1) + randomNum(7);
    case USState.CO:
      return randomNum(9);
    case USState.CT:
      return randomNum(9);
    case USState.DE:
      return randomNum(faker.number.int({ min: 1, max: 7 }));
    case USState.FL:
      return randomAlpha(1) + randomNum(12);
    case USState.GA:
      return faker.datatype.boolean() ? randomNum(7) : randomNum(9);
    case USState.HI:
      return "H" + randomNum(faker.number.int({ min: 8, max: 9 }));
    case USState.ID:
      return faker.datatype.boolean()
        ? randomAlpha(2) + randomNum(6)
        : randomAlpha(1) + randomNum(9);
    case USState.IL:
      return randomAlpha(1) + randomNum(11);
    case USState.IN:
      return randomNum(10);
    case USState.IA:
      return randomNum(9);
    case USState.KS:
      return "K" + randomNum(8);
    case USState.KY:
      return randomAlpha(1) + randomNum(8);
    case USState.LA:
      return "0" + randomNum(8);
    case USState.ME:
      return randomNum(7);
    case USState.MD:
      return randomAlpha(1) + randomNum(12);
    case USState.MA:
      return randomNum(9);
    case USState.MI:
      return randomAlpha(1) + randomNum(12);
    case USState.MN:
      return randomAlpha(1) + randomNum(12);
    case USState.MS:
      return randomNum(9);
    case USState.MO:
      return randomAlpha(1) + randomNum(9);
    case USState.MT:
      return faker.datatype.boolean() ? randomAlpha(13) : randomNum(9);
    case USState.NE:
      return randomAlpha(1) + randomNum(8);
    case USState.NV:
      return faker.datatype.boolean() ? randomNum(9) : randomNum(12);
    case USState.NH:
      return randomNum(2) + randomAlpha(3) + randomNum(5);
    case USState.NJ:
      return randomAlpha(1) + randomNum(14);
    case USState.NM:
      return randomNum(9);
    case USState.NY:
      return randomNum(9);
    case USState.NC:
      return randomNum(12);
    case USState.ND:
      return randomAlpha(3) + randomNum(9);
    case USState.OH:
      return randomAlpha(2) + randomNum(6);
    case USState.OK:
      return randomAlpha(1) + randomNum(9);
    case USState.OR:
      return randomAlpha(1) + randomNum(7);
    case USState.PA:
      return randomNum(8);
    case USState.RI:
      return "V" + randomNum(6);
    case USState.SC:
      return randomNum(faker.number.int({ min: 6, max: 11 }));
    case USState.SD:
      return randomNum(8);
    case USState.TN:
      return randomNum(9);
    case USState.TX:
      return randomNum(8);
    case USState.UT:
      return randomNum(faker.number.int({ min: 7, max: 10 }));
    case USState.VT:
      return randomNum(8);
    case USState.VA:
      return randomAlpha(1) + randomNum(8);
    case USState.WA:
      return randomAlpha(5) + randomNum(3) + randomAlphaNum(2);
    case USState.WV:
      return randomNum(6) + randomAlpha(1) + randomNum(6);
    case USState.WI:
      return randomAlpha(1) + randomNum(13);
    case USState.WY:
      return randomNum(9);
    default:
      return randomNum(9);
  }
}

function randomNum(amount: number): string {
  return faker.helpers.replaceSymbols(`#`.repeat(amount));
}
function randomAlpha(amount: number): string {
  return faker.helpers.replaceSymbols(`?`.repeat(amount));
}
function randomAlphaNum(amount: number): string {
  return faker.helpers.replaceSymbols(`*`.repeat(amount));
}
