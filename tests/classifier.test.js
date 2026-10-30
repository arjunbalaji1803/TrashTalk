import test from "node:test";
import assert from "node:assert/strict";
import { classifyWaste } from "../src/classifier.js";

test("recognizes compost items", () => {
  assert.equal(classifyWaste("banana peel").category, "COMPOST");
  assert.equal(classifyWaste("coffee grounds").category, "COMPOST");
});

test("recognizes recyclable items", () => {
  assert.equal(classifyWaste("plastic bottle").category, "RECYCLE");
  assert.equal(classifyWaste("cardboard box").category, "RECYCLE");
});

test("specific waste types take priority over broad material words", () => {
  assert.equal(classifyWaste("plastic wrapper").category, "GENERAL");
  assert.equal(classifyWaste("paper towel").category, "GENERAL");
});

test("routes known general waste", () => {
  assert.equal(classifyWaste("used tissue").category, "GENERAL");
  assert.equal(classifyWaste("chip bag").category, "GENERAL");
});

test("does not route special-handling or unknown items", () => {
  assert.equal(classifyWaste("lithium battery").category, "SPECIAL");
  assert.equal(classifyWaste("mystery object").category, "UNKNOWN");
  assert.equal(classifyWaste("").category, "UNKNOWN");
});

test("ambiguous mixed items stay closed", () => {
  assert.equal(classifyWaste("banana peel and plastic bottle").category, "UNKNOWN");
});
