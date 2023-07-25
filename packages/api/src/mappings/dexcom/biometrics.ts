import { Biometrics } from "@metriport/api-sdk";

import { DexcomEvgs } from "./models/evgs";
import { PROVIDER_DEXCOM } from "../../shared/constants";
import { Util } from "../../shared/util";

export const mapToBiometrics = (dexcomBiometrics: DexcomEvgs, date: string): Biometrics => {
  const metadata = {
    date: date,
    source: PROVIDER_DEXCOM,
  };

  const biometrics: Biometrics = {
    metadata: metadata,
  };

  const samples = dexcomBiometrics.records.flatMap(record =>
    record.value
      ? {
          time: record.displayTime,
          value: record.value,
        }
      : []
  );

  const mgDlValues = dexcomBiometrics.records.reduce((acc: number[], curr) => {
    const unitMgDl = "mg/dL";
    const unitMmolL = "mmol/L";
    const conversion = 18.0182;

    if (curr.value) {
      if (curr.unit === unitMgDl) {
        acc.push(curr.value);
      } else if (curr.unit === unitMmolL) {
        const convertValue = conversion * curr.value;
        acc.push(convertValue);
      }
    }

    return acc;
  }, []);

  biometrics.blood_glucose = {
    samples_mg_dL: samples,
    avg_mg_dL: Util.getAvgOfArr(mgDlValues),
  };

  return biometrics;
};
