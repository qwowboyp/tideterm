// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from "@/app/element/tooltip";
import { useT } from "@/app/i18n/i18n";
import { ContextMenuModel } from "@/app/store/contextmenu";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import type { TermViewModel } from "@/app/view/term/term-model";
import { getLayoutModelForStaticTab } from "@/layout/index";
import { atoms, createBlock, getBlockComponentModel, getSettingsKeyAtom, globalStore, isDev } from "@/store/global";
import { fireAndForget, isBlank, makeIconClass } from "@/util/util";
import {
    FloatingPortal,
    autoUpdate,
    offset,
    shift,
    useDismiss,
    useFloating,
    useInteractions,
} from "@floating-ui/react";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useRef, useState } from "react";

function sortByDisplayOrder(wmap: { [key: string]: WidgetConfigType }): WidgetConfigType[] {
    if (wmap == null) {
        return [];
    }
    const wlist = Object.values(wmap);
    wlist.sort((a, b) => {
        return (a["display:order"] ?? 0) - (b["display:order"] ?? 0);
    });
    return wlist;
}

async function handleWidgetSelect(widget: WidgetConfigType) {
    const blockDef = widget.blockdef;
    createBlock(blockDef, widget.magnified);
}

const Widget = memo(({ widget, mode }: { widget: WidgetConfigType; mode: "normal" | "compact" | "supercompact" }) => {
    const [isTruncated, setIsTruncated] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (mode === "normal" && labelRef.current) {
            const element = labelRef.current;
            setIsTruncated(element.scrollWidth > element.clientWidth);
        }
    }, [mode, widget.label]);

    const shouldDisableTooltip = mode !== "normal" ? false : !isTruncated;

    return (
        <Tooltip
            content={widget.description || widget.label}
            placement="left"
            disable={shouldDisableTooltip}
            divClassName={clsx(
                "flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-secondary overflow-hidden rounded-sm hover:bg-hoverbg hover:text-white cursor-pointer",
                mode === "supercompact" ? "text-sm" : "text-lg",
                widget["display:hidden"] && "hidden"
            )}
            divOnClick={() => handleWidgetSelect(widget)}
        >
            <div style={{ color: widget.color }}>
                <i className={makeIconClass(widget.icon, true, { defaultIcon: "browser" })}></i>
            </div>
            {mode === "normal" && !isBlank(widget.label) ? (
                <div
                    ref={labelRef}
                    className="text-xxs mt-0.5 w-full px-0.5 text-center whitespace-nowrap overflow-hidden text-ellipsis"
                >
                    {widget.label}
                </div>
            ) : null}
        </Tooltip>
    );
});

function calculateGridSize(appCount: number): number {
    if (appCount <= 4) return 2;
    if (appCount <= 9) return 3;
    if (appCount <= 16) return 4;
    if (appCount <= 25) return 5;
    return 6;
}

