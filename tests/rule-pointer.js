/**
 * The shape of a table row's `rule`: a POINTER to the book, never copied text (RULINGS *The rule fold
 * reads the book*). An item pointer names the pack item and its uuid; a rules-page pointer names the
 * page and its CONFIG key; either may name the bold lead of the paragraph the row is about.
 */
import { expect } from "vitest";

const PAGES = ["condition", "mastery", "rule"];

/** Asserts `rule` is a frozen pointer, item or page, with a non-empty `benefit` when it carries one. */
export function expectPointer(rule, label = "") {
  expect(rule, label).toBeTypeOf("object");
  expect(rule, label).not.toBeNull();
  expect(Object.isFrozen(rule), label).toBe(true);
  if ("page" in rule) {
    expect(PAGES, label).toContain(rule.page);
    expect(rule.key, label).toBeTypeOf("string");
    expect(rule.key.length, label).toBeGreaterThan(0);
  } else {
    expect(rule.item, label).toBeTypeOf("string");
    expect(rule.item.length, label).toBeGreaterThan(0);
    expect(rule.uuid, label).toMatch(/^Compendium\.[\w-]+\.[\w-]+\.Item\.\w+$/);
  }
  if ("benefit" in rule) {
    expect(rule.benefit, label).toBeTypeOf("string");
    expect(rule.benefit.length, label).toBeGreaterThan(0);
  }
}
