import { Biometrics } from "@metriport/api";
import { Sample } from "@metriport/api/lib/devices/models/common/sample";

import { DexcomBiometrics } from "./models/biometrics";
import { PROVIDER_DEXCOM } from "../../shared/constants";
import { Util } from "../../shared/util";

export const mapToBiometrics = (dexcomBiometrics: DexcomBiometrics, date: string): Biometrics => {
  const metadata = {
    date: date,
    source: PROVIDER_DEXCOM,
  };

  const biometrics: Biometrics = {
    metadata: metadata,
  };

  const samples = dexcomBiometrics.records.reduce((acc: Sample[], curr) => {
    if (curr.value) {
      acc.push({
        time: curr.displayTime,
        value: curr.value,
      });
    }

    return acc;
  }, []);

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
