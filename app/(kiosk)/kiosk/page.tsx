"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type KioskState = "scan-student" | "scan-item" | "success" | "error";

interface SuccessData {
  run: string;
  itemName: string;
  operationType: "PRÉSTAMO" | "DEVOLUCIÓN";
}

interface ErrorData {
  message: string;
}

export default function KioskPage() {
  const [state, setState] = useState<KioskState>("scan-student");
  const [studentRun, setStudentRun] = useState("");
  const [studentId, setStudentId] = useState("");
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [errorData, setErrorData] = useState<ErrorData | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [timeoutCountdown, setTimeoutCountdown] = useState(30);
  const [inputValue, setInputValue] = useState("");
  const [processing, setProcessing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutCountdownRef = useRef<NodeJS.Timeout | null>(null);

  const resetToInitial = useCallback(() => {
    setState("scan-student");
    setStudentRun("");
    setStudentId("");
    setSuccessData(null);
    setErrorData(null);
    setCountdown(0);
    setTimeoutCountdown(30);
    setInputValue("");
    setProcessing(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (timeoutCountdownRef.current) clearInterval(timeoutCountdownRef.current);
  }, []);

  // Auto-focus input for states 1 and 2
  useEffect(() => {
    if (state === "scan-student" || state === "scan-item") {
      const focusInput = () => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      };
      focusInput();
      const interval = setInterval(focusInput, 500);
      return () => clearInterval(interval);
    }
  }, [state]);

  // 30-second timeout for state 2
  useEffect(() => {
    if (state === "scan-item") {
      setTimeoutCountdown(30);
      timeoutCountdownRef.current = setInterval(() => {
        setTimeoutCountdown((prev) => {
          if (prev <= 1) {
            resetToInitial();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timeoutCountdownRef.current)
          clearInterval(timeoutCountdownRef.current);
      };
    }
  }, [state, resetToInitial]);

  // Countdown for success/error states
  useEffect(() => {
    if (state === "success" || state === "error") {
      const duration = state === "success" ? 8 : 5;
      setCountdown(duration);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            resetToInitial();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [state, resetToInitial]);

  function extractRun(input: string): string | null {
    const trimmed = input.trim();
    // Try to extract RUN from URL with ?RUN= parameter
    try {
      const url = new URL(trimmed);
      const run = url.searchParams.get("RUN");
      if (run && /^\d{7,8}-[\dkK]$/i.test(run)) {
        return run.toUpperCase();
      }
    } catch {
      // Not a URL
    }
    return null;
  }

  function formatRun(run: string): string {
    // Format: XX.XXX.XXX-X
    const parts = run.split("-");
    const digits = parts[0];
    const dv = parts[1];
    if (digits.length <= 6) return run;
    const formatted =
      digits.slice(0, -6) +
      "." +
      digits.slice(-6, -3) +
      "." +
      digits.slice(-3);
    return formatted + "-" + dv;
  }

  async function handleStudentScan(value: string) {
    const run = extractRun(value);
    if (!run) {
      setErrorData({ message: "Formato de cédula no válido. Por favor, intente nuevamente." });
      setState("error");
      setInputValue("");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/kiosk/scan-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorData({ message: data.error || "Error al procesar el estudiante." });
        setState("error");
      } else {
        setStudentRun(run);
        setStudentId(data.student.id);
        setState("scan-item");
      }
    } catch {
      setErrorData({ message: "Error de conexión. Intente nuevamente." });
      setState("error");
    } finally {
      setProcessing(false);
      setInputValue("");
    }
  }

  async function handleItemScan(value: string) {
    const internalCode = value.trim();
    if (!internalCode) return;

    setProcessing(true);
    try {
      const res = await fetch("/api/kiosk/scan-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalCode, studentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorData({ message: data.error || "Error al procesar el artículo." });
        setState("error");
      } else {
        setSuccessData({
          run: studentRun,
          itemName: data.itemName,
          operationType: data.operationType,
        });
        setState("success");
      }
    } catch {
      setErrorData({ message: "Error de conexión. Intente nuevamente." });
      setState("error");
    } finally {
      setProcessing(false);
      setInputValue("");
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const value = (e.target as HTMLInputElement).value;
      if (!value.trim() || processing) return;
      if (state === "scan-student") {
        handleStudentScan(value);
      } else if (state === "scan-item") {
        handleItemScan(value);
      }
    }
  }

  return (
    <div className="bg-ksurface font-[family-name:var(--font-inter)] text-kon-surface flex flex-col h-full">
      {/* Header */}
      <header className="flex justify-between items-center px-12 h-24 w-full bg-white/80 backdrop-blur-md z-40 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-3xl font-extrabold tracking-tighter text-kprimary font-[family-name:var(--font-manrope)]">
            Vanguard Loan Management
          </span>
        </div>
        <div className="flex items-center gap-8">
          {/* Progress Indicator */}
          <div className="flex items-center gap-3 bg-ksurface-low px-6 py-2 rounded-full border border-ksurface-highest">
            <span className="font-[family-name:var(--font-inter)] font-bold text-kprimary text-sm uppercase tracking-widest">
              {state === "scan-student"
                ? "Paso 1 de 2"
                : state === "scan-item"
                  ? "Paso 2 de 2"
                  : state === "success"
                    ? "Completado"
                    : "Error"}
            </span>
            <div className="flex gap-1.5">
              <div
                className={`w-8 h-2 rounded-full transition-colors ${
                  state === "scan-student" ||
                  state === "scan-item" ||
                  state === "success"
                    ? "bg-kprimary"
                    : state === "error"
                      ? "bg-kerror"
                      : "bg-ksurface-highest"
                }`}
              />
              <div
                className={`w-8 h-2 rounded-full transition-colors ${
                  state === "scan-item" || state === "success"
                    ? "bg-kprimary"
                    : state === "error"
                      ? "bg-kerror"
                      : "bg-ksurface-highest"
                }`}
              />
            </div>
          </div>
          <div className="flex items-center gap-6 border-l pl-8 border-ksurface-highest">
            <div className="flex flex-col items-end">
              <span className="font-[family-name:var(--font-manrope)] font-bold text-sm tracking-wide text-kprimary">
                Kiosk Mode
              </span>
              <span className="font-[family-name:var(--font-inter)] text-[10px] tracking-[0.1em] text-ksecondary uppercase">
                Terminal #042
              </span>
            </div>
            <span className="material-symbols-outlined !text-4xl text-kprimary">
              sensors
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 relative">
        {/* State 1: Scan Student */}
        {state === "scan-student" && (
          <div className="flex flex-col items-center text-center w-full max-w-4xl animate-[fadeIn_0.7s_ease-out]">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-kprimary/5 rounded-full scale-150 blur-3xl" />
              <div className="bg-ksurface-lowest p-16 rounded-[2rem] shadow-[0_12px_32px_rgba(26,28,30,0.06)] relative">
                <span className="material-symbols-outlined text-kprimary !text-[160px]">
                  badge
                </span>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-1 bg-ksecondary shadow-[0_0_15px_#13696a] opacity-50" />
            </div>
            <h1 className="font-[family-name:var(--font-manrope)] font-extrabold text-5xl md:text-6xl text-kprimary mb-4 tracking-tight">
              Escaneo de Cédula
            </h1>
            <p className="text-2xl text-kon-surface/60 max-w-2xl font-medium mb-10">
              Por favor, acerque su documento de identidad al escáner para
              capturar su RUN.
            </p>
            <div className="w-full max-w-md relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="kiosk-scanner-input w-full bg-white border-2 border-ksurface-highest rounded-2xl p-6 text-center text-3xl font-bold text-kprimary placeholder:text-ksurface-highest"
                placeholder="Esperando RUN..."
                autoFocus
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2">
                <span className="material-symbols-outlined !text-4xl text-ksecondary animate-pulse">
                  qr_code_scanner
                </span>
              </div>
            </div>
          </div>
        )}

        {/* State 2: Scan Item */}
        {state === "scan-item" && (
          <div className="flex flex-col items-center text-center w-full max-w-4xl animate-[fadeIn_0.7s_ease-out]">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-ksecondary/5 rounded-full scale-150 blur-3xl" />
              <div className="bg-ksurface-lowest p-16 rounded-[2rem] shadow-[0_12px_32px_rgba(26,28,30,0.06)] relative">
                <span
                  className="material-symbols-outlined text-ksecondary !text-[160px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  inventory_2
                </span>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-1 bg-kprimary shadow-[0_0_15px_#002045] opacity-50" />
            </div>
            <div className="flex items-center gap-3 mb-4 bg-kprimary/10 px-6 py-2 rounded-full border border-kprimary/20">
              <span className="material-symbols-outlined !text-2xl text-kprimary">
                person
              </span>
              <span className="font-[family-name:var(--font-manrope)] font-bold text-kprimary text-xl">
                RUN: {formatRun(studentRun)}
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-manrope)] font-extrabold text-5xl md:text-6xl text-kprimary mb-4 tracking-tight">
              Escaneo de Artículo
            </h1>
            <p className="text-2xl text-kon-surface/60 max-w-2xl font-medium mb-10">
              Escanee el código de barras o QR del artículo que desea procesar.
            </p>
            <div className="w-full max-w-md relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="kiosk-scanner-input w-full bg-white border-2 border-ksurface-highest rounded-2xl p-6 text-center text-3xl font-bold text-kprimary placeholder:text-ksurface-highest"
                placeholder="Esperando Artículo..."
                autoFocus
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2">
                <span className="material-symbols-outlined !text-4xl text-kprimary animate-pulse">
                  barcode_scanner
                </span>
              </div>
            </div>
          </div>
        )}

        {/* State 3: Success */}
        {state === "success" && successData && (
          <div className="flex flex-col items-center text-center animate-[zoomIn_0.5s_ease-out]">
            <div className="bg-ksecondary p-12 rounded-full mb-10 shadow-xl">
              <span
                className="material-symbols-outlined text-white !text-[160px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
            <h2 className="font-[family-name:var(--font-manrope)] font-extrabold text-6xl text-kprimary mb-8">
              Operación Registrada
            </h2>
            <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] flex flex-col gap-6 w-full max-w-2xl border border-ksurface-low">
              <div className="flex justify-between items-center border-b border-ksurface-low pb-6">
                <div className="text-left">
                  <span className="font-[family-name:var(--font-inter)] uppercase tracking-widest text-kon-surface/50 text-sm block mb-1">
                    Usuario Identificado
                  </span>
                  <span className="font-[family-name:var(--font-manrope)] font-bold text-3xl text-kprimary">
                    RUN: {formatRun(successData.run)}
                  </span>
                </div>
                <span className="material-symbols-outlined !text-5xl text-kon-surface/20">
                  account_circle
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-ksurface-low pb-6">
                <div className="text-left">
                  <span className="font-[family-name:var(--font-inter)] uppercase tracking-widest text-kon-surface/50 text-sm block mb-1">
                    Artículo Procesado
                  </span>
                  <span className="font-[family-name:var(--font-manrope)] font-bold text-3xl text-kprimary">
                    {successData.itemName}
                  </span>
                </div>
                <span className="material-symbols-outlined !text-5xl text-kon-surface/20">
                  category
                </span>
              </div>
              <div className="flex justify-between items-center bg-ksurface-lowest p-6 rounded-2xl border-2 border-dashed border-ksurface-highest">
                <span className="font-[family-name:var(--font-inter)] uppercase tracking-widest text-kon-surface/50 text-sm font-bold">
                  Tipo de Operación
                </span>
                <span
                  className={`px-8 py-2 rounded-full font-bold text-xl tracking-wide ${
                    successData.operationType === "PRÉSTAMO"
                      ? "bg-kprimary text-white"
                      : "bg-ksecondary text-white"
                  }`}
                >
                  {successData.operationType}
                </span>
              </div>
            </div>
            <div className="mt-12 flex items-center gap-4 bg-ksurface-low px-8 py-4 rounded-full">
              <div className="w-3 h-3 rounded-full bg-ksecondary animate-pulse" />
              <p className="font-[family-name:var(--font-inter)] text-xl text-kon-surface/60">
                Finalizando sesión en{" "}
                <span className="font-bold text-kprimary">
                  {countdown} segundos
                </span>
                ...
              </p>
            </div>
          </div>
        )}

        {/* State 4: Error */}
        {state === "error" && errorData && (
          <div className="flex flex-col items-center text-center animate-[fadeIn_0.5s_ease-out]">
            <div className="bg-kerror p-12 rounded-full mb-10 shadow-xl">
              <span
                className="material-symbols-outlined text-white !text-[160px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
            </div>
            <h2 className="font-[family-name:var(--font-manrope)] font-extrabold text-6xl text-kprimary mb-6">
              Error en la Operación
            </h2>
            <p className="text-2xl text-kon-surface/60 max-w-2xl font-medium mb-10">
              {errorData.message}
            </p>
            <div className="flex items-center gap-4 bg-kerror-container/30 px-8 py-4 rounded-full border border-kerror/20">
              <div className="w-3 h-3 rounded-full bg-kerror animate-pulse" />
              <p className="font-[family-name:var(--font-inter)] text-xl text-kerror">
                Regresando al inicio en{" "}
                <span className="font-bold">{countdown} segundos</span>...
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="h-32 w-full bg-ksurface-low flex items-center justify-between px-16 border-t border-ksurface-highest shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-ksecondary animate-pulse" />
            <span className="font-[family-name:var(--font-inter)] font-bold tracking-widest text-kprimary uppercase text-sm">
              Sistema Activo
            </span>
          </div>
          {/* Timeout indicator - only in state 2 */}
          {state === "scan-item" && (
            <div className="flex items-center gap-2 text-kerror bg-kerror-container/30 px-4 py-2 rounded-lg border border-kerror/20">
              <span className="material-symbols-outlined !text-xl">timer</span>
              <span className="font-[family-name:var(--font-inter)] font-bold text-xs uppercase tracking-tighter">
                Cierre en: 00:
                {timeoutCountdown.toString().padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-4">
          {/* Cancel button - only in state 2 */}
          {state === "scan-item" && (
            <button
              onClick={resetToInitial}
              className="bg-kprimary px-10 py-4 rounded-xl font-[family-name:var(--font-manrope)] font-bold text-white flex items-center gap-3 hover:bg-kprimary/90 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              <span className="material-symbols-outlined !text-2xl">
                cancel
              </span>
              Cancelar Operación
            </button>
          )}
        </div>
      </footer>

      {/* Load Material Symbols */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .material-symbols-outlined {
          font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 48;
        }
      `}</style>
    </div>
  );
}
