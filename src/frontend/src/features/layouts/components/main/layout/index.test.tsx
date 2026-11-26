import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppLayout } from "./index";

// Opts this file into React's act() support.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Layout = Record<string, number>;

const responsive = vi.hoisted(() => ({ isDesktop: true }));
const group = vi.hoisted(() => ({
    /** Props of the last rendered Group. */
    defaultLayout: undefined as Record<string, number> | undefined,
    onLayoutChange: undefined as ((layout: Record<string, number>) => void) | undefined,
    /** How many times a Group was mounted (a remount rebuilds the panels). */
    mounts: 0,
}));
const leftPanel = vi.hoisted(() => ({ minSize: undefined as string | undefined, maxSize: undefined as string | undefined }));

vi.mock("@gouvfr-lasuite/ui-components", () => ({
    LeftPanel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    useResponsive: () => ({ isDesktop: responsive.isDesktop, isMobile: !responsive.isDesktop }),
}));
// jsdom's CSSStyleDeclaration cannot parse the inline styles the panel components set, so only
// those are stubbed; useDefaultLayout stays real.
vi.mock("react-resizable-panels", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-resizable-panels")>()),
    Group: ({ defaultLayout, onLayoutChange, children }: {
        defaultLayout?: Layout;
        onLayoutChange?: (layout: Layout) => void;
        children?: React.ReactNode;
    }) => {
        group.defaultLayout = defaultLayout;
        group.onLayoutChange = onLayoutChange;
        useEffect(() => {
            group.mounts += 1;
        }, []);
        return <div>{children}</div>;
    },
    Panel: ({ id, minSize, maxSize, children }: { id?: string; minSize?: string; maxSize?: string; children?: React.ReactNode }) => {
        if (id === "panel-main-left") {
            leftPanel.minSize = minSize;
            leftPanel.maxSize = maxSize;
        }
        return <div>{children}</div>;
    },
    Separator: () => <div />,
}));
vi.mock("../header", () => ({ Header: () => <div /> }));
vi.mock("@/features/native/use-ota-update-toast", () => ({ useOtaUpdateToast: () => undefined }));
vi.mock("@/features/ui/components/toaster", () => ({ Toaster: () => null }));
vi.mock("@/features/ui/components/skip-link", () => ({ SkipLink: () => null }));

// useDefaultLayout stores one layout per combination of panels.
const WITH_SIDEBAR_KEY = "react-resizable-panels:main:panel-main-left:panel-main-right";
const WITHOUT_SIDEBAR_KEY = "react-resizable-panels:main:panel-main-right";

let container: HTMLDivElement;
let root: Root;

const render = (props: { hideLeftPanelOnDesktop?: boolean } = {}) =>
    act(() => {
        root.render(
            <AppLayout enableResize leftPanelContent={<i />} {...props}>
                <i />
            </AppLayout>,
        );
    });

const store = (value: unknown, key = WITH_SIDEBAR_KEY) =>
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));

beforeEach(() => {
    localStorage.clear();
    window.innerWidth = 1440;
    responsive.isDesktop = true;
    group.defaultLayout = undefined;
    group.onLayoutChange = undefined;
    group.mounts = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    vi.useRealTimers();
    act(() => root.unmount());
    container.remove();
});

