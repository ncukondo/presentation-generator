import { describe, expect, test } from "bun:test";
import {
  parseTransition,
  resolveTransition,
  transitionXml,
  injectTransitionXml,
  morphName,
  morphOpt,
} from "./transitions";

describe("parseTransition", () => {
  test("undefined / null → not declared", () => {
    expect(parseTransition("p", undefined)).toEqual({ errors: [], warnings: [] });
    expect(parseTransition("p", null)).toEqual({ errors: [], warnings: [] });
  });

  test("short form", () => {
    expect(parseTransition("p", "morph").spec).toEqual({ type: "morph" });
    expect(parseTransition("p", "none").spec).toEqual({ type: "none" });
  });

  test("unknown type is an error", () => {
    expect(parseTransition("p", "zoom").errors[0]).toMatch(/unknown transition "zoom"/);
    expect(parseTransition("p", { type: "zoom" }).errors[0]).toMatch(/p\.type/);
    expect(parseTransition("p", 3).errors[0]).toMatch(/expected string or object/);
  });

  test("long form with option / duration", () => {
    const r = parseTransition("p", { type: "morph", option: "byWord", duration: 0.6 });
    expect(r.errors).toEqual([]);
    expect(r.spec).toEqual({ type: "morph", option: "byWord", duration: 0.6 });
  });

  test("option on non-morph and direction on non-push are warnings, not errors", () => {
    const a = parseTransition("p", { type: "fade", option: "byObject" });
    expect(a.errors).toEqual([]);
    expect(a.warnings[0]).toMatch(/option.*only meaningful/);
    const b = parseTransition("p", { type: "morph", direction: "left" });
    expect(b.errors).toEqual([]);
    expect(b.warnings[0]).toMatch(/direction.*only meaningful/);
  });

  test("bad option / direction / duration values are errors", () => {
    expect(parseTransition("p", { type: "morph", option: "byLine" }).errors[0]).toMatch(/p\.option/);
    expect(parseTransition("p", { type: "push", direction: "diag" }).errors[0]).toMatch(/p\.direction/);
    expect(parseTransition("p", { type: "fade", duration: 0 }).errors[0]).toMatch(/p\.duration/);
    expect(parseTransition("p", { type: "fade", duration: "1s" }).errors[0]).toMatch(/p\.duration/);
  });

  test("unknown field is a warning", () => {
    expect(parseTransition("p", { type: "fade", speed: 2 }).warnings[0]).toMatch(/p\.speed: unknown field/);
  });
});

describe("resolveTransition", () => {
  test("slide wins over default; none suppresses; undefined falls back", () => {
    expect(resolveTransition("morph", "fade")).toEqual({ type: "morph" });
    expect(resolveTransition("none", "fade")).toBeUndefined();
    expect(resolveTransition(undefined, "fade")).toEqual({ type: "fade" });
    expect(resolveTransition(undefined, undefined)).toBeUndefined();
    expect(resolveTransition(undefined, "none")).toBeUndefined();
  });
});

describe("transitionXml", () => {
  test("none → empty", () => {
    expect(transitionXml({ type: "none" })).toBe("");
  });

  test("morph uses p159 with a fade fallback and default 1000ms", () => {
    const x = transitionXml({ type: "morph" });
    expect(x).toContain('<mc:Choice Requires="p159">');
    expect(x).toContain('<p159:morph option="byObject"/>');
    expect(x).toContain('p14:dur="1000"');
    expect(x).toContain('spd="slow"');
    expect(x).toContain("<mc:Fallback><p:transition spd=\"slow\"><p:fade/></p:transition></mc:Fallback>");
    // Prefixes named in Requires are declared on the wrapper, with the exact
    // namespaces PowerPoint expects (morph = 2015/09; 2015/10 is silently dropped).
    expect(x).toContain('xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main"');
    expect(x).toContain('xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"');
    expect(x).toMatch(/<mc:AlternateContent [^>]*xmlns:p159=/);
  });

  test("morph option / duration are honoured", () => {
    const x = transitionXml({ type: "morph", option: "byChar", duration: 0.4 });
    expect(x).toContain('<p159:morph option="byChar"/>');
    expect(x).toContain('p14:dur="400"');
    expect(x).toContain('spd="fast"');
  });

  test("push / wipe carry a direction; fade is plain", () => {
    expect(transitionXml({ type: "push", direction: "up" })).toContain('<p:push dir="u"/>');
    expect(transitionXml({ type: "push" })).toContain('<p:push dir="l"/>');
    expect(transitionXml({ type: "wipe", direction: "right" })).toContain('<p:wipe dir="r"/>');
    const f = transitionXml({ type: "fade", duration: 0.75 });
    expect(f).toContain('<mc:Choice Requires="p14">');
    expect(f).toContain('spd="med"');
    expect(f).toContain("<p:fade/>");
  });
});

describe("injectTransitionXml", () => {
  const SLIDE =
    '<p:sld xmlns:p="x"><p:cSld><p:spTree><p:extLst/></p:spTree></p:cSld>' +
    "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>";

  test("inserts after </p:clrMapOvr>", () => {
    const out = injectTransitionXml(SLIDE, { type: "fade" });
    expect(out).toMatch(/<\/p:clrMapOvr><mc:AlternateContent .*<\/mc:AlternateContent><\/p:sld>$/);
    // extLst inside cSld is not mistaken for the slide-level one.
    expect(out.indexOf("<mc:AlternateContent")).toBeGreaterThan(out.indexOf("</p:cSld>"));
  });

  test("inserts after </p:cSld> when there is no clrMapOvr", () => {
    const out = injectTransitionXml('<p:sld><p:cSld></p:cSld></p:sld>', { type: "fade" });
    expect(out).toMatch(/<\/p:cSld><mc:AlternateContent .*<\/mc:AlternateContent><\/p:sld>$/);
  });

  test("goes before a slide-level <p:timing> / <p:extLst>", () => {
    const withTiming = '<p:sld><p:cSld></p:cSld><p:clrMapOvr/><p:timing/></p:sld>';
    const out = injectTransitionXml(withTiming, { type: "fade" });
    expect(out.indexOf("<mc:AlternateContent")).toBeLessThan(out.indexOf("<p:timing"));
    expect(out.indexOf("<mc:AlternateContent")).toBeGreaterThan(out.indexOf("<p:clrMapOvr/>"));
  });

  test("none leaves the XML untouched; existing transition throws", () => {
    expect(injectTransitionXml(SLIDE, { type: "none" })).toBe(SLIDE);
    const once = injectTransitionXml(SLIDE, { type: "fade" });
    expect(() => injectTransitionXml(once, { type: "fade" })).toThrow(/already has/);
  });
});

describe("morph names", () => {
  test("morphName / morphOpt", () => {
    expect(morphName("card")).toBe("!!card");
    expect(morphName("card", "heading")).toBe("!!card.heading");
    expect(morphOpt("card", "body")).toEqual({ objectName: "!!card.body" });
    expect(morphOpt(undefined, "body")).toEqual({});
  });
});
