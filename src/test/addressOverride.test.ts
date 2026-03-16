import { describe, it, expect } from "vitest";
import { isAddressInputValid, formatManualAddress } from "@/components/AddressOverrideForm";
import type { ManualAddressInput } from "@/components/AddressOverrideForm";

describe("AddressOverrideForm helpers", () => {
  describe("isAddressInputValid", () => {
    it("returns false when via is empty", () => {
      expect(isAddressInputValid({ via: "", civico: "", cap: "", comune: "Padova", provincia: "" })).toBe(false);
    });

    it("returns false when comune is empty", () => {
      expect(isAddressInputValid({ via: "Via Roma", civico: "1", cap: "35100", comune: "", provincia: "PD" })).toBe(false);
    });

    it("returns false when via is too short", () => {
      expect(isAddressInputValid({ via: "V", civico: "", cap: "", comune: "Padova", provincia: "" })).toBe(false);
    });

    it("returns true when via and comune are filled", () => {
      expect(isAddressInputValid({ via: "Via Roma", civico: "", cap: "", comune: "Padova", provincia: "" })).toBe(true);
    });

    it("returns true with all fields filled", () => {
      expect(isAddressInputValid({ via: "Via Roma", civico: "12", cap: "35100", comune: "Padova", provincia: "PD" })).toBe(true);
    });
  });

  describe("formatManualAddress", () => {
    it("formats full address correctly", () => {
      const addr: ManualAddressInput = { via: "Via Roma", civico: "12", cap: "35100", comune: "Padova", provincia: "PD" };
      expect(formatManualAddress(addr)).toBe("Via Roma 12, 35100, Padova, (PD)");
    });

    it("formats without civico", () => {
      const addr: ManualAddressInput = { via: "Via Roma", civico: "", cap: "35100", comune: "Padova", provincia: "" };
      expect(formatManualAddress(addr)).toBe("Via Roma, 35100, Padova");
    });

    it("formats minimal address", () => {
      const addr: ManualAddressInput = { via: "Via Roma", civico: "", cap: "", comune: "Milano", provincia: "" };
      expect(formatManualAddress(addr)).toBe("Via Roma, Milano");
    });

    it("trims whitespace", () => {
      const addr: ManualAddressInput = { via: "  Via Roma  ", civico: " 5 ", cap: "", comune: " Roma ", provincia: " rm " };
      expect(formatManualAddress(addr)).toBe("Via Roma 5, Roma, (RM)");
    });
  });

  describe("priority logic", () => {
    it("manual address takes priority over empty scanned address", () => {
      const manual: ManualAddressInput = { via: "Via Verdi", civico: "3", cap: "20100", comune: "Milano", provincia: "MI" };
      const scannedAddress = "";
      const effectiveAddress = isAddressInputValid(manual) ? formatManualAddress(manual) : scannedAddress;
      expect(effectiveAddress).toBe("Via Verdi 3, 20100, Milano, (MI)");
    });

    it("manual address takes priority over existing scanned address", () => {
      const manual: ManualAddressInput = { via: "Via Verdi", civico: "3", cap: "", comune: "Milano", provincia: "" };
      const scannedAddress = "Via Garibaldi 10, Roma";
      const effectiveAddress = isAddressInputValid(manual) ? formatManualAddress(manual) : scannedAddress;
      expect(effectiveAddress).toBe("Via Verdi 3, Milano");
    });

    it("scanned address is used when no manual override", () => {
      const manual: ManualAddressInput = { via: "", civico: "", cap: "", comune: "", provincia: "" };
      const scannedAddress = "Via Garibaldi 10, Roma";
      const effectiveAddress = isAddressInputValid(manual) ? formatManualAddress(manual) : scannedAddress;
      expect(effectiveAddress).toBe("Via Garibaldi 10, Roma");
    });
  });
});
