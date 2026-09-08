import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupSlotsByPeakWindows, flattenGroupSlotIndexes } from "../../../../technician/src/utils/peakSlotGroups";
import { SCHEDULE_SLOT_DEFS } from "../../../../technician/src/utils/workScheduleSlots";

describe("peak hour visual grouping", () => {
  it("08:00–10:00 groups two slots but keeps both indexes", () => {
    const groups = groupSlotsByPeakWindows({
      peakWindows: [{ startHour: 8, endHour: 10, label: "Peak Hour", enabled: true }],
    });
    const peak = groups.find((g) => g.type === "peak");
    assert.ok(peak && peak.type === "peak");
    assert.deepEqual(peak.slotIndexes, [0, 1]);
    assert.equal(peak.label.includes("8:00"), true);
    const flat = flattenGroupSlotIndexes(groups);
    assert.deepEqual(
      flat.slice().sort((a, b) => a - b),
      SCHEDULE_SLOT_DEFS.map((s) => s.index),
    );
  });

  it("08:00–11:00 groups three hourly slots", () => {
    const groups = groupSlotsByPeakWindows({
      peakWindows: [{ startHour: 8, endHour: 11, enabled: true }],
    });
    const peak = groups.find((g) => g.type === "peak");
    assert.ok(peak && peak.type === "peak");
    assert.deepEqual(peak.slotIndexes, [0, 1, 2]);
  });

  it("multiple peak ranges produce multiple groups", () => {
    const groups = groupSlotsByPeakWindows({
      peakWindows: [
        { startHour: 8, endHour: 10, label: "Morning", enabled: true },
        { startHour: 18, endHour: 19, label: "Evening", enabled: true },
      ],
    });
    const peaks = groups.filter((g) => g.type === "peak");
    assert.equal(peaks.length, 2);
    assert.ok(peaks[0].type === "peak" && peaks[0].slotIndexes.length === 2);
  });

  it("disabled window is ignored", () => {
    const groups = groupSlotsByPeakWindows({
      peakWindows: [{ startHour: 8, endHour: 10, enabled: false }],
    });
    assert.equal(groups.some((g) => g.type === "peak"), false);
  });

  it("partial overlap stays a single slot", () => {
    const groups = groupSlotsByPeakWindows({
      peakWindows: [{ startHour: 8, endHour: 8.5, enabled: true }],
    });
    assert.equal(
      groups.some((g) => g.type === "peak"),
      false,
    );
  });
});
