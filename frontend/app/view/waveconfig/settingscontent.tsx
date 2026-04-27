// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { useAppLanguage, useT, type AppLanguage } from "@/app/i18n/i18n";
import { atoms, globalStore } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import type { WaveConfigViewModel } from "@/app/view/waveconfig/waveconfig-model";
import * as jotai from "jotai";
import { useEffect, useState, type ChangeEvent } from "react";

export function SettingsContent({ model }: { model: WaveConfigViewModel }) {
    const t = useT();
    const lang = useAppLanguage();
    const fullConfig = jotai.useAtomValue(atoms.fullConfigAtom);
    const settings = fullConfig?.settings;
    const [isUpdating, setIsUpdating] = useState(false);
    const [isFontSizeUpdating, setIsFontSizeUpdating] = useState(false);

    const remoteTmuxResumeEnabled = settings?.["term:remotetmuxresume"] ?? true;
    const ctrlmSubmitEnabled = settings?.["term:ctrlmsubmit"] ?? false;
    const configuredFontSize = typeof settings?.["term:fontsize"] === "number" ? settings["term:fontsize"] : 12;
    const [fontSize, setFontSize] = useState(String(configuredFontSize));

    useEffect(() => {
        setFontSize(String(configuredFontSize));
    }, [configuredFontSize]);

    const refreshConfigAndReloadSelectedFile = async () => {
        const refreshed = await RpcApi.GetFullConfigCommand(TabRpcClient);
        globalStore.set(atoms.fullConfigAtom, refreshed);
        const selectedFile = globalStore.get(model.selectedFileAtom);
        if (selectedFile) {
            await model.loadFile(selectedFile);
        }
    };

    const setLanguage = async (newLang: AppLanguage) => {
        if (newLang === lang || isUpdating) return;
        setIsUpdating(true);
        globalStore.set(model.errorMessageAtom, null);

        try {
            await RpcApi.SetConfigCommand(TabRpcClient, { "app:language": newLang });
            await refreshConfigAndReloadSelectedFile();
        } catch (e: any) {
            globalStore.set(model.errorMessageAtom, e?.message ? String(e.message) : String(e));
        } finally {
            setIsUpdating(false);
        }
    };

    const setRemoteTmuxResume = async (enabled: boolean) => {
        if (enabled === remoteTmuxResumeEnabled || isUpdating) return;
        setIsUpdating(true);
        globalStore.set(model.errorMessageAtom, null);

        try {
            await RpcApi.SetConfigCommand(TabRpcClient, { "term:remotetmuxresume": enabled });
            await refreshConfigAndReloadSelectedFile();
        } catch (e: any) {
            globalStore.set(model.errorMessageAtom, e?.message ? String(e.message) : String(e));
        } finally {
            setIsUpdating(false);
        }
    };

    const setCtrlmSubmit = async (enabled: boolean) => {
        if (enabled === ctrlmSubmitEnabled || isUpdating) return;
        setIsUpdating(true);
        globalStore.set(model.errorMessageAtom, null);

        try {
            await RpcApi.SetConfigCommand(TabRpcClient, { "term:ctrlmsubmit": enabled });
            await refreshConfigAndReloadSelectedFile();
        } catch (e: any) {
            globalStore.set(model.errorMessageAtom, e?.message ? String(e.message) : String(e));
        } finally {
            setIsUpdating(false);
        }
    };

    const setGlobalFontSize = async (nextFontSize: number) => {
        if (nextFontSize === configuredFontSize || isFontSizeUpdating) return;
        setIsFontSizeUpdating(true);
        globalStore.set(model.errorMessageAtom, null);

        try {
            await RpcApi.SetConfigCommand(TabRpcClient, { "term:fontsize": nextFontSize });
            await refreshConfigAndReloadSelectedFile();
        } catch (e: any) {
            globalStore.set(model.errorMessageAtom, e?.message ? String(e.message) : String(e));
        } finally {
            setIsFontSizeUpdating(false);
        }
    };

    const handleFontSizeChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const nextValue = e.target.value;
        setFontSize(nextValue);
        if (nextValue.trim() === "") return;

        const parsedValue = Number(nextValue);
        if (!Number.isInteger(parsedValue) || parsedValue < 8 || parsedValue > 72) return;

        await setGlobalFontSize(parsedValue);
    };

    const resetFontSizeToDefault = async () => {
        setFontSize("12");
        await setGlobalFontSize(12);
    };

    return (
        <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
            <div className="flex flex-col gap-1">
                <div className="text-lg font-semibold">{t("settings.language")}</div>
                <div className="text-sm text-muted-foreground">{t("settings.language.description")}</div>
            </div>

            <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="radio"
                        name="app-language"
                        checked={lang === "en"}
                        disabled={isUpdating}
                        onChange={() => setLanguage("en")}
                    />
                    <span className="text-sm">{t("settings.language.english")}</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="radio"
                        name="app-language"
                        checked={lang === "zh-CN"}
                        disabled={isUpdating}
                        onChange={() => setLanguage("zh-CN")}
                    />
                    <span className="text-sm">{t("settings.language.chinese")}</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="radio"
                        name="app-language"
                        checked={lang === "zh-TW"}
                        disabled={isUpdating}
                        onChange={() => setLanguage("zh-TW")}
                    />
                    <span className="text-sm">{t("settings.language.chineseTraditional")}</span>
                </label>
            </div>

            <div className="flex flex-col gap-1">
                {/* TODO: i18n */}
                <div className="text-lg font-semibold">Default Font Size</div>
                {/* TODO: i18n */}
                <div className="text-sm text-muted-foreground">
                    Font size for new terminal blocks. Existing terminals are not affected.
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="number"
                    min={8}
                    max={72}
                    step={1}
                    value={fontSize}
                    disabled={isFontSizeUpdating}
                    onChange={handleFontSizeChange}
                    className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {/* TODO: i18n */}
                <span className="text-sm text-muted-foreground">px</span>
                <button
                    type="button"
                    disabled={isFontSizeUpdating || configuredFontSize === 12}
                    onClick={resetFontSizeToDefault}
                    className="text-sm text-primary disabled:text-muted-foreground"
                >
                    {/* TODO: i18n */}
                    Reset to default
                </button>
            </div>

            <div className="flex flex-col gap-1">
                <div className="text-lg font-semibold">{t("settings.remoteTmuxResume")}</div>
                <div className="text-sm text-muted-foreground">{t("settings.remoteTmuxResume.description")}</div>
            </div>

            <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={remoteTmuxResumeEnabled}
                        disabled={isUpdating}
                        onChange={(e) => setRemoteTmuxResume(e.target.checked)}
                    />
                    <span className="text-sm">{t("settings.remoteTmuxResume.toggle")}</span>
                </label>
            </div>

            <div className="flex flex-col gap-1">
                <div className="text-lg font-semibold">{t("settings.ctrlmSubmit")}</div>
                <div className="text-sm text-muted-foreground">{t("settings.ctrlmSubmit.description")}</div>
            </div>

            <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={ctrlmSubmitEnabled}
                        disabled={isUpdating}
                        onChange={(e) => setCtrlmSubmit(e.target.checked)}
                    />
                    <span className="text-sm">{t("settings.ctrlmSubmit.toggle")}</span>
                </label>
            </div>
        </div>
    );
}
