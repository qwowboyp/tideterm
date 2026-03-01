// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Block } from "@/app/block/block";
import { Button } from "@/app/element/button";
import { useT } from "@/app/i18n/i18n";
import { Modal } from "@/app/modals/modal";
import { modalsModel } from "@/app/store/modalmodel";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { WOS, openLink } from "@/store/global";
import clsx from "clsx";
import * as React from "react";

import "./portforwards.scss";

type PortForwardsModalProps = {
    blockId: string;
};

function isLocalConnectionName(connection: string | null | undefined): boolean {
    if (connection == null || connection === "") {
        return true;
    }
    if (connection === "local") {
        return true;
    }
    return connection.startsWith("local:");
}

function parsePort(input: string): number | null {
    const trimmed = input.trim();
    if (trimmed === "") {
        return null;
    }
    const val = Number(trimmed);
    if (!Number.isInteger(val)) {
        return null;
    }
    if (val < 1 || val > 65535) {
        return null;
    }
    return val;
}

function makeLocalHttpUrl(item: PortForwardInfo): string {
    const host = item.localhost.includes(":") && !item.localhost.startsWith("[") ? `[${item.localhost}]` : item.localhost;
    return `http://${host}:${item.localport}`;
}

const PortForwardsModal = ({ blockId }: PortForwardsModalProps) => {
    const t = useT();
    const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", blockId));
    const connName = (blockData?.meta?.connection as string) ?? "local";

    const [forwards, setForwards] = React.useState<PortForwardInfo[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [creating, setCreating] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);

    const [localPortInput, setLocalPortInput] = React.useState("");
    const [remoteHostInput, setRemoteHostInput] = React.useState("127.0.0.1");
    const [remotePortInput, setRemotePortInput] = React.useState("");
    const [autoRestore, setAutoRestore] = React.useState(true);

    const refreshForwards = React.useCallback(async () => {
        if (isLocalConnectionName(connName)) {
            setError(t("term.portForwards.errors.localUnsupported"));
            setForwards([]);
            return;
        }
        if (connName.startsWith("wsl://")) {
            setError(t("term.portForwards.errors.wslUnsupported"));
            setForwards([]);
            return;
        }
        if (connName.startsWith("aws:")) {
            setError(t("term.portForwards.errors.awsUnsupported"));
            setForwards([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const resp = await RpcApi.ConnPortForwardListCommand(TabRpcClient, {
                connname: connName,
                logblockid: blockId,
            });
            setForwards(resp ?? []);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setForwards([]);
        } finally {
            setLoading(false);
        }
    }, [blockId, connName, t]);

    React.useEffect(() => {
        void refreshForwards();
    }, [refreshForwards]);

    const sortedForwards = React.useMemo(() => {
        return [...forwards].sort((a, b) => {
            if (a.createdat === b.createdat) {
                return a.id.localeCompare(b.id);
            }
            return a.createdat - b.createdat;
        });
    }, [forwards]);

    const createDisabled = creating || loading || deletingId !== null;

    const handleCreate = React.useCallback(async () => {
        const localPort = parsePort(localPortInput);
        const remotePort = parsePort(remotePortInput);
        if (localPort == null || remotePort == null) {
            setError(t("term.portForwards.errors.invalidPort"));
            return;
        }
        const remoteHost = remoteHostInput.trim() === "" ? "127.0.0.1" : remoteHostInput.trim();
        setCreating(true);
        setError(null);
        try {
            await RpcApi.ConnPortForwardCreateCommand(TabRpcClient, {
                connname: connName,
                localport: localPort,
                remotehost: remoteHost,
                remoteport: remotePort,
                autorestore: autoRestore,
                logblockid: blockId,
            });
            setLocalPortInput("");
            setRemotePortInput("");
            await refreshForwards();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
        } finally {
            setCreating(false);
        }
    }, [autoRestore, blockId, connName, localPortInput, refreshForwards, remoteHostInput, remotePortInput, t]);

    const handleDelete = React.useCallback(
        async (item: PortForwardInfo) => {
            const ok = window.confirm(t("term.portForwards.confirm.delete", { local: item.localaddress, remote: item.remoteaddress }));
            if (!ok) {
                return;
            }
            setDeletingId(item.id);
            setError(null);
            try {
                await RpcApi.ConnPortForwardDeleteCommand(TabRpcClient, {
                    connname: connName,
                    forwardid: item.id,
                    logblockid: blockId,
                });
                await refreshForwards();
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                setError(message);
            } finally {
                setDeletingId(null);
            }
        },
        [blockId, connName, refreshForwards, t]
    );

    const handleOpenBrowser = React.useCallback((item: PortForwardInfo) => {
        const url = makeLocalHttpUrl(item);
        void openLink(url);
    }, []);

    const statusLabel = React.useCallback(
        (status: string): string => {
            switch (status) {
                case "running":
                    return t("term.portForwards.status.running");
                case "stopped":
                    return t("term.portForwards.status.stopped");
                case "error":
                    return t("term.portForwards.status.error");
                default:
                    return status || t("term.portForwards.status.unknown");
            }
        },
        [t]
    );

    const renderBody = () => {
        if (loading) {
            return <div className="port-forwards-empty">{t("term.portForwards.loading")}</div>;
        }
        if (error) {
            return <div className="port-forwards-empty error">{error}</div>;
        }
        if (sortedForwards.length === 0) {
            return <div className="port-forwards-empty">{t("term.portForwards.empty")}</div>;
        }
        const actionsDisabled = creating || loading || deletingId !== null;
        return (
            <div className="port-forwards-list">
                <div className="port-forward-row header">
                    <div>{t("term.portForwards.columns.local")}</div>
                    <div>{t("term.portForwards.columns.remote")}</div>
                    <div>{t("term.portForwards.columns.restore")}</div>
                    <div>{t("term.portForwards.columns.status")}</div>
                    <div className="port-forward-actions-header">{t("term.portForwards.columns.actions")}</div>
                </div>
                {sortedForwards.map((item) => {
                    const restoreText = item.autorestore ? t("term.portForwards.enabled") : t("term.portForwards.disabled");
                    return (
                        <div key={item.id} className="port-forward-row">
                            <div className="ellipsis" title={item.localaddress}>
                                {item.localaddress}
                            </div>
                            <div className="ellipsis" title={item.remoteaddress}>
                                {item.remoteaddress}
                            </div>
                            <div>{restoreText}</div>
                            <div
                                className={clsx("port-forward-status", item.status)}
                                title={item.lasterror && item.lasterror.trim() !== "" ? item.lasterror : undefined}
                            >
                                {statusLabel(item.status)}
                            </div>
                            <div className="port-forward-actions">
                                <Button className="grey ghost" onClick={() => handleOpenBrowser(item)} disabled={actionsDisabled}>
                                    <i className="fa-solid fa-globe" />
                                    <span>{t("term.portForwards.openBrowser")}</span>
                                </Button>
                                <Button
                                    className="red ghost"
                                    onClick={() => void handleDelete(item)}
                                    disabled={actionsDisabled || deletingId === item.id}
                                >
                                    {t("term.portForwards.delete")}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <Modal className="port-forwards-modal" onClose={() => modalsModel.popModal()} onClickBackdrop={() => modalsModel.popModal()}>
            <div className="port-forwards-header">
                <div className="port-forwards-title">{t("term.portForwards.title")}</div>
                <div className="port-forwards-header-actions">
                    <Button className="grey ghost" onClick={refreshForwards} disabled={loading || creating || deletingId !== null}>
                        <i className="fa-solid fa-rotate-right" />
                        <span>{t("term.portForwards.refresh")}</span>
                    </Button>
                </div>
            </div>
            <div className="port-forwards-subtitle">{connName}</div>
            <div className="port-forwards-form">
                <label>
                    <span>{t("term.portForwards.localPort")}</span>
                    <input
                        type="number"
                        min={1}
                        max={65535}
                        value={localPortInput}
                        onChange={(e) => setLocalPortInput(e.target.value)}
                        placeholder="8080"
                        disabled={createDisabled}
                    />
                </label>
                <label>
                    <span>{t("term.portForwards.remoteHost")}</span>
                    <input
                        type="text"
                        value={remoteHostInput}
                        onChange={(e) => setRemoteHostInput(e.target.value)}
                        placeholder="127.0.0.1"
                        disabled={createDisabled}
                    />
                </label>
                <label>
                    <span>{t("term.portForwards.remotePort")}</span>
                    <input
                        type="number"
                        min={1}
                        max={65535}
                        value={remotePortInput}
                        onChange={(e) => {
                            const next = e.target.value;
                            setRemotePortInput(next);
                            if (localPortInput.trim() === "") {
                                setLocalPortInput(next);
                            }
                        }}
                        placeholder="8080"
                        disabled={createDisabled}
                    />
                </label>
                <label className="checkbox">
                    <input type="checkbox" checked={autoRestore} onChange={(e) => setAutoRestore(e.target.checked)} disabled={createDisabled} />
                    <span>{t("term.portForwards.autoRestore")}</span>
                </label>
                <Button className="green ghost" onClick={() => void handleCreate()} disabled={createDisabled}>
                    <i className="fa-solid fa-plus" />
                    <span>{t("term.portForwards.create")}</span>
                </Button>
            </div>
            {renderBody()}
        </Modal>
    );
};

PortForwardsModal.displayName = "PortForwardsModal";

export { PortForwardsModal };
