import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { combinate } from "@batijs/tests-utils";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { execLocalBati } from "./src/exec-bati";

const matrix = combinate([["solid", "react", "vue"], "authjs"]);

function prepareAndExecute(flags: string[]) {
  const context = {
    tmpdir: "",
  };

  // Prepare tests:
  // - Create a temp dir
  beforeAll(async () => {
    context.tmpdir = await mkdtemp(join(tmpdir(), "bati-"));
  }, 5000);

  // Cleanup tests:
  // - Remove temp dir
  afterAll(async () => {
    await Promise.race([
      rm(context.tmpdir, { recursive: true, force: true }),
      new Promise((_resolve, reject) => setTimeout(reject, 5000)),
    ]).catch((e) => {
      console.log("Failed to delete tmpdir in time.");
      throw e;
    });
  }, 5500);

  // Common tests

  test("CLI fails", () => {
    expect(execLocalBati(context, flags, false)).rejects.toThrow();
  });

  return {
    context,
  };
}

describe.concurrent.each(matrix)(matrix[0].map(() => "%s").join(" + "), (...currentFlags: string[]) => {
  prepareAndExecute(currentFlags);
});