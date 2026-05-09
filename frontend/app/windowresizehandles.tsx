import React, { useCallback, useRef, useEffect } from "react";
import { useAtomValue } from "jotai";
import { atoms } from "./store/global";

const WindowResizeHandles = () => {
    const isWin32 = globalThis.api?.getPlatform?.() === "win32";
    const settings = useAtomValue(atoms.settingsAtom);
    const isTransparent = settings?.["window:transparent"] === true;

    const dragStateRef = useRef<{
        startX: number;
        startY: number;
        initialBounds: { x: number; y: number; width: number; height: number };
        handle: string;
    } | null>(null);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const state = dragStateRef.current;
        if (!state) return;

        const deltaX = e.screenX - state.startX;
        const deltaY = e.screenY - state.startY;

        let { x, y, width, height } = state.initialBounds;

        if (state.handle.includes('n')) {
            y += deltaY;
            height -= deltaY;
        }
        if (state.handle.includes('s')) {
            height += deltaY;
        }
        if (state.handle.includes('e')) {
            width += deltaX;
        }
        if (state.handle.includes('w')) {
            x += deltaX;
            width -= deltaX;
        }

        // Enforce minimum size
        const minWidth = 800;
        const minHeight = 500;

        if (width < minWidth) {
            if (state.handle.includes('w')) {
                x -= (minWidth - width);
            }
            width = minWidth;
        }

        if (height < minHeight) {
            if (state.handle.includes('n')) {
                y -= (minHeight - height);
            }
            height = minHeight;
        }

        if (globalThis.api?.resizeTransparentWindow) {
            globalThis.api.resizeTransparentWindow({ x, y, width, height });
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        dragStateRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
    }, [handleMouseMove]);

    const handleMouseDown = useCallback(
        async (e: React.MouseEvent, handle: string) => {
            if (!globalThis.api?.getTransparentWindowBounds) return;

            const initialBounds = await globalThis.api.getTransparentWindowBounds();
            if (!initialBounds) return;

            dragStateRef.current = {
                startX: e.screenX,
                startY: e.screenY,
                initialBounds,
                handle,
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        },
        [handleMouseMove, handleMouseUp]
    );

    // Clean up on unmount
    useEffect(() => {
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    if (!isWin32 || !isTransparent) return null;

    return (
        <>
            <div style={{ position: 'fixed', top: 0, left: 12, right: 12, height: 6, cursor: 'n-resize', zIndex: 99999 }} onMouseDown={(e) => handleMouseDown(e, 'n')} />
            <div style={{ position: 'fixed', top: 12, right: 0, bottom: 12, width: 6, cursor: 'e-resize', zIndex: 99999 }} onMouseDown={(e) => handleMouseDown(e, 'e')} />
            <div style={{ position: 'fixed', bottom: 0, left: 12, right: 12, height: 6, cursor: 's-resize', zIndex: 99999 }} onMouseDown={(e) => handleMouseDown(e, 's')} />
            <div style={{ position: 'fixed', top: 12, left: 0, bottom: 12, width: 6, cursor: 'w-resize', zIndex: 99999 }} onMouseDown={(e) => handleMouseDown(e, 'w')} />
            <div style={{ position: 'fixed', top: 0, left: 0, width: 12, height: 12, cursor: 'nw-resize', zIndex: 99999 }} onMouseDown={(e) => handleMouseDown(e, 'nw')} />
            <div style={{ position: 'fixed', top: 0, right: 0, width: 12, height: 12, cursor: 'ne-resize', zIndex: 99999 }} onMouseDown={(e) => handleMouseDown(e, 'ne')} />
            <div style={{ position: 'fixed', bottom: 0, right: 0, width: 12, height: 12, cursor: 'se-resize', zIndex: 99999 }} onMouseDown={(e) => handleMouseDown(e, 'se')} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, width: 12, height: 12, cursor: 'sw-resize', zIndex: 99999 }} onMouseDown={(e) => handleMouseDown(e, 'sw')} />
        </>
    );
};

export { WindowResizeHandles };
