import { describe, it, expect } from "vitest";
import { safeText, isRenderablePrimitive } from "@/lib/safeRender";

describe("safeText", () => {
  it("returns string as-is", () => {
    expect(safeText("hello")).toBe("hello");
  });

  it("converts number to string", () => {
    expect(safeText(42)).toBe("42");
  });

  it("converts boolean to string", () => {
    expect(safeText(true)).toBe("true");
  });

  it("returns fallback for null", () => {
    expect(safeText(null, "—")).toBe("—");
  });

  it("returns fallback for undefined", () => {
    expect(safeText(undefined, "N/D")).toBe("N/D");
  });

  it("joins array of strings", () => {
    expect(safeText(["a", "b", "c"])).toBe("a, b, c");
  });

  it("handles array of objects with label keys", () => {
    const arr = [{ label: "Foo" }, { label: "Bar" }];
    expect(safeText(arr)).toBe("Foo, Bar");
  });

  it("handles object with lowercase label", () => {
    expect(safeText({ label: "Test" })).toBe("Test");
  });

  it("handles object with uppercase Label (React Error #31 case)", () => {
    expect(safeText({ Label: "Valore Catastale" })).toBe("Valore Catastale");
  });

  it("handles object with Value key", () => {
    expect(safeText({ Value: "123" })).toBe("123");
  });

  it("handles object with text key", () => {
    expect(safeText({ text: "content" })).toBe("content");
  });

  it("handles nested unknown object with fallback", () => {
    expect(safeText({ foo: { bar: 1 } }, "—")).toBeTruthy();
    // Should not return empty or throw
  });

  it("returns empty fallback for empty object", () => {
    expect(safeText({}, "—")).toBe("—");
  });

  it("handles mixed array (primitives + objects)", () => {
    const arr = ["test", { label: "obj" }, 42];
    expect(safeText(arr)).toBe("test, obj, 42");
  });

  it("never returns [object Object]", () => {
    const cases = [
      {},
      { foo: "bar" },
      { nested: { deep: true } },
      [{ a: 1 }],
    ];
    for (const c of cases) {
      const result = safeText(c, "fallback");
      expect(result).not.toBe("[object Object]");
    }
  });
});

describe("isRenderablePrimitive", () => {
  it("returns true for string", () => expect(isRenderablePrimitive("a")).toBe(true));
  it("returns true for number", () => expect(isRenderablePrimitive(1)).toBe(true));
  it("returns true for null", () => expect(isRenderablePrimitive(null)).toBe(true));
  it("returns true for undefined", () => expect(isRenderablePrimitive(undefined)).toBe(true));
  it("returns false for object", () => expect(isRenderablePrimitive({})).toBe(false));
  it("returns false for array", () => expect(isRenderablePrimitive([])).toBe(false));
});