const AppsFloatingWindow = memo(
    ({
        isOpen,
        onClose,
        referenceElement,
    }: {
        isOpen: boolean;
        onClose: () => void;
        referenceElement: HTMLElement;
    }) => {
        const [apps, setApps] = useState<AppInfo[]>([]);
        const [loading, setLoading] = useState(true);

        const { refs, floatingStyles, context } = useFloating({
            open: isOpen,
            onOpenChange: onClose,
            placement: "left-start",
            middleware: [offset(-2), shift({ padding: 12 })],
            whileElementsMounted: autoUpdate,
            elements: {
                reference: referenceElement,
            },
        });

        const dismiss = useDismiss(context);
        const { getFloatingProps } = useInteractions([dismiss]);

        useEffect(() => {
            if (!isOpen) return;

            const fetchApps = async () => {
                setLoading(true);
                try {
                    const allApps = await RpcApi.ListAllAppsCommand(TabRpcClient);
                    const localApps = allApps
                        .filter((app) => !app.appid.startsWith("draft/"))
                        .sort((a, b) => {
                            const aName = a.appid.replace(/^local\//, "");
                            const bName = b.appid.replace(/^local\//, "");
                            return aName.localeCompare(bName);
                        });
                    setApps(localApps);
                } catch (error) {
                    console.error("Failed to fetch apps:", error);
                    setApps([]);
                } finally {
                    setLoading(false);
                }
            };

            fetchApps();
        }, [isOpen]);

        if (!isOpen) return null;

        const gridSize = calculateGridSize(apps.length);

        return (
            <FloatingPortal>
                <div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    {...getFloatingProps()}
                    className="bg-modalbg border border-border rounded-lg shadow-xl p-4 z-50"
                >
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <i className="fa fa-solid fa-spinner fa-spin text-2xl text-muted"></i>
                        </div>
                    ) : apps.length === 0 ? (
                        <div className="text-muted text-sm p-4 text-center">No local apps found</div>
                    ) : (
                        <div
                            className="grid gap-3"
                            style={{
                                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                                maxWidth: `${gridSize * 80}px`,
                            }}
                        >
                            {apps.map((app) => {
                                const appMeta = app.manifest?.appmeta;
                                const displayName = app.appid.replace(/^local\//, "");
                                const icon = appMeta?.icon || "cube";
                                const iconColor = appMeta?.iconcolor || "white";

                                return (
                                    <div
                                        key={app.appid}
                                        className="flex flex-col items-center justify-center p-2 rounded hover:bg-hoverbg cursor-pointer transition-colors"
                                        onClick={() => {
                                            const blockDef: BlockDef = {
                                                meta: {
                                                    view: "tsunami",
                                                    controller: "tsunami",
                                                    "tsunami:appid": app.appid,
                                                },
                                            };
                                            createBlock(blockDef);
                                            onClose();
                                        }}
                                    >
                                        <div style={{ color: iconColor }} className="text-3xl mb-1">
                                            <i className={makeIconClass(icon, false)}></i>
                                        </div>
                                        <div className="text-xxs text-center text-secondary break-words w-full px-1">
                                            {displayName}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </FloatingPortal>
        );
    }
);

const SavedCommandsFloatingWindow = memo(
    ({
        isOpen,
        onClose,
        referenceElement,
    }: {
        isOpen: boolean;
        onClose: () => void;
        referenceElement: HTMLElement;
    }) => {
        const t = useT();
        const savedCommands = useAtomValue(getSettingsKeyAtom("term:savedcommands")) || [];
        const [editingId, setEditingId] = useState<string | null>(null);
        const [editTitle, setEditTitle] = useState("");
        const [editCommand, setEditCommand] = useState("");
        const [editAutoEnter, setEditAutoEnter] = useState(false);
        const [errorMessage, setErrorMessage] = useState<string | null>(null);

        const { refs, floatingStyles, context } = useFloating({
            open: isOpen,
            onOpenChange: onClose,
            placement: "left-start",
            middleware: [offset(-2), shift({ padding: 12 })],
            whileElementsMounted: autoUpdate,
            elements: {
                reference: referenceElement,
            },
        });

        const dismiss = useDismiss(context);
        const { getFloatingProps } = useInteractions([dismiss]);

        const layoutModel = getLayoutModelForStaticTab();
        const focusedNode = useAtomValue(layoutModel.focusedNode);
        const blockId = focusedNode?.data?.blockId;
        const bcm = blockId ? getBlockComponentModel(blockId) : null;
        const isTerminalFocused = bcm?.viewModel?.viewType === "term";

        if (!isOpen) return null;

        const refreshConfig = async () => {
            const refreshed = await RpcApi.GetFullConfigCommand(TabRpcClient);
            globalStore.set(atoms.fullConfigAtom, refreshed);
        };

        const handleSave = async () => {
            if (editCommand.trim() === "") {
                setErrorMessage(t("term.savedCommands.form.command"));
                return;
            }

            let newCommands = [...savedCommands];
            if (editingId === "new") {
                newCommands.push({
                    id: crypto.randomUUID(),
                    title: editTitle,
                    command: editCommand,
                    autoEnter: editAutoEnter,
                });
            } else {
                newCommands = newCommands.map((c) =>
                    c.id === editingId
                        ? {
                              ...c,
                              title: editTitle,
                              command: editCommand,
                              autoEnter: editAutoEnter,
                          }
                        : c
                );
            }
            try {
                setErrorMessage(null);
                await RpcApi.SetConfigCommand(TabRpcClient, { "term:savedcommands": newCommands });
                await refreshConfig();
                setEditingId(null);
            } catch (e: any) {
                setErrorMessage(e?.message ? String(e.message) : String(e));
            }
        };

        const handleDelete = async (id: string) => {
            try {
                setErrorMessage(null);
                const newCommands = savedCommands.filter((c) => c.id !== id);
                await RpcApi.SetConfigCommand(TabRpcClient, { "term:savedcommands": newCommands });
                await refreshConfig();
            } catch (e: any) {
                setErrorMessage(e?.message ? String(e.message) : String(e));
            }
        };

        const handleInject = (cmd: SavedCommand) => {
            if (!blockId) {
                return;
            }
            if (bcm?.viewModel?.viewType === "term") {
                const sourceTVM = bcm.viewModel as TermViewModel;
                const targetBlockId = sourceTVM.getResolvedActiveTermSessionId();
                const targetBCM = getBlockComponentModel(targetBlockId) ?? bcm;
                const tvm = targetBCM.viewModel as TermViewModel;
                const termWrap = tvm.termRef.current;
                tvm.giveFocus();
                if (cmd.autoEnter) {
                    tvm.sendDataToController(`${cmd.command}\r`);
                } else if (termWrap) {
                    termWrap.pasteText(cmd.command);
                }
            }
            onClose();
        };

        const handleCopy = async (cmd: SavedCommand) => {
            try {
                setErrorMessage(null);
                await navigator.clipboard.writeText(cmd.command);
            } catch (e: any) {
                setErrorMessage(e?.message ? String(e.message) : String(e));
            }
        };

        return (
            <FloatingPortal>
                <div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    {...getFloatingProps()}
                    className="bg-modalbg border border-border rounded-lg shadow-xl p-3 z-50 w-80 flex flex-col gap-2"
                >
                    <div className="text-sm font-semibold text-secondary mb-1">{t("term.savedCommands.title")}</div>

                    {errorMessage ? (
                        <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">
                            {errorMessage}
                        </div>
                    ) : null}

                    {!isTerminalFocused && (
                        <div className="text-xs text-orange-400 bg-orange-400/10 p-2 rounded border border-orange-400/20 mb-1">
                            <i className="fa fa-solid fa-triangle-exclamation mr-1"></i>
                            {t("term.savedCommands.noFocusedTerminal")}
                        </div>
                    )}

                    {savedCommands.length === 0 && editingId !== "new" && (
                        <div className="text-muted text-sm text-center py-4">
                            <div>{t("term.savedCommands.emptyTitle")}</div>
                            <div className="text-xs mt-1">{t("term.savedCommands.emptyHint")}</div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                        {savedCommands.map((cmd) => (
                            <div
                                key={cmd.id}
                                className="flex flex-col gap-1 p-2 rounded border border-border hover:border-accent transition-colors group"
                            >
                                {editingId === cmd.id ? (
                                    <div className="flex flex-col gap-2">
                                        <input
                                            className="bg-black border border-border rounded px-2 py-1 text-sm text-white"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            placeholder={t("term.savedCommands.form.name")}
                                        />
                                        <textarea
                                            className="bg-black border border-border rounded px-2 py-1 text-sm text-white resize-none h-16"
                                            value={editCommand}
                                            onChange={(e) => setEditCommand(e.target.value)}
                                            placeholder={t("term.savedCommands.form.command")}
                                        />
                                        <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={editAutoEnter}
                                                onChange={(e) => setEditAutoEnter(e.target.checked)}
                                            />
                                            {t("term.savedCommands.form.autoEnter")}
                                        </label>
                                        <div className="flex justify-end gap-2 mt-1">
                                            <button
                                                className="px-3 py-1 text-xs rounded bg-hoverbg text-secondary hover:text-white"
                                                onClick={() => setEditingId(null)}
                                            >
                                                {t("common.cancel")}
                                            </button>
                                            <button
                                                className="px-3 py-1 text-xs rounded bg-accent text-white"
                                                onClick={handleSave}
                                            >
                                                {t("common.save")}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="font-medium text-sm truncate text-white">
                                                {cmd.title || cmd.command}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    className={clsx(
                                                        "p-2 text-secondary rounded hover:bg-hoverbg transition-colors",
                                                        isTerminalFocused
                                                            ? "hover:text-white"
                                                            : "cursor-not-allowed opacity-50"
                                                    )}
                                                    onClick={() => isTerminalFocused && handleInject(cmd)}
                                                    title={
                                                        isTerminalFocused
                                                            ? t("term.savedCommands.injectTooltip")
                                                            : t("term.savedCommands.focusFirst")
                                                    }
                                                >
                                                    <i className="fa fa-solid fa-play text-sm"></i>
                                                </button>
                                                <button
                                                    className="p-2 text-secondary hover:text-white rounded hover:bg-hoverbg transition-colors"
                                                    onClick={() => handleCopy(cmd)}
                                                    title={t("term.savedCommands.copy")}
                                                >
                                                    <i className="fa fa-solid fa-copy text-sm"></i>
                                                </button>
                                                <button
                                                    className="p-2 text-secondary hover:text-white rounded hover:bg-hoverbg transition-colors"
                                                    onClick={() => {
                                                        setEditTitle(cmd.title);
                                                        setEditCommand(cmd.command);
                                                        setEditAutoEnter(cmd.autoEnter);
                                                        setEditingId(cmd.id);
                                                    }}
                                                    title={t("term.savedCommands.edit")}
                                                >
                                                    <i className="fa fa-solid fa-pen text-sm"></i>
                                                </button>
                                                <button
                                                    className="p-2 text-secondary hover:text-red-400 rounded hover:bg-hoverbg transition-colors"
                                                    onClick={() => handleDelete(cmd.id)}
                                                    title={t("term.savedCommands.delete")}
                                                >
                                                    <i className="fa fa-solid fa-trash text-sm"></i>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-secondary font-mono truncate opacity-70">
                                            {cmd.command}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}

                        {editingId === "new" && (
                            <div className="flex flex-col gap-2 p-2 rounded border border-accent">
                                <input
                                    className="bg-black border border-border rounded px-2 py-1 text-sm text-white"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder={t("term.savedCommands.form.name")}
                                    autoFocus
                                />
                                <textarea
                                    className="bg-black border border-border rounded px-2 py-1 text-sm text-white resize-none h-16"
                                    value={editCommand}
                                    onChange={(e) => setEditCommand(e.target.value)}
                                    placeholder={t("term.savedCommands.form.command")}
                                />
                                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editAutoEnter}
                                        onChange={(e) => setEditAutoEnter(e.target.checked)}
                                    />
                                    {t("term.savedCommands.form.autoEnter")}
                                </label>
                                <div className="flex justify-end gap-2 mt-1">
                                    <button
                                        className="px-3 py-1 text-xs rounded bg-hoverbg text-secondary hover:text-white"
                                        onClick={() => setEditingId(null)}
                                    >
                                        {t("common.cancel")}
                                    </button>
                                    <button
                                        className="px-3 py-1 text-xs rounded bg-accent text-white"
                                        onClick={handleSave}
                                    >
                                        {t("common.save")}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {editingId !== "new" && (
                        <button
                            className="mt-1 py-1.5 w-full rounded border border-dashed border-border text-secondary hover:text-white hover:border-secondary transition-colors text-sm flex items-center justify-center gap-2"
                            onClick={() => {
                                setEditTitle("");
                                setEditCommand("");
                                setEditAutoEnter(false);
                                setEditingId("new");
                            }}
                        >
                            <i className="fa fa-solid fa-plus"></i> {t("term.savedCommands.add")}
                        </button>
                    )}
                </div>
            </FloatingPortal>
        );
    }
);
SavedCommandsFloatingWindow.displayName = "SavedCommandsFloatingWindow";

const SettingsFloatingWindow = memo(
    ({
        isOpen,
        onClose,
        referenceElement,
    }: {
        isOpen: boolean;
        onClose: () => void;
        referenceElement: HTMLElement;
    }) => {
        const t = useT();
        const { refs, floatingStyles, context } = useFloating({
            open: isOpen,
            onOpenChange: onClose,
            placement: "left-start",
            middleware: [offset(-2), shift({ padding: 12 })],
            whileElementsMounted: autoUpdate,
            elements: {
                reference: referenceElement,
            },
        });

        const dismiss = useDismiss(context);
        const { getFloatingProps } = useInteractions([dismiss]);

        if (!isOpen) return null;

        const menuItems = [
            {
                icon: "gear",
                label: t("workspace.menu.settings"),
                onClick: () => {
                    const blockDef: BlockDef = {
                        meta: {
                            view: "waveconfig",
                        },
                    };
                    createBlock(blockDef, false, true);
                    onClose();
                },
            },
            {
                icon: "lightbulb",
                label: t("workspace.menu.tips"),
                onClick: () => {
                    const blockDef: BlockDef = {
                        meta: {
                            view: "tips",
                        },
                    };
                    createBlock(blockDef, true, true);
                    onClose();
                },
            },
            {
                icon: "lock",
                label: t("workspace.menu.secrets"),
                onClick: () => {
                    const blockDef: BlockDef = {
                        meta: {
                            view: "waveconfig",
                            file: "secrets",
                        },
                    };
                    createBlock(blockDef, false, true);
                    onClose();
                },
            },
            {
                icon: "circle-question",
                label: t("workspace.menu.help"),
                onClick: () => {
                    const blockDef: BlockDef = {
                        meta: {
                            view: "help",
                        },
                    };
                    createBlock(blockDef);
                    onClose();
                },
            },
        ];

        return (
            <FloatingPortal>
                <div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    {...getFloatingProps()}
                    className="bg-modalbg border border-border rounded-lg shadow-xl p-2 z-50"
                >
                    {menuItems.map((item, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-hoverbg cursor-pointer transition-colors text-secondary hover:text-white"
                            onClick={item.onClick}
                        >
                            <div className="text-lg w-5 flex justify-center">
                                <i className={makeIconClass(item.icon, false)}></i>
                            </div>
                            <div className="text-sm whitespace-nowrap">{item.label}</div>
                        </div>
                    ))}
                </div>
            </FloatingPortal>
        );
    }
);

SettingsFloatingWindow.displayName = "SettingsFloatingWindow";

const Widgets = memo(() => {
    const t = useT();
    const fullConfig = useAtomValue(atoms.fullConfigAtom);
    const hasCustomAIPresets = useAtomValue(atoms.hasCustomAIPresetsAtom);
    const [mode, setMode] = useState<"normal" | "compact" | "supercompact">("normal");
    const containerRef = useRef<HTMLDivElement>(null);
    const measurementRef = useRef<HTMLDivElement>(null);

    const featureWaveAppBuilder = fullConfig?.settings?.["feature:waveappbuilder"] ?? false;
    const widgetsMap = fullConfig?.widgets ?? {};
    const filteredWidgets = hasCustomAIPresets
        ? widgetsMap
        : Object.fromEntries(Object.entries(widgetsMap).filter(([key]) => key !== "defwidget@ai"));
    const widgets = sortByDisplayOrder(filteredWidgets);

    const [isAppsOpen, setIsAppsOpen] = useState(false);
    const appsButtonRef = useRef<HTMLDivElement>(null);
    const [isSavedCommandsOpen, setIsSavedCommandsOpen] = useState(false);
    const savedCommandsButtonRef = useRef<HTMLDivElement>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsButtonRef = useRef<HTMLDivElement>(null);

    const checkModeNeeded = useCallback(() => {
        if (!containerRef.current || !measurementRef.current) return;

        const containerHeight = containerRef.current.clientHeight;
        const normalHeight = measurementRef.current.scrollHeight;
        const gracePeriod = 10;

        let newMode: "normal" | "compact" | "supercompact" = "normal";

        if (normalHeight > containerHeight - gracePeriod) {
            newMode = "compact";

            // Calculate total widget count for supercompact check
            const totalWidgets = (widgets?.length || 0) + 1;
            const minHeightPerWidget = 32;
            const requiredHeight = totalWidgets * minHeightPerWidget;

            if (requiredHeight > containerHeight) {
                newMode = "supercompact";
            }
        }

        // Use functional update to avoid depending on mode
        setMode((prevMode) => (newMode !== prevMode ? newMode : prevMode));
    }, [widgets]);

    // Use ref to hold the latest checkModeNeeded without re-creating ResizeObserver
    const checkModeNeededRef = useRef(checkModeNeeded);
    checkModeNeededRef.current = checkModeNeeded;

    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            checkModeNeededRef.current();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    useEffect(() => {
        checkModeNeeded();
    }, [widgets]);

    const handleWidgetsBarContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const menu: ContextMenuItem[] = [
            {
                label: t("workspace.menu.editWidgetsJson"),
                click: () => {
                    fireAndForget(async () => {
                        const blockDef: BlockDef = {
                            meta: {
                                view: "waveconfig",
                                file: "widgets.json",
                            },
                        };
                        await createBlock(blockDef, false, true);
                    });
                },
            },
        ];
        ContextMenuModel.showContextMenu(menu, e);
    };

    return (
        <>
            <div
                ref={containerRef}
                className="flex flex-col w-12 overflow-hidden py-1 -ml-1 select-none"
                onContextMenu={handleWidgetsBarContextMenu}
            >
                {mode === "supercompact" ? (
                    <>
                        <div className="grid grid-cols-2 gap-0 w-full">
                            {widgets?.map((data, idx) => (
                                <Widget key={`widget-${idx}`} widget={data} mode={mode} />
                            ))}
                            <div
                                ref={savedCommandsButtonRef}
                                className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-secondary text-sm overflow-hidden rounded-sm hover:bg-hoverbg hover:text-white cursor-pointer"
                                onClick={() => setIsSavedCommandsOpen(!isSavedCommandsOpen)}
                            >
                                <Tooltip
                                    content={t("term.savedCommands.title")}
                                    placement="left"
                                    disable={isSavedCommandsOpen}
                                >
                                    <div>
                                        <i className={makeIconClass("bookmark", true)}></i>
                                    </div>
                                </Tooltip>
                            </div>
                        </div>
                        <div className="flex-grow" />
                        <div className="grid grid-cols-2 gap-0 w-full">
                            {isDev() || featureWaveAppBuilder ? (
                                <div
                                    ref={appsButtonRef}
                                    className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-secondary text-sm overflow-hidden rounded-sm hover:bg-hoverbg hover:text-white cursor-pointer"
                                    onClick={() => setIsAppsOpen(!isAppsOpen)}
                                >
                                    <Tooltip
                                        content={t("workspace.localWaveApps")}
                                        placement="left"
                                        disable={isAppsOpen}
                                    >
                                        <div>
                                            <i className={makeIconClass("cube", true)}></i>
                                        </div>
                                    </Tooltip>
                                </div>
                            ) : null}
                            <div
                                ref={settingsButtonRef}
                                className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-secondary text-sm overflow-hidden rounded-sm hover:bg-hoverbg hover:text-white cursor-pointer"
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            >
                                <Tooltip
                                    content={t("workspace.settingsAndHelp")}
                                    placement="left"
                                    disable={isSettingsOpen}
                                >
                                    <div>
                                        <i className={makeIconClass("gear", true)}></i>
                                    </div>
                                </Tooltip>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {widgets?.map((data, idx) => (
                            <Widget key={`widget-${idx}`} widget={data} mode={mode} />
                        ))}
                        <div
                            ref={savedCommandsButtonRef}
                            className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-secondary text-lg overflow-hidden rounded-sm hover:bg-hoverbg hover:text-white cursor-pointer"
                            onClick={() => setIsSavedCommandsOpen(!isSavedCommandsOpen)}
                        >
                            <Tooltip
                                content={t("term.savedCommands.title")}
                                placement="left"
                                disable={isSavedCommandsOpen}
                            >
                                <div className="flex flex-col items-center w-full">
                                    <div>
                                        <i className={makeIconClass("bookmark", true)}></i>
                                    </div>
                                    {mode === "normal" && (
                                        <div className="text-xxs mt-0.5 w-full px-0.5 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                                            {t("term.savedCommands.viewName")}
                                        </div>
                                    )}
                                </div>
                            </Tooltip>
                        </div>
                        <div className="flex-grow" />
                        {isDev() || featureWaveAppBuilder ? (
                            <div
                                ref={appsButtonRef}
                                className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-secondary text-lg overflow-hidden rounded-sm hover:bg-hoverbg hover:text-white cursor-pointer"
                                onClick={() => setIsAppsOpen(!isAppsOpen)}
                            >
                                <Tooltip content={t("workspace.localWaveApps")} placement="left" disable={isAppsOpen}>
                                    <div className="flex flex-col items-center w-full">
                                        <div>
                                            <i className={makeIconClass("cube", true)}></i>
                                        </div>
                                        {mode === "normal" && (
                                            <div className="text-xxs mt-0.5 w-full px-0.5 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                                                {t("workspace.appsLabel")}
                                            </div>
                                        )}
                                    </div>
                                </Tooltip>
                            </div>
                        ) : null}
                        <div
                            ref={settingsButtonRef}
                            className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-secondary text-lg overflow-hidden rounded-sm hover:bg-hoverbg hover:text-white cursor-pointer"
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        >
                            <Tooltip content={t("workspace.settingsAndHelp")} placement="left" disable={isSettingsOpen}>
                                <div>
                                    <i className={makeIconClass("gear", true)}></i>
                                </div>
                            </Tooltip>
                        </div>
                    </>
                )}
                {isDev() ? (
                    <div
                        className="flex justify-center items-center w-full py-1 text-accent text-[30px]"
                        title="Running TideTerm Dev Build"
                    >
                        <i className="fa fa-brands fa-dev fa-fw" />
                    </div>
                ) : null}
            </div>
            {(isDev() || featureWaveAppBuilder) && appsButtonRef.current && (
                <AppsFloatingWindow
                    isOpen={isAppsOpen}
                    onClose={() => setIsAppsOpen(false)}
                    referenceElement={appsButtonRef.current}
                />
            )}
            {savedCommandsButtonRef.current && (
                <SavedCommandsFloatingWindow
                    isOpen={isSavedCommandsOpen}
                    onClose={() => setIsSavedCommandsOpen(false)}
                    referenceElement={savedCommandsButtonRef.current}
                />
            )}
            {settingsButtonRef.current && (
                <SettingsFloatingWindow
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    referenceElement={settingsButtonRef.current}
                />
            )}

            <div
                ref={measurementRef}
                className="flex flex-col w-12 py-1 -ml-1 select-none absolute -z-10 opacity-0 pointer-events-none"
            >
                {widgets?.map((data, idx) => (
                    <Widget key={`measurement-widget-${idx}`} widget={data} mode="normal" />
                ))}
                <div className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-lg">
                    <div>
                        <i className={makeIconClass("bookmark", true)}></i>
                    </div>
                    <div className="text-xxs mt-0.5 w-full px-0.5 text-center">{t("term.savedCommands.viewName")}</div>
                </div>
                <div className="flex-grow" />
                <div className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-lg">
                    <div>
                        <i className={makeIconClass("gear", true)}></i>
                    </div>
                    <div className="text-xxs mt-0.5 w-full px-0.5 text-center">{t("workspace.settingsLabel")}</div>
                </div>
                {isDev() ? (
                    <div className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-lg">
                        <div>
                            <i className={makeIconClass("cube", true)}></i>
                        </div>
                        <div className="text-xxs mt-0.5 w-full px-0.5 text-center">{t("workspace.appsLabel")}</div>
                    </div>
                ) : null}
                {isDev() ? (
                    <div
                        className="flex justify-center items-center w-full py-1 text-accent text-[30px]"
                        title="Running TideTerm Dev Build"
                    >
                        <i className="fa fa-brands fa-dev fa-fw" />
                    </div>
                ) : null}
            </div>
        </>
    );
});

export { Widgets };
