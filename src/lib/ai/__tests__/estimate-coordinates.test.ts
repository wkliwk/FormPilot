import { estimateMissingCoordinates, FormField } from "../analyze-form";

function makeField(overrides: Partial<FormField> = {}): FormField {
  return {
    id: "field_1",
    label: "First Name",
    type: "text",
    required: true,
    explanation: "Your legal first name",
    example: "John",
    commonMistakes: "Using nickname",
    ...overrides,
  };
}

describe("estimateMissingCoordinates", () => {
  it("returns fields unchanged when all have coordinates", () => {
    const fields: FormField[] = [
      makeField({ id: "f1", coordinates: { x: 0.1, y: 0.1, w: 0.5, h: 0.03, page: 1 } }),
      makeField({ id: "f2", coordinates: { x: 0.1, y: 0.3, w: 0.5, h: 0.03, page: 1 } }),
    ];
    const result = estimateMissingCoordinates(fields);
    expect(result).toEqual(fields);
  });

  it("returns empty array for empty input", () => {
    expect(estimateMissingCoordinates([])).toEqual([]);
  });

  it("assigns coordinates to fields missing them", () => {
    const fields: FormField[] = [
      makeField({ id: "f1" }),
      makeField({ id: "f2" }),
      makeField({ id: "f3" }),
    ];
    const result = estimateMissingCoordinates(fields);

    for (const field of result) {
      expect(field.coordinates).toBeDefined();
      expect(field.coordinates!.page).toBe(1);
      expect(field.coordinates!.x).toBeGreaterThanOrEqual(0);
      expect(field.coordinates!.x).toBeLessThanOrEqual(1);
      expect(field.coordinates!.y).toBeGreaterThanOrEqual(0);
      expect(field.coordinates!.y).toBeLessThanOrEqual(1);
      expect(field.coordinates!.w).toBeGreaterThan(0);
      expect(field.coordinates!.h).toBeGreaterThan(0);
    }
  });

  it("distributes fields vertically in order", () => {
    const fields: FormField[] = [
      makeField({ id: "f1" }),
      makeField({ id: "f2" }),
      makeField({ id: "f3" }),
    ];
    const result = estimateMissingCoordinates(fields);
    const y0 = result[0].coordinates!.y;
    const y1 = result[1].coordinates!.y;
    const y2 = result[2].coordinates!.y;
    expect(y1).toBeGreaterThan(y0);
    expect(y2).toBeGreaterThan(y1);
  });

  it("preserves existing coordinates and only fills missing ones", () => {
    const existing = { x: 0.2, y: 0.5, w: 0.6, h: 0.04, page: 1 };
    const fields: FormField[] = [
      makeField({ id: "f1" }),
      makeField({ id: "f2", coordinates: existing }),
      makeField({ id: "f3" }),
    ];
    const result = estimateMissingCoordinates(fields);
    expect(result[1].coordinates).toEqual(existing);
    expect(result[0].coordinates).toBeDefined();
    expect(result[2].coordinates).toBeDefined();
    expect(result[0].coordinates).not.toEqual(existing);
  });

  it("keeps estimated y values within page bounds", () => {
    // Create many fields to test bounds
    const fields: FormField[] = Array.from({ length: 50 }, (_, i) =>
      makeField({ id: `f${i}` })
    );
    const result = estimateMissingCoordinates(fields);
    for (const field of result) {
      const c = field.coordinates!;
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y + c.h).toBeLessThanOrEqual(1);
    }
  });
});
