import { atoms } from "@/store/global";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

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

const btnBase = {
    position: "fixed" as const,
    top: 0,
    width: BTN_W,
    height: 32,
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    cursor: "pointer",
    border: "none",
    padding: 0,
    margin: 0,
    color: "#c3c8c2",
    background: "transparent",
    zIndex: 100000,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box" as const,
};

export function WindowTitleControls() {
    const settings = useAtomValue(atoms.settingsAtom);
    const isTransparent = settings?.["window:transparent"] === true;
    const [isMaximized, setIsMaximized] = useState(false);
    const [hoverMin, setHoverMin] = useState(false);
    const [hoverMax, setHoverMax] = useState(false);
    const [hoverClose, setHoverClose] = useState(false);

    useEffect(() => {
        if (globalThis.api?.getPlatform?.() !== "win32" || !isTransparent) return;
        const check = () => {
            if (globalThis.api?.isMaximized) {
                globalThis.api.isMaximized().then(setIsMaximized);
            }
        };
        check();
        const id = setInterval(check, 500);
        return () => clearInterval(id);
    }, [isTransparent]);

    if (globalThis.api?.getPlatform?.() !== "win32" || !isTransparent) return null;

    const handleMinimize = () => globalThis.api?.minimizeWindow?.();
    const handleMaximize = () => {
        globalThis.api?.maximizeWindow?.();
        setTimeout(() => {
            if (globalThis.api?.isMaximized) {
                globalThis.api.isMaximized().then(setIsMaximized);
            }
        }, 50);
    };
    const handleClose = () => globalThis.api?.closeWindow?.();

    return (
        <>
            <button type="button" onClick={handleClose} title="Close"
                onMouseEnter={() => setHoverClose(true)}
                onMouseLeave={() => setHoverClose(false)}
                style={{ ...btnBase, right: 0, background: hoverClose ? "#c42b1c" : "transparent" }}>
                <CloseIcon />
            </button>
            <button type="button" onClick={handleMaximize}
                title={isMaximized ? "Restore" : "Maximize"}
                onMouseEnter={() => setHoverMax(true)}
                onMouseLeave={() => setHoverMax(false)}
                style={{ ...btnBase, right: BTN_W, background: hoverMax ? "rgba(255,255,255,0.1)" : "transparent" }}>
                {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
            </button>
            <button type="button" onClick={handleMinimize} title="Minimize"
                onMouseEnter={() => setHoverMin(true)}
                onMouseLeave={() => setHoverMin(false)}
                style={{ ...btnBase, right: BTN_W * 2, background: hoverMin ? "rgba(255,255,255,0.1)" : "transparent" }}>
                <MinimizeIcon />
            </button>
        </>
    );
}
