import { normalizeAddressLine } from "../address";

describe("mapCsvAddresses", () => {
  describe("normalizeAddressLine", () => {
    it("throws error when address line is undefined", () => {
      expect(() => normalizeAddressLine(undefined, "address")).toThrow("Missing address");
    });

    it("converts address to title case", () => {
      const input = "123 main street";
      const result = normalizeAddressLine(input, "address");
      expect(result).toBe("123 Main Street");
    });

    it("removes punctuation", () => {
      const input = "123 main st., apt. 4";
      const result = normalizeAddressLine(input, "address");
      expect(result).toBe("123 Main St Apt 4");
    });

    it("splits unit when splitUnit is true", () => {
      const input = "123 Main St Apt 4";
      const result = normalizeAddressLine(input, "address", true);
      expect(result).toEqual(["123 Main St", "Apt 4"]);
    });

    describe("handles various unit indicators when splitting", () => {
      const inputs = [
        "123 Main St Apartment 4",
        "123 Main St Unit 4",
        "123 Main St Suite 4",
        "123 Main St Ste 4",
        "123 Main St #4",
        "123 Main St No 4",
        "123 Main St Floor 4",
        "123 Main St Fl 4",
        "123 Main St Apt 4",
        "123 Main St Apt. 4",
      ];
      inputs.forEach(input => {
        it(`'${input}'`, () => {
          const result = normalizeAddressLine(input, "address", true);
          expect(result).toHaveLength(2);
          expect(result[0]).toBe("123 Main St");
          expect(result[0]).not.toContain("4");
          expect(result[1]).toContain("4");
        });
      });
    });

    it("returns single line when no unit is present with splitUnit true", () => {
      const input = "123 Main St";
      const result = normalizeAddressLine(input, "address", true);
      expect(result).toEqual(["123 Main St"]);
    });

    it("handles multiple spaces", () => {
      const input = "123   Main    St   Apt    4";
      const result = normalizeAddressLine(input, "address");
      expect(result).toBe("123 Main St Apt 4");
    });

    describe("redacted from the wild", () => {
      describe("expected", () => {
        const addresses: { input: string; output: string[] }[] = [
          {
            input: `PO BOX 666`,
            output: [`Po Box 666`],
          },
          {
            input: `PO BOX 666 (patient has no other address)`,
            output: [`Po Box 666`],
          },
          {
            input: `APARTMENTS SUPER DUPER APT #1`,
            output: [`Apartments Super Duper`, `Apt #1`],
          },
          {
            input: `123 Main st Apt 1-1`,
            output: [`123 Main St`, `Apt 1-1`],
          },
          {
            input: `123 S Main Hwy Apt 456, Building 7A`,
            output: [`123 S Main Hwy`, `Apt 456 Building 7a`],
          },
          {
            input: `12345 Main Ct #9`,
            output: [`12345 Main Ct`, `#9`],
          },
          {
            input: `12345 Stone Blvd, Unit 1 Apt 234`,
            output: [`12345 Stone Blvd`, `Unit 1 Apt 234`],
          },
          {
            input: `4567 Cloud Ave, Apt Simple CT apt B2`,
            output: [`4567 Cloud Ave`, `Apt Simple Ct Apt B2`],
          },
          {
            input: `999 W 6th St, Apt 0 `,
            output: [`999 W 6th St`, `Apt 0`],
          },
          {
            input: `100 Joseph CT APT G`,
            output: [`100 Joseph Ct`, `Apt G`],
          },
          {
            input: `123 E. Wave Street Apartment A`,
            output: [`123 E Wave Street`, `Apartment A`],
          },
          {
            input: `100 Monroe Ln Blg 45 Apartment 123`,
            output: [`100 Monroe Ln Blg 45`, `Apartment 123`],
          },
          {
            input: `1791 W 6th St, Apt 1`,
            output: [`1791 W 6th St`, `Apt 1`],
          },
          {
            input: `1606 S 8th St, Apt A7`,
            output: [`1606 S 8th St`, `Apt A7`],
          },
          {
            input: `8765 MISPELED APTS`,
            output: [`8765 Mispeled Apts`],
          },
          {
            input: `789 W Broom St, Fl 1`,
            output: [`789 W Broom St`, `Fl 1`],
          },
          {
            input: `852 S Bay Ln Ste 1i`,
            output: [`852 S Bay Ln`, `Ste 1i`],
          },
          {
            input: `505 W 99th St, Rm 201`,
            output: [`505 W 99th St`, `Rm 201`],
          },
          {
            input: `Most Western Flat 4567 E Mediterranean RD RM 123`,
            output: [`Most Western Flat 4567 E Mediterranean Rd`, `Rm 123`],
          },
          {
            input: `145 MAPLE Elm LN LOT 45`,
            output: [`145 Maple Elm Ln`, `Lot 45`],
          },
          {
            input: `420 W UNION RD `,
            output: [`420 W Union Rd`],
          },
          {
            input: `9874 N COUNTRY ST TRLR A76`,
            output: [`9874 N Country St`, `Trlr A76`],
          },
          {
            input: `9874 N COUNTRY ST, TRLR A76`,
            output: [`9874 N Country St`, `Trlr A76`],
          },
          {
            input: `12345 High Peak TRL`,
            output: [`12345 High Peak Trl`],
          },
          {
            input: `1 Limestone Ln, Apt 421 , -2178`,
            output: [`1 Limestone Ln`, "Apt 421 -2178"],
          },
          {
            input: `212 JOHANSON DR				197707080 `,
            output: [`212 Johanson Dr 197707080`],
          },
          {
            // Intentionally with a new line
            input: `2512 Cedar Stone Dr
Apt 1B`,
            output: [`2512 Cedar Stone Dr`, `Apt 1b`],
          },
          {
            input: `777 Alexander CT/Lane Apt. 4C`,
            output: [`777 Alexander Ct/lane`, `Apt 4c`],
          },
          {
            input: `1480 W 3th st Apt A-9`,
            output: [`1480 W 3th St`, `Apt A-9`],
          },
          {
            input: `505 PERSIAN RUG LN APT 123. . .`,
            output: [`505 Persian Rug Ln`, `Apt 123`],
          },
          {
            input: `1508 S-6TH ST,APT T`,
            output: [`1508 S-6th St`, `Apt T`],
          },
        ];

        addresses.forEach(address => {
          it(`should split or not accordingly: ${address.input}`, () => {
            const result = normalizeAddressLine(address.input, "address", true);
            expect(result).toEqual(expect.arrayContaining(address.output));
          });
        });
      });

      describe("limitations", () => {
        const addresses: { input: string; output: string[] }[] = [
          {
            input: `1 SUMMERTOWN NORTH CT FLORIDA`,
            output: [`1 Summertown North Ct Florida`], // Florida is the city/state
          },
          {
            input: `8547 STORMFLATS DR 	 5`,
            output: [`8547 Stormflats Dr 5`], // 5 is the unit
          },
          {
            input: `3456 Old Town Trl F1`,
            output: [`3456 Old Town Trl F1`], // F1 is the unit
          },
          {
            input: `420 CARVING LN APT I4 Sacramento`,
            output: [`420 Carving Ln`, `Apt I4 Sacramento`], // Sacramento is the city/state
          },
          {
            input: `101 king avenue 12345`,
            output: [`101 King Avenue 12345`], // 12345 is the zip code
          },
          {
            input: `22 London Circle, Apt 88, Norman,`,
            output: [`22 London Circle`, `Apt 88 Norman`],
          },
          {
            input: `123 Meridian St b23`,
            output: [`123 Meridian St B23`], // b23 is the unit
          },
          {
            input: `123 red knight manor dr # A`,
            output: [`123 Red Knight Manor Dr # A`],
          },
        ];
        addresses.forEach(address => {
          it(`cannot split this: ${address.input}`, () => {
            const result = normalizeAddressLine(address.input, "address", true);
            expect(result).toEqual(expect.arrayContaining(address.output));
          });
        });
      });
    });
  });
});
