import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyMedia, componentMismatch, imageModelIndex, mediaNotice, type MediaRecord } from "../src/lib/media-verification";
import { skuMedia } from "../src/lib/media";
import { getStorefrontSkus } from "../src/lib/storefront/catalog";

const record = (patch: Partial<MediaRecord>): MediaRecord => ({
  modelNumber: "ABC-123",
  productType: "Outdoor unit",
  image: "/products/abc-123.webp",
  images: ["/products/abc-123.webp"],
  referenceImages: [],
  imageVerification: "verified",
  ...patch,
});

describe("media verification", () => {
  it("is exact only when no other model uses the image", () => {
    const own = record({});
    const shared = [record({ modelNumber: "FJ5-36", image: "/f.webp", images: ["/f.webp"] }), record({ modelNumber: "FJ5-48", image: "/f.webp", images: ["/f.webp"] })];
    const index = imageModelIndex([own, ...shared]);
    assert.equal(classifyMedia(own, index), "verifiedExact");
    assert.equal(classifyMedia(shared[0], index), "verifiedFamily");
  });

  it("does not downgrade two catalog rows of the same model", () => {
    const a = record({ modelNumber: "TWH-12" });
    const b = record({ modelNumber: "twh 12" });
    assert.equal(classifyMedia(a, imageModelIndex([a, b])), "verifiedExact");
  });

  it("downgrades on a shared secondary image too", () => {
    const a = record({ modelNumber: "A", image: "/a.webp", images: ["/a.webp", "/shared.webp"] });
    const b = record({ modelNumber: "B", image: "/b.webp", images: ["/b.webp", "/shared.webp"] });
    assert.equal(classifyMedia(a, imageModelIndex([a, b])), "verifiedFamily");
  });

  it("never calls media exact without a model number or with a family flag", () => {
    const noModel = record({ modelNumber: null });
    const family = record({ imageVerification: "manufacturer_family" });
    assert.equal(classifyMedia(noModel, imageModelIndex([noModel])), "verifiedFamily");
    assert.equal(classifyMedia(family, imageModelIndex([family])), "verifiedFamily");
  });

  it("separates unverified reference photos from missing media", () => {
    const reference = record({ imageVerification: "unverified", image: null, images: [], referenceImages: ["/ref.jpg"] });
    const none = record({ imageVerification: "unverified", image: null, images: [] });
    assert.equal(classifyMedia(reference, new Map()), "reference");
    assert.equal(classifyMedia(none, new Map()), "missing");
  });

  it("withholds an image of a different component", () => {
    assert.equal(componentMismatch("Outdoor unit", "/products/tcl-tpro-wall-head.webp"), true);
    assert.equal(componentMismatch("Air handler", "/products/tcl-48k-condenser.jpeg"), true);
    assert.equal(componentMismatch("Outdoor unit", "/products/tosot-wall-system-pair.webp"), false);
    assert.equal(componentMismatch("Outdoor unit", "/products/tcl24kodu.webp"), false);
    assert.equal(componentMismatch("Indoor unit", "/products/tcl-tpro-indoor-front.webp"), false);
    const wrong = record({ productType: "Outdoor unit", image: "/x/tcl-tpro-wall-head.webp", images: ["/x/tcl-tpro-wall-head.webp"] });
    assert.equal(classifyMedia(wrong, imageModelIndex([wrong])), "missing");
  });

  it("lets a reviewer lower confidence but never raise it", () => {
    const own = record({});
    const index = imageModelIndex([own]);
    assert.equal(classifyMedia(own, index, { verdict: "withhold", reason: "x" }), "missing");
    assert.equal(classifyMedia(own, index, { verdict: "family", reason: "x" }), "verifiedFamily");
    const none = record({ imageVerification: "unverified", image: null, images: [] });
    assert.equal(classifyMedia(none, new Map(), { verdict: "family", reason: "x" }), "missing");
  });

  it("states every non-exact state in words, with a visible label when an image is shown", () => {
    assert.equal(mediaNotice("verifiedExact", "X1").badge, null);
    assert.match(mediaNotice("verifiedExact", "X1").detail, /model X1/);
    assert.equal(mediaNotice("verifiedFamily", "X1").badge, "Representative");
    assert.match(mediaNotice("verifiedFamily", "X1").detail, /not model X1 specifically/);
    assert.equal(mediaNotice("reference", "X1").badge, "Reference photo");
    assert.match(mediaNotice("missing", "X1").detail, /manufacturer model and specifications/);
  });
});

describe("catalog media surfaces", () => {
  const skus = getStorefrontSkus();

  it("gives the card and the product page the same state and first image", () => {
    for (const sku of skus) {
      const media = skuMedia(sku);
      assert.equal(media.verification, sku.mediaVerification);
      assert.equal(media.primarySrc, media.items[0]?.src ?? null);
      if (sku.mediaVerification === "missing") assert.equal(media.items.length, 0, `${sku.sku} is missing but shows media`);
      else assert.ok(media.items.length > 0, `${sku.sku} is ${sku.mediaVerification} with no media`);
    }
  });

  it("never shows the placeholder logo as product media", () => {
    for (const sku of skus) assert.ok(skuMedia(sku).items.every((item) => !item.src.includes("logo-summit")), sku.sku);
  });

  it("withholds the known wrong-component images", () => {
    for (const code of ["TCL09KODU", "TCL12KODU", "TCL18KODU-R-410A", "TCL18KMZODU-R-410A", "TCL48KAHU", "TCL60KAHU", "TCL24KODU", "DCT414"]) {
      const sku = skus.find((item) => item.sku === code)!;
      assert.equal(sku.mediaVerification, "missing", code);
    }
  });
});
