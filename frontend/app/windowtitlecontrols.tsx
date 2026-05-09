import { useAtomValue } from "jotai";
import { useEffect, useState, useCallback } from "react";
import { atoms } from "./store/global";

const MinimizeIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10">
        <rect x="1" y="4" width="8" height="1" fill="currentColor" />
    </svg>
);

const MaximizeIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10">
        <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
);

const RestoreIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10">
        <rect x="2" y="0.5" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="none" />
        <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="#1c1c1c" />
    </svg>
);

const CloseIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10">
        <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1" />
        <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1" />
    </svg>
);

const BTN_W = 46;
const BTN_H = 32;
const noDragStyle = { WebkitAppRegion: "no-drag" };

export const WindowTitleControls = () => {
    const platform = globalThis.api?.getPlatform?.();
    const settings = useAtomValue(atoms.settingsAtom);
    const isTransparent = settings?.["window:transparent"] === true;

    const [isMaximized, setIsMaximized] = useState(false);
    const [hoverMin, setHoverMin] = useState(false);
    const [hoverMax, setHoverMax] = useState(false);
    const [hoverClose, setHoverClose] = useState(false);

    const checkMaximized = useCallback(() => {
        if (globalThis.api?.isMaximized) {
            setIsMaximized(globalThis.api.isMaximized());
        }
    }, []);

    useEffect(() => {
        if (platform !== "win32" || !isTransparent) return;
        checkMaximized();
        window.addEventListener("resize", checkMaximized);
        return () => window.removeEventListener("resize", checkMaximized);
    }, [platform, isTransparent, checkMaximized]);

    if (platform !== "win32" || !isTransparent) return null;

    const handleMinimize = () => {
        globalThis.api?.minimizeWindow?.();
    };
    const handleMaximize = () => {
        globalThis.api?.maximizeWindow?.();
        setIsMaximized(!isMaximized);
        window.setTimeout(checkMaximized, 0);
    };
    const handleClose = () => {
        globalThis.api?.closeWindow?.();
    };

    return (
        <>
            <button
                type="button"
                onClick={handleClose}
                title="Close"
                onMouseEnter={() => setHoverClose(true)}
                onMouseLeave={() => setHoverClose(false)}
                style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    width: BTN_W,
                    height: BTN_H,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    color: "#ffffff",
                    background: hoverClose ? "#c42b1c" : "transparent",
                    zIndex: 100000,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    ...noDragStyle,
                }}
            >
                <CloseIcon />
            </button>

            <button
                type="button"
                onClick={handleMaximize}
                title={isMaximized ? "Restore" : "Maximize"}
                onMouseEnter={() => setHoverMax(true)}
                onMouseLeave={() => setHoverMax(false)}
                style={{
                    position: "fixed",
                    top: 0,
                    right: BTN_W,
                    width: BTN_W,
                    height: BTN_H,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    color: "#ffffff",
                    background: hoverMax ? "rgba(255,255,255,0.1)" : "transparent",
                    zIndex: 100000,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    ...noDragStyle,
                }}
            >
                {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
            </button>

            <button
                type="button"
                onClick={handleMinimize}
                title="Minimize"
                onMouseEnter={() => setHoverMin(true)}
                onMouseLeave={() => setHoverMin(false)}
                style={{
                    position: "fixed",
                    top: 0,
                    right: BTN_W * 2,
                    width: BTN_W,
                    height: BTN_H,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    color: "#ffffff",
                    background: hoverMin ? "rgba(255,255,255,0.1)" : "transparent",
                    zIndex: 100000,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    ...noDragStyle,
                }}
            >
                <MinimizeIcon />
            </button>
        </>
    );
};
