import {
  normalizeDob,
  normalizeGender,
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
  normalizeTelephone,
  normalizeSsn,
  normalizeEmail,
  //patientToNormalizedAndStringLinkedDemoData,
} from "../patient-demographics";

describe("normalization", () => {
  it("check dob normalization", async () => {
    const dobValid = normalizeDob("2023-08-01");
    expect(dobValid).toBe("2023-08-01");
    const dobTrim = normalizeDob(" 2023-08-01 ");
    expect(dobTrim).toBe("2023-08-01");
    const dobTrimSlice = normalizeDob(" 2023-08-0100 ");
    expect(dobTrimSlice).toBe("2023-08-01");
    const dobUndefined = normalizeDob();
    expect(dobUndefined).toBe("");
  });
  it("check gender normalization", async () => {
    const genderValid = normalizeGender("male");
    expect(genderValid).toBe("male");
    const genderTrim = normalizeGender(" male ");
    expect(genderTrim).toBe("male");
    const genderTrimLowercase = normalizeGender(" Male ");
    expect(genderTrimLowercase).toBe("male");
    const genderInValidType = normalizeGender("M");
    expect(genderInValidType).toBe("unknown");
    const genderMaleMisspelled = normalizeGender("malee");
    expect(genderMaleMisspelled).toBe("unknown");
    const genderFemaleMisspelled = normalizeGender("femalee");
    expect(genderFemaleMisspelled).toBe("unknown");
    const genderUndefined = normalizeGender();
    expect(genderUndefined).toBe("unknown");
  });
  it("check names normalization", async () => {
    const nameValidValue = { firstName: "john", lastName: "smith" };
    const nameValidValueString = JSON.stringify(nameValidValue, Object.keys(nameValidValue).sort());
    const namesValid = normalizeAndStringifyNames(nameValidValue);
    expect(namesValid).toBe(nameValidValueString);
    const namesTrim = normalizeAndStringifyNames({ firstName: " john ", lastName: " smith " });
    expect(namesTrim).toBe(nameValidValueString);
    const namesTrimLowercase = normalizeAndStringifyNames({
      firstName: " John ",
      lastName: " Smith ",
    });
    expect(namesTrimLowercase).toBe(nameValidValueString);
    const namesParamSwitch = normalizeAndStringifyNames({
      lastName: " Smith ",
      firstName: " John ",
    });
    expect(namesParamSwitch).toBe(nameValidValueString);
  });
  it("check address normalization", async () => {
    const addressValidValue = {
      line: ["1 mordhaus st", "apt 1a"],
      city: "mordhaus",
      state: "ny",
      zip: "66666",
      country: "usa",
    };
    const addressValidValueString = JSON.stringify(
      addressValidValue,
      Object.keys(addressValidValue).sort()
    );
    const addressValid = normalizeAddress(addressValidValue);
    expect(addressValid).toMatchObject(addressValidValue);
    const addressTrim = normalizeAddress({
      line: [" 1 mordhaus st ", " apt 1a "],
      city: " mordhaus ",
      state: " ny ",
      zip: " 66666 ",
      country: " usa ",
    });
    expect(addressTrim).toMatchObject(addressValidValue);
    const addressTrimLowercase = normalizeAddress({
      line: [" 1 Mordhaus St ", " Apt 1A "],
      city: " Mordhaus ",
      state: " NY ",
      zip: " 66666 ",
      country: " USA ",
    });
    expect(addressTrimLowercase).toMatchObject(addressValidValue);
    const addressTrimLowercaseZipAlphanumeric = normalizeAddress({
      line: [" 1 Mordhaus St ", " Apt 1A "],
      city: " Mordhaus ",
      state: " NY ",
      zip: " 66666abc ",
      country: " USA ",
    });
    expect(addressTrimLowercaseZipAlphanumeric).toMatchObject(addressValidValue);
    const addressTrimLowercaseZipNumericSlice = normalizeAddress({
      line: [" 1 Mordhaus St ", " Apt 1A "],
      city: " Mordhaus ",
      state: " NY ",
      zip: " 66666-1234abc ",
      country: " USA ",
    });
    expect(addressTrimLowercaseZipNumericSlice).toMatchObject(addressValidValue);
    const addressUndefined = normalizeAddress({
      line: undefined,
      city: undefined,
      state: undefined,
      zip: undefined,
      country: undefined,
    });
    expect(addressUndefined).toMatchObject({
      line: [],
      city: "",
      state: "",
      zip: "",
      country: "",
    });
    const addressString = stringifyAddress(addressValidValue);
    expect(addressString).toBe(addressValidValueString);
  });
  it("check telephone normalization", async () => {
    const phoneValid = normalizeTelephone("14150000000");
    expect(phoneValid).toBe("14150000000");
    const phoneTrim = normalizeTelephone(" 14150000000 ");
    expect(phoneTrim).toBe("14150000000");
    const phoneTrimNumeric = normalizeTelephone(" +1(415)-000-0000 ");
    expect(phoneTrimNumeric).toBe("14150000000");
    const phoneTrimNumeric2 = normalizeTelephone(" (415)-000-0000 ");
    expect(phoneTrimNumeric2).toBe("4150000000");
    const phoneTrimNumeric3 = normalizeTelephone(" 415-000-0000 ");
    expect(phoneTrimNumeric3).toBe("4150000000");
  });
  it("check email normalization", async () => {
    const emailValid = normalizeEmail("test@gmail.com");
    expect(emailValid).toBe("test@gmail.com");
    const emailTrim = normalizeEmail(" test@gmail.com ");
    expect(emailTrim).toBe("test@gmail.com");
    const emailTrimLowercase = normalizeEmail(" TEST@GMAIL.COM ");
    expect(emailTrimLowercase).toBe("test@gmail.com");
  });
  // TODO DriversLicense
  it("check ssn normalization", async () => {
    const ssnValid = normalizeSsn("000000000");
    expect(ssnValid).toBe("000000000");
    const ssnTrim = normalizeSsn(" 000000000 ");
    expect(ssnTrim).toBe("000000000");
    const ssnTrimNumeric = normalizeSsn(" 000-00-0000 ");
    expect(ssnTrimNumeric).toBe("000000000");
  });
});
