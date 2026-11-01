// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { ZOOM_BUTTON_ANIMATION_MS, ZOOM_COMMIT_DEBOUNCE_MS } from "@/lib/pdf/zoom";
import { useReaderPrefsStore } from "@/stores/reader-prefs.store";
import { useReaderZoom } from "./useReaderZoom";

type ZoomApi = ReturnType<typeof useReaderZoom>;

function Harness({ onRender }: { onRender: (api: ZoomApi) => void }) {
  const zoomApi = useReaderZoom({ stageRef: { current: null }, fullscreen: false });
  const { areaRef, scrollerRef, contentRef } = zoomApi;
  onRender(zoomApi);
  return (
    <div ref={areaRef} data-testid="area">
      <div ref={scrollerRef}>
        <div ref={contentRef} data-testid="content">
          <div data-page-slot="1" style={{ height: 1000 }} />
          <div data-page-slot="2" style={{ height: 1000 }} />
        </div>
      </div>
    </div>
  );
}

const zoom = () => useReaderPrefsStore.getState().zoom;
const frame = () => act(() => void vi.advanceTimersByTime(20));

function mount() {
  const state = { renders: 0, api: undefined as unknown as ZoomApi };
  const view = render(
    <Harness
      onRender={(api) => {
        state.renders += 1;
        state.api = api;
      }}
    />,
  );
  return { ...view, state };
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
  useReaderPrefsStore.setState({ zoom: 1 });
  window.scrollBy = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useReaderZoom: gesture paytida faqat DOM transform", () => {
  it("Ctrl+g'ildirak: harakat paytida qayta render ham, holat ham yo'q; 150 ms tinchlikdan keyin bir marta", () => {
    const { getByTestId, state } = mount();
    const content = getByTestId("content");
    const before = state.renders;
    for (let index = 0; index < 12; index += 1) {
      act(() => {
        window.dispatchEvent(
          new WheelEvent("wheel", { ctrlKey: true, deltaY: -4, cancelable: true }),
        );
      });
      frame();
    }
    expect(state.renders).toBe(before);
    expect(zoom()).toBe(1);
    expect(state.api.isZooming()).toBe(true);
    expect(content.style.transform).toMatch(/^scale\(1\.2\d*\)$/);
    expect(content.style.willChange).toBe("transform");

    act(() => void vi.advanceTimersByTime(ZOOM_COMMIT_DEBOUNCE_MS));
    expect(zoom()).toBeCloseTo(1.24, 2);
    // Bitta holat yozuvi → bitta qayta render; transform layout'ga almashdi.
    expect(state.renders).toBe(before + 1);
    expect(content.style.transform).toBe("");
    expect(content.style.willChange).toBe("");
    expect(state.api.isZooming()).toBe(false);
  });

  it("pinch: barmoqlar harakati render qilmaydi, qo'yilganda bir marta yoziladi", () => {
    const { getByTestId, state } = mount();
    const area = getByTestId("area");
    const touches = (gap: number) => [
      { clientX: 100, clientY: 200 },
      { clientX: 100 + gap, clientY: 200 },
    ];
    const before = state.renders;
    fireEvent.touchStart(area, { touches: touches(100) });
    for (const gap of [120, 140, 160, 180]) {
      fireEvent.touchMove(area, { touches: touches(gap) });
      frame();
    }
    expect(state.renders).toBe(before);
    expect(getByTestId("content").style.transform).toBe("scale(1.8)");
    fireEvent.touchEnd(area, { touches: [] });
    expect(zoom()).toBe(1.8);
    expect(state.renders).toBe(before + 1);
  });

  it("tugma: 180 ms silliq o'tish (transform), keyin bitta holat yozuvi; ketma-ket bosish yig'iladi", () => {
    const { getByTestId, state } = mount();
    const content = getByTestId("content");
    const before = state.renders;
    act(() => state.api.nudge(1));
    frame();
    frame();
    // Animatsiya o'rtasida: hali holat yozilmagan, transform 1 va 1.25 orasida.
    const mid = Number(content.style.transform.match(/scale\(([\d.]+)\)/)?.[1]);
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(1.25);
    expect(zoom()).toBe(1);
    // Animatsiya davomida yana «+»: oldindan ko'rishdagi qiymatdan keyingi pog'ona (1.25).
    act(() => state.api.nudge(1));
    act(() => void vi.advanceTimersByTime(ZOOM_BUTTON_ANIMATION_MS + 50));
    expect(zoom()).toBe(1.25);
    expect(state.renders).toBe(before + 1);
    expect(content.style.transform).toBe("");
  });

  it("gesture o'zgarishsiz tugasa holat yozilmaydi va transform olinadi", () => {
    const { getByTestId, state } = mount();
    const area = getByTestId("area");
    const before = state.renders;
    const touches = [
      { clientX: 100, clientY: 200 },
      { clientX: 200, clientY: 200 },
    ];
    fireEvent.touchStart(area, { touches });
    fireEvent.touchMove(area, { touches });
    frame();
    fireEvent.touchEnd(area, { touches: [] });
    expect(zoom()).toBe(1);
    expect(state.renders).toBe(before);
    expect(getByTestId("content").style.transform).toBe("");
  });
});
