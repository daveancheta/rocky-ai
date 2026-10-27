import assert from "node:assert/strict"
import test from "node:test"
import {
  isDuplicateProactiveMessage,
  getLocalTimeFromOffset,
  isGroundedProactiveMessage,
  isMeaningfulObservationChange,
  isQuietTime,
  parseProactiveDecision,
} from "../lib/companion/proactive-policy.ts"

test("quiet hours support daytime and overnight ranges", () => {
  assert.equal(isQuietTime("23:15", true, "22:00", "08:00"), true)
  assert.equal(isQuietTime("07:59", true, "22:00", "08:00"), true)
  assert.equal(isQuietTime("08:00", true, "22:00", "08:00"), false)
  assert.equal(isQuietTime("13:30", true, "13:00", "14:00"), true)
  assert.equal(isQuietTime("13:30", false, "13:00", "14:00"), false)
  assert.equal(isQuietTime("13:30", true, "13:00", "13:00"), false)
  assert.equal(isQuietTime("25:00", true, "22:00", "08:00"), false)
})

test("browser timezone offset is converted to local wall-clock time", () => {
  assert.equal(getLocalTimeFromOffset(new Date("2026-10-27T16:15:00.000Z"), -480), "00:15")
  assert.equal(getLocalTimeFromOffset(new Date("2026-10-27T16:15:00.000Z"), 300), "11:15")
})

test("proactive decisions require a parseable decision and confidence", () => {
  assert.deepEqual(parseProactiveDecision('{"decision":"speak","confidence":0.91,"message":"Your mug is near the edge."}'), {
    decision: "speak",
    confidence: 0.91,
    message: "Your mug is near the edge.",
  })
  assert.equal(parseProactiveDecision('{"decision":"speak","message":"Hello"}'), undefined)
  assert.equal(parseProactiveDecision('{"decision":"speak","confidence":1.1,"message":"Hello"}'), undefined)
  assert.equal(parseProactiveDecision(JSON.stringify({ decision: "speak", confidence: 0.9, message: "x".repeat(241) })), undefined)
  assert.equal(parseProactiveDecision("not json"), undefined)
})

test("a proactive message needs words grounded in available context", () => {
  assert.equal(isGroundedProactiveMessage("Your notebook is beside the lamp.", ["A notebook sits beside a lamp."]), true)
  assert.equal(isGroundedProactiveMessage("How did your marathon go?", ["You mentioned a garden project."]), false)
})

test("only a changed or distinct scene can trigger a vision evaluation", () => {
  assert.equal(isMeaningfulObservationChange("A mug is on the table.", "[UNCHANGED] A mug is on the table."), false)
  assert.equal(isMeaningfulObservationChange("A mug is on the table.", "[CHANGED] A book is beside the mug."), true)
  assert.equal(isMeaningfulObservationChange("A mug is on the table", "A mug is on the table"), false)
  assert.equal(isMeaningfulObservationChange(undefined, "A mug is on the table."), true)
})

test("duplicate proactive copy is recognized without matching unrelated messages", () => {
  assert.equal(isDuplicateProactiveMessage("Your glass is near the table edge.", "Your glass is near the table edge!"), true)
  assert.equal(isDuplicateProactiveMessage("Your glass is near the table edge.", "How did the project meeting go?"), false)
})
