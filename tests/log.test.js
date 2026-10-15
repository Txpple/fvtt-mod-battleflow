import { afterEach, describe, expect, it, vi } from "vitest";

const { log, TITLE } = await import("../scripts/core.js");

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.CONFIG;
});

/** THE LOGGER (core.js, ARCHITECTURE §7 *The shared readers*): every console line opens with the title. */
describe("log — the module's one console door", () => {
  it("puts the title in front of the first argument and hands the rest on as they are", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = new Error("boom");
    log.warn("Could not relay the acknowledgement.", err);
    expect(warn).toHaveBeenCalledWith(`${TITLE} | Could not relay the acknowledgement.`, err);
    log.warn({ not: "a string" });
    expect(warn).toHaveBeenLastCalledWith(`${TITLE} |`, { not: "a string" });
  });

  it("reads the console at each call, so a page that swaps it hears every line", () => {
    const heard = [];
    const real = console.error;
    console.error = (...args) => heard.push(args.join(" "));
    try {
      log.error("The rescue window could not be drawn.");
    } finally {
      console.error = real;
    }
    expect(heard).toEqual([`${TITLE} | The rescue window could not be drawn.`]);
  });

  it("writes info lines as info, and debug lines only behind the debug switch", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    log.info("moved");
    expect(info).toHaveBeenCalledWith(`${TITLE} | moved`);
    log.debug("quiet");
    expect(debug).not.toHaveBeenCalled();
    globalThis.CONFIG = { debug: { bythebooks: true } };
    log.debug("heard");
    expect(debug).toHaveBeenCalledWith(`${TITLE} | heard`);
  });
});
