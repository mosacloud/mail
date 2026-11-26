import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { Header } from "../header";
import {
  Panel,
  Group,
  Separator,
  useDefaultLayout,
  type Layout,
} from "react-resizable-panels";
import { DropdownMenuOption, LeftPanel, useResponsive } from "@gouvfr-lasuite/ui-components";
import { useControllableState } from "../hooks/useControllableState";
import { useOtaUpdateToast } from "@/features/native/use-ota-update-toast";
import { Toaster } from "@/features/ui/components/toaster";
import { SkipLink } from "@/features/ui/components/skip-link";
import clsx from "clsx";
export type MainLayoutProps = {
  icon?: React.ReactNode;
  leftPanelContent?: React.ReactNode;
  rightHeaderContent?: React.ReactNode;
  languages?: DropdownMenuOption[];
  onToggleRightPanel?: () => void;
  enableResize?: boolean;
  rightPanelIsOpen?: boolean;
  hideLeftPanelOnDesktop?: boolean;
  isLeftPanelOpen?: boolean;
  setIsLeftPanelOpen?: (isLeftPanelOpen: boolean) => void;
  hideSearch?: boolean;
  isDragging?: boolean;
};

/**
 * This component is a copy of the MainLayout component from our ui-kit.
 *
 * @TODO: Remove this and update the ui-kit to be able to render panels without header or
 * add props to fully override the header.
 */
export const AppLayout = ({
  icon,
  children,
  hideLeftPanelOnDesktop = false,
  leftPanelContent,
  enableResize = false,
  hideSearch = false,
  isDragging = false,
  ...props
}: PropsWithChildren<MainLayoutProps>) => {
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useControllableState(
    false,
    props.isLeftPanelOpen,
    props.setIsLeftPanelOpen
  );
  const { isDesktop } = useResponsive();
  // This layout mounts the <Toaster/> the staged-update toast needs.
  useOtaUpdateToast();
  const [isResizing, setIsResizing] = useState(false);
  const resizeTimeoutRef = useRef<number>(undefined);
  // Track if panel was open before drag started, to restore state after drag ends
  const panelOpenBeforeDragRef = useRef<boolean>(false);

  // We need to have two different states for the left panel, we want to always keep the
  // left panel mounted on mobile in order to show the animation when it opens or closes, instead
  // of abruptly disappearing when closing the panel.
  // On desktop, we want to hide the left panel when the prop is set to true, so we need to
  // completely unmount it as it will never be visible.
  const mountLeftPanel = isDesktop ? !hideLeftPanelOnDesktop : true;
  const showLeftPanel = isDesktop ? !hideLeftPanelOnDesktop : isLeftPanelOpen;

  const panelIds = mountLeftPanel ? PANEL_IDS_WITH_LEFT : PANEL_IDS_RIGHT_ONLY;
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    groupId: "main",
    panelIds,
    storage: layoutStorage,
  });
  const [resetCount, setResetCount] = useState(0);
  const resetAttempts = useRef(0);
  const storedLayout = isLayoutPlausible(defaultLayout, panelIds) ? defaultLayout : undefined;

  const handleLayoutChange = (layout: Layout) => {
    if (!hasPanelOrder(layout, panelIds)) {
      // DevTools' 1x1px viewport makes the panels register in the wrong order: rebuild the group
      if (resetAttempts.current < MAX_GROUP_RESETS) {
        resetAttempts.current += 1;
        setResetCount((count) => count + 1);
      }
      return;
    }
    resetAttempts.current = 0;
    onLayoutChange(layout);
  };

  const [minPanelSize, setMinPanelSize] = useState(
    calculateDefaultSize(200, isDesktop)
  );
  const [maxPanelSize, setMaxPanelSize] = useState(
    calculateDefaultSize(450, isDesktop)
  );

  const onTogglePanel = () => {
    setIsLeftPanelOpen(!isLeftPanelOpen);
  };

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    const updatePanelSize = () => {
      const min = Math.round(calculateDefaultSize(250, isDesktop));
      const max = Math.round(
        Math.min(calculateDefaultSize(450, isDesktop), MAX_LEFT_PERCENT)
      );

      setMinPanelSize(isDesktop ? min : 0);
      if (enableResize) {
        setMaxPanelSize(max);
      } else {
        setMaxPanelSize(min);
      }
    };

    updatePanelSize();
    window.addEventListener("resize", updatePanelSize);

    return () => {
      window.removeEventListener("resize", updatePanelSize);
    };
  }, [isDesktop, enableResize]);

  // Disable transitions during window resize to prevent panels from being visible
  useEffect(() => {
    const handleResizeStart = () => {
      setIsResizing(true);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        setIsResizing(false);
      }, 150);
    };

    window.addEventListener("resize", handleResizeStart);

    return () => {
      window.removeEventListener("resize", handleResizeStart);

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  // On mobile/tablet, auto-open left panel when dragging starts to reveal drop targets
  useEffect(() => {
    if (isDesktop) return;

    if (isDragging) {
      // Store current panel state before opening
      panelOpenBeforeDragRef.current = isLeftPanelOpen;
      setIsLeftPanelOpen(true);
    } else if (panelOpenBeforeDragRef.current === false) {
      // Only close if it wasn't open before dragging started
      setIsLeftPanelOpen(false);
    }
  }, [isDragging, isDesktop]);

  return (
    <div className={clsx("c__main-layout", isResizing && "c__main-layout--resizing")}>
      <SkipLink onClick={() => {
        if (!isDesktop) {
          setIsLeftPanelOpen(false);
        }
      }} />
      <div className="c__main-layout__header">
        <Header
          onTogglePanel={onTogglePanel}
          isPanelOpen={isLeftPanelOpen}
          leftIcon={icon}
          hideSearch={hideSearch}
        />
      </div>
      <main className="c__main-layout__content">
        <Group key={`${mountLeftPanel ? "left" : "no-left"}-${resetCount}`} defaultLayout={storedLayout} onLayoutChange={handleLayoutChange} orientation="horizontal" style={{ width: "100%" }}>
          {mountLeftPanel && (
            <>
              <Panel
                id="panel-main-left"
                defaultSize={isDesktop ? `${minPanelSize}%` : "0"}
                minSize={isDesktop ? `${minPanelSize}%` : "0"}
                maxSize={`${maxPanelSize}%`}
              >
                <LeftPanel isOpen={showLeftPanel}>{leftPanelContent}</LeftPanel>
              </Panel>
              {isDesktop && (
                <Separator className="panel__resize-handle" />
              )}
            </>
          )}
          <Panel id="panel-main-right">
            {children}
          </Panel>
        </Group>
      </main>
      <Toaster />
    </div>
  );
};

