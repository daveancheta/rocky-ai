import assert from "node:assert/strict"
import test from "node:test"
import {
  detectVisionChanges,
  filterNewVisionChanges,
  MIN_VISION_CONFIDENCE,
  parseVisionSnapshot,
} from "../lib/companion/vision-change.ts"

const snapshot = (objects, confidence = 0.94) => ({
  summary: "A mug and notebook are visible on a desk.",
  confidence,
  objects: objects.map(([name, location, certainty = 0.93]) => ({ name, location, confidence: certainty })),
})

test("parses structured observations and rejects uncertain or malformed output", () => {
  const parsed = parseVisionSnapshot(JSON.stringify({
    summary: "A mug is on a desk.",
    confidence: 0.91,
    objects: [{ name: "mug", location: "center", confidence: 0.9 }],
  }))
  assert.equal(parsed?.objects[0].name, "mug")
  assert.equal(parseVisionSnapshot("not JSON"), undefined)
  assert.equal(parseVisionSnapshot(JSON.stringify({ summary: "unclear", confidence: 0.4, objects: [] }))?.confidence, 0.4)
  assert.equal(parseVisionSnapshot(JSON.stringify({ summary: "x", confidence: 1.4, objects: [] })), undefined)
})

test("detects high-confidence new objects and position changes only between successful snapshots", () => {
  const before = snapshot([["mug", "center"], ["book", "top_left"]])
  const after = snapshot([["mug", "bottom_right"], ["book", "top_left"], ["phone", "center"]])
  const changes = detectVisionChanges(before, after)
  assert.equal(changes.length, 2)
  assert.ok(changes.every((change) => change.confidence >= MIN_VISION_CONFIDENCE))
  assert.ok(changes.some((change) => change.signature === "appeared:phone"))
  assert.ok(changes.some((change) => change.signature === "position:mug:center:bottom right"))
})

test("low confidence suppresses changes and missing objects are described cautiously", () => {
  const before = snapshot([["glass", "center"]])
  assert.deepEqual(detectVisionChanges(before, snapshot([], 0.6)), [])
  const missing = detectVisionChanges(before, snapshot([]))
  assert.equal(missing.length, 1)
  assert.match(missing[0].text, /may simply be outside the current frame/)
})

test("repeated change signatures are suppressed until their cooldown expires", () => {
  const changes = detectVisionChanges(snapshot([["mug", "center"]]), snapshot([["mug", "bottom_right"]]))
  const seen = new Map()
  assert.equal(filterNewVisionChanges(changes, seen, 1_000).length, 1)
  assert.equal(filterNewVisionChanges(changes, seen, 2_000).length, 0)
  assert.equal(filterNewVisionChanges(changes, seen, 1_000 + 15 * 60_000).length, 1)
})

test("first observation establishes a baseline without announcing a change", () => {
  assert.deepEqual(detectVisionChanges(undefined, snapshot([["mug", "center"]])), [])
})
