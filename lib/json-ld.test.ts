import { describe, expect, it } from "vitest";
import { serializeForScriptTag } from "@/lib/json-ld";

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

describe("serializeForScriptTag", () => {
  it("escapes a closing script tag hidden in admin-authored content", () => {
    const out = serializeForScriptTag({ name: "Loafer</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });

  it("escapes every <, not just the ones forming a script tag", () => {
    expect(serializeForScriptTag({ d: "a < b" })).not.toContain("<");
  });

  it("escapes the JS line terminators that JSON.stringify leaves raw", () => {
    const out = serializeForScriptTag({ d: `a${LINE_SEPARATOR}b${PARAGRAPH_SEPARATOR}c` });
    expect(out).not.toContain(LINE_SEPARATOR);
    expect(out).not.toContain(PARAGRAPH_SEPARATOR);
  });

  it("round-trips to the identical value — escaping must not corrupt the payload", () => {
    const data = {
      name: `Oxford</script> "quoted" & <b>bold</b>${LINE_SEPARATOR}tail`,
      nested: { price: 129.9, tags: ["a<b", "c>d"] },
    };
    expect(JSON.parse(serializeForScriptTag(data))).toEqual(data);
  });

  it("leaves payloads with nothing to escape byte-identical to JSON.stringify", () => {
    const data = { name: "Derby", price: 149 };
    expect(serializeForScriptTag(data)).toBe(JSON.stringify(data));
  });
});
