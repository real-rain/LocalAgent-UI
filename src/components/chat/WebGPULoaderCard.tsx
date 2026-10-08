import { Cpu, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import logo from "../../assets/logo.svg";

interface WebGPULoaderCardProps {
  progress: string;
  isLoading: boolean;
  onRetry: () => void;
  error?: string | null;
}

export function WebGPULoaderCard({
  progress,
  isLoading,
  onRetry,
  error,
}: WebGPULoaderCardProps) {
  const { t } = useTranslation();
  const percentage = Math.min(
    100,
    Number(progress.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? (isLoading ? 8 : 0)),
  );

  return (
    <div className="flex min-h-[52vh] items-center justify-center px-4 py-8">
      <section
        aria-label="WebGPU 模型初始化"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-indigo-500/20 bg-zinc-900/70 p-6 shadow-[0_0_70px_-24px_rgba(79,70,229,0.55)] sm:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-indigo-500/10 blur-3xl"
        />
        <div className="relative">
          <div className="mb-6 flex items-center gap-2 border-b border-zinc-800/80 pb-4">
            <img src={logo} alt="" className="size-5" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {t("chat.runtimeMonitor")}
            </span>
          </div>

          <div className="flex items-start gap-4">
            <div className="relative grid size-12 shrink-0 place-items-center">
              {isLoading && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-ping rounded-2xl bg-indigo-500/15"
                />
              )}
              <span className="absolute inset-0 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 shadow-[0_0_28px_rgba(99,102,241,0.2)]" />
              <Cpu
                className={`relative size-5 text-indigo-300 ${
                  isLoading ? "animate-pulse" : ""
                }`}
                aria-hidden="true"
              />
              <Zap
                className="absolute -right-1 -top-1 size-3.5 animate-pulse fill-indigo-300 text-indigo-300"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
                {t("chat.localInference")}
              </p>
              <h2 className="mt-2 text-sm font-semibold tracking-wide text-zinc-100">
                {t("chat.acceleratedEngineInitializing")}
              </h2>
              <p className="mt-1.5 break-words text-xs leading-5 text-zinc-400">
                {progress || "Initializing WebGPU Engine..."}
              </p>
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
              <span className="text-zinc-500">{t("chat.modelDownload")}</span>
              <span className="tabular-nums text-indigo-300">
                {percentage.toFixed(0)}%
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-zinc-800"
              role="progressbar"
              aria-label="WebGPU 模型加载进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage}
            >
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-200"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="mt-3 break-words font-mono text-[11px] leading-5 text-zinc-500">
              {progress || t("chat.waitingForRuntime")}
            </p>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-xs text-red-300">
              WebGPU 初始化失败：{error}
            </p>
          )}

          <div className="mt-5 rounded-lg border border-indigo-500/10 bg-indigo-500/5 px-3 py-2.5 text-[11px] leading-5 text-zinc-400">
            {t("chat.firstLoadNote")}
          </div>

          <button
            type="button"
            onClick={onRetry}
            disabled={isLoading}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-600 px-4 text-xs font-semibold tracking-wide text-white shadow-lg shadow-indigo-950/30 transition hover:border-indigo-300/50 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60"
          >
            <Cpu
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {isLoading ? t("chat.initializingModel") : t("chat.retryWebgpu")}
          </button>
        </div>
      </section>
    </div>
  );
}
