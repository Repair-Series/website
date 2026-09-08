import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlayableVideoUrl, shouldShowCategoryVideo } from "../../components/category-video";

describe("category video", () => {
  it("shows https mp4 url when enabled", () => {
    assert.equal(
      shouldShowCategoryVideo({
        videoUrl: "https://res.cloudinary.com/demo/video/upload/sample.mp4",
        videoEnabled: true,
      }),
      true,
    );
  });

  it("hides missing url", () => {
    assert.equal(shouldShowCategoryVideo({ videoUrl: "", videoEnabled: true }), false);
  });

  it("hides disabled video", () => {
    assert.equal(
      shouldShowCategoryVideo({
        videoUrl: "https://cdn.example.com/cat.mp4",
        videoEnabled: false,
      }),
      false,
    );
  });

  it("rejects invalid url", () => {
    assert.equal(isPlayableVideoUrl("not-a-url"), false);
    assert.equal(isPlayableVideoUrl("javascript:alert(1)"), false);
    assert.equal(isPlayableVideoUrl("https://youtube.com/watch?v=abc"), false);
  });
});