// useDefaultLayout JSON.parses stored values: invalid JSON would crash the app on every load
const layoutStorage = {
  getItem: (key: string) => {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) JSON.parse(value);
      return value;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};

const PANEL_IDS_WITH_LEFT = ["panel-main-left", "panel-main-right"];
const PANEL_IDS_RIGHT_ONLY = ["panel-main-right"];
const MAX_GROUP_RESETS = 3;
const MAX_LEFT_PERCENT = 40;

// The library reports a layout in the order the panels registered in.
const hasPanelOrder = (layout: Layout, panelIds: string[]) =>
  Object.keys(layout).join() === panelIds.join();

// A stored layout with a sidebar above its maximum is dropped, so the panels start from their defaults. Other out-of-range sizes are fine: the library clamps them.
const isLayoutPlausible = (layout: Layout | undefined, panelIds: string[]) => {
  if (layout === undefined) return true;
  if (typeof layout !== "object" || layout === null) return false;
  if (!hasPanelOrder(layout, panelIds)) return false;
  const values = Object.values(layout);
  if (!values.every((value) => Number.isFinite(value) && value >= 0)) return false;
  const total = values.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 100) > 1) return false;
  const left = layout["panel-main-left"];
  // 1 point of slack for rounding
  return left === undefined || left <= MAX_LEFT_PERCENT + 1;
};

const calculateDefaultSize = (targetWidth: number, isDesktop: boolean) => {
  if (!isDesktop) {
    return 0;
  }

  const windowWidth = window.innerWidth;

  return (targetWidth / windowWidth) * 100;
};
