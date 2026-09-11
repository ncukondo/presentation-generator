import { describe, expect, test } from "bun:test";
import {
  renumberDuplicateShapeIds,
  findMediaShapeId,
  mediaTimingXml,
  injectMediaTiming,
  processSlideXml,
  requestMediaPlayback,
  takeMediaPlayback,
} from "./postprocess";

const VIDEO_PIC = (id: number, name = "demo video") =>
  `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"><a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr>` +
  `<p:cNvPicPr/><p:nvPr><a:videoFile r:link="rId2"/></p:nvPr></p:nvPicPr><p:blipFill/><p:spPr/></p:pic>`;
const SHAPE = (id: number, name: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/></p:sp>`;
const slide = (body: string) =>
  `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr>${body}</p:spTree></p:cSld>` +
  `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

describe("renumberDuplicateShapeIds", () => {
  test("no duplicates → untouched", () => {
    const xml = slide(SHAPE(2, "a") + SHAPE(3, "b"));
    const r = renumberDuplicateShapeIds(xml);
    expect(r.xml).toBe(xml);
    expect(r.changed).toEqual([]);
  });

  test("later duplicate gets a fresh id above the max", () => {
    const xml = slide(SHAPE(2, "a") + SHAPE(5, "b") + SHAPE(2, "c"));
    const r = renumberDuplicateShapeIds(xml);
    expect(r.changed).toEqual([[2, 6]]);
    expect(r.xml).toContain('<p:cNvPr id="6" name="c"/>');
    expect(r.xml).toContain('<p:cNvPr id="2" name="a"/>');
  });

  test("a video pic keeps its id even when it comes later; the earlier shape is renumbered", () => {
    const xml = slide(SHAPE(2, "a") + SHAPE(4, "b") + VIDEO_PIC(4));
    const r = renumberDuplicateShapeIds(xml);
    expect(r.changed).toEqual([[4, 5]]);
    expect(r.xml).toContain('<p:cNvPr id="5" name="b"/>');
    expect(r.xml).toContain('<p:cNvPr id="4" name="demo video">');
  });
});

describe("findMediaShapeId", () => {
  test("finds the video pic by name, ignoring plain shapes with the same name", () => {
    const xml = slide(SHAPE(2, "demo video") + VIDEO_PIC(7));
    expect(findMediaShapeId(xml, "demo video")).toBe(7);
    expect(findMediaShapeId(xml, "nope")).toBeUndefined();
  });
});

describe("mediaTimingXml", () => {
  test("empty when nothing is requested", () => {
    expect(mediaTimingXml([])).toBe("");
    expect(mediaTimingXml([{ spid: 4, autoplay: false, loop: false }])).toBe("");
  });

  test("autoplay + loop: playFrom withEffect in mainSeq and a looping cMediaNode", () => {
    const x = mediaTimingXml([{ spid: 4, autoplay: true, loop: true }]);
    expect(x.startsWith("<p:timing><p:tnLst><p:par><p:cTn id=\"1\"")).toBe(true);
    expect(x).toContain('nodeType="mainSeq"');
    expect(x).toContain('nodeType="withEffect"');
    expect(x).toContain('<p:cmd type="call" cmd="playFrom(0.0)">');
    expect(x).toContain('<p:cMediaNode vol="80000"><p:cTn id="7" repeatCount="indefinite"');
    expect(x.match(/<p:spTgt spid="4"\/>/g)?.length).toBe(2);
    // ids are unique
    const ids = [...x.matchAll(/<p:cTn id="(\d+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("loop only: no main sequence, just the media node", () => {
    const x = mediaTimingXml([{ spid: 4, autoplay: false, loop: true }]);
    expect(x).not.toContain("mainSeq");
    expect(x).toContain('repeatCount="indefinite"');
  });

  test("autoplay only: no repeatCount", () => {
    const x = mediaTimingXml([{ spid: 4, autoplay: true, loop: false }]);
    expect(x).toContain("mainSeq");
    expect(x).not.toContain("repeatCount");
  });
});

describe("injectMediaTiming", () => {
  test("inserts before </p:sld> after clrMapOvr", () => {
    const xml = slide(VIDEO_PIC(4));
    const out = injectMediaTiming(xml, [{ name: "demo video", autoplay: true, loop: true }]);
    expect(out).toMatch(/<\/p:clrMapOvr><p:timing>.*<\/p:timing><\/p:sld>$/);
  });

  test("goes before a slide-level extLst and after a transition", () => {
    const xml = slide(VIDEO_PIC(4)).replace("</p:sld>", '<p:transition spd="slow"><p:fade/></p:transition><p:extLst/></p:sld>');
    const out = injectMediaTiming(xml, [{ name: "demo video", autoplay: true, loop: false }]);
    expect(out.indexOf("<p:timing>")).toBeGreaterThan(out.indexOf("</p:transition>"));
    expect(out.indexOf("<p:timing>")).toBeLessThan(out.indexOf("<p:extLst/>"));
  });

  test("unknown media name / existing timing throw", () => {
    const xml = slide(VIDEO_PIC(4));
    expect(() => injectMediaTiming(xml, [{ name: "x", autoplay: true, loop: true }])).toThrow(/not found/);
    const once = injectMediaTiming(xml, [{ name: "demo video", autoplay: true, loop: true }]);
    expect(() => injectMediaTiming(once, [{ name: "demo video", autoplay: true, loop: true }])).toThrow(/already has/);
  });
});

describe("processSlideXml", () => {
  test("repairs ids first, then transition, then timing — in CT_Slide order", () => {
    const xml = slide(SHAPE(4, "dup") + VIDEO_PIC(4));
    const r = processSlideXml(xml, {
      transition: { type: "morph" },
      media: [{ name: "demo video", autoplay: true, loop: true }],
    });
    expect(r.renumbered).toEqual([[4, 5]]);
    const iTrans = r.xml.indexOf("<mc:AlternateContent");
    const iTiming = r.xml.indexOf("<p:timing>");
    expect(iTrans).toBeGreaterThan(r.xml.indexOf("</p:clrMapOvr>"));
    expect(iTiming).toBeGreaterThan(iTrans);
    // timing targets the video's (unchanged) id
    expect(r.xml).toContain('<p:spTgt spid="4"/>');
  });

  test("empty spec with clean ids is a no-op", () => {
    const xml = slide(SHAPE(2, "a"));
    expect(processSlideXml(xml, {}).xml).toBe(xml);
  });
});

describe("media registry", () => {
  test("requests are drained per slide", () => {
    const s1 = {} as any, s2 = {} as any;
    requestMediaPlayback(s1, { name: "v", autoplay: true, loop: true });
    expect(takeMediaPlayback(s2)).toEqual([]);
    expect(takeMediaPlayback(s1)).toEqual([{ name: "v", autoplay: true, loop: true }]);
    expect(takeMediaPlayback(s1)).toEqual([]);
  });
});
