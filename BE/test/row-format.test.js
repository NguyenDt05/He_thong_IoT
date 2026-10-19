const assert = require("node:assert/strict");
const test = require("node:test");
const { formatDateTime } = require("../src/repos/rowFormat");

test("formats database time consistently for API processing and display", () => {
    assert.deepEqual(formatDateTime("2026-10-16 00:29:05"), {
        iso: "2026-10-15T17:29:05.000Z",
        text: "2026/10/16 00:29:05",
    });
});

test("returns null fields for an unsupported database time", () => {
    assert.deepEqual(formatDateTime("not-a-date"), { iso: null, text: null });
});