describe("AppLayout: restoring the stored layout", () => {
    it("restores a plausible stored layout", () => {
        store({ "panel-main-left": 20, "panel-main-right": 80 });
        render();
        expect(group.defaultLayout).toEqual({ "panel-main-left": 20, "panel-main-right": 80 });
    });

    it("keeps a narrow stored sidebar: the library clamps it to the minimum", () => {
        store({ "panel-main-left": 0, "panel-main-right": 100 });
        render();
        expect(group.defaultLayout).toEqual({ "panel-main-left": 0, "panel-main-right": 100 });
    });

    it.each([
        ["the layout seen in production (sizes under each other's id)", { "panel-main-right": 32, "panel-main-left": 68 }],
        ["the layout seen locally", { "panel-main-right": 0, "panel-main-left": 100 }],
        ["a plausible layout whose panels were reported in the wrong order", { "panel-main-right": 83, "panel-main-left": 17 }],
        ["a sidebar far above its maximum", { "panel-main-left": 70, "panel-main-right": 30 }],
        ["a layout stored for the panel set without a sidebar", { "panel-main-right": 100 }],
        ["sizes that do not add up", { "panel-main-left": 20, "panel-main-right": 30 }],
        ["a non-numeric size", { "panel-main-left": "x", "panel-main-right": null }],
        ["a negative size", { "panel-main-left": -10, "panel-main-right": 110 }],
    ])("drops %s", (_name, layout) => {
        store(layout);
        render();
        expect(group.defaultLayout).toBeUndefined();
    });

    it.each(["not json", "0", "null", "true", '"text"', "[20,80]"])(
        "does not crash on a stored value that is not a JSON object: %s",
        (value) => {
            store(value);
            expect(() => render()).not.toThrow();
            expect(group.defaultLayout).toBeUndefined();
        },
    );

    it("drops a visible sidebar on the mobile layout", () => {
        responsive.isDesktop = false;
        store({ "panel-main-left": 70, "panel-main-right": 30 });
        render();
        expect(group.defaultLayout).toBeUndefined();
    });

    it("restores the layout of the panel set without a sidebar", () => {
        store({ "panel-main-right": 100 }, WITHOUT_SIDEBAR_KEY);
        render({ hideLeftPanelOnDesktop: true });
        expect(group.defaultLayout).toEqual({ "panel-main-right": 100 });
    });
});

describe("AppLayout: saving the layout", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    const save = (layout: Layout) => {
        act(() => group.onLayoutChange!(layout));
        act(() => {
            vi.advanceTimersByTime(300);
        });
    };

    it("stores a layout whose panels are in order, and restores it on the next mount", () => {
        render();
        save({ "panel-main-left": 22, "panel-main-right": 78 });
        expect(JSON.parse(localStorage.getItem(WITH_SIDEBAR_KEY)!)).toEqual({ "panel-main-left": 22, "panel-main-right": 78 });

        act(() => root.unmount());
        root = createRoot(container);
        render();
        expect(group.defaultLayout).toEqual({ "panel-main-left": 22, "panel-main-right": 78 });
    });

    it("does not store a layout whose panels were reported in the wrong order, and rebuilds the group", () => {
        render();
        expect(group.mounts).toBe(1);

        save({ "panel-main-right": 32, "panel-main-left": 68 });

        expect(localStorage.length).toBe(0);
        expect(group.mounts).toBe(2);
    });

    it("keeps the layouts with and without a sidebar apart", () => {
        store({ "panel-main-left": 22, "panel-main-right": 78 });
        render({ hideLeftPanelOnDesktop: true });
        save({ "panel-main-right": 100 });

        render({ hideLeftPanelOnDesktop: false });

        expect(group.defaultLayout).toEqual({ "panel-main-left": 22, "panel-main-right": 78 });
        expect(JSON.parse(localStorage.getItem(WITHOUT_SIDEBAR_KEY)!)).toEqual({ "panel-main-right": 100 });
    });

    it("stops rebuilding the group when the order stays wrong", () => {
        render();
        for (let i = 0; i < 10; i++) save({ "panel-main-right": 32, "panel-main-left": 68 });

        expect(localStorage.length).toBe(0);
        // 1 initial mount plus a bounded number of rebuilds, not one per report.
        expect(group.mounts).toBeLessThanOrEqual(4);
    });

    it("allows rebuilding again after a correct layout was reported", () => {
        render();
        for (let i = 0; i < 3; i++) save({ "panel-main-right": 32, "panel-main-left": 68 });
        const mountsAfterFirstBurst = group.mounts;

        save({ "panel-main-left": 17, "panel-main-right": 83 });
        save({ "panel-main-right": 32, "panel-main-left": 68 });

        expect(group.mounts).toBe(mountsAfterFirstBurst + 1);
    });
});

describe("AppLayout: sidebar limits", () => {
    it("limits the sidebar to between 250px and 450px of the window", () => {
        window.innerWidth = 1440;
        render();
        expect(leftPanel.minSize).toBe(`${Math.round((250 / 1440) * 100)}%`);
        expect(leftPanel.maxSize).toBe(`${Math.round((450 / 1440) * 100)}%`);
    });

    it("hides the sidebar on the mobile layout", () => {
        responsive.isDesktop = false;
        render();
        expect(leftPanel.minSize).toBe("0");
        expect(leftPanel.maxSize).toBe("0%");
    });
});
