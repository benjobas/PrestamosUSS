"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const CameraScanner = dynamic(() => import("./camera-scanner"), {
  ssr: false,
});

type KioskState = "scan-student" | "scan-item" | "success" | "error";
type InputMode = "scanner" | "camera" | "manual";

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
  const [inputMode, setInputMode] = useState<InputMode>("scanner");
  const [studentRun, setStudentRun] = useState("");
  const [studentId, setStudentId] = useState("");
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [errorData, setErrorData] = useState<ErrorData | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [timeoutCountdown, setTimeoutCountdown] = useState(30);
  const [inputValue, setInputValue] = useState("");
  const [manualRut, setManualRut] = useState("");
  const [processing, setProcessing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
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
    setManualRut("");
    setProcessing(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (timeoutCountdownRef.current) clearInterval(timeoutCountdownRef.current);
  }, []);

  // Auto-focus input for scanner mode in states 1 and 2
  useEffect(() => {
    if (
      (state === "scan-student" || state === "scan-item") &&
      inputMode === "scanner"
    ) {
      const focusInput = () => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      };
      focusInput();
      const interval = setInterval(focusInput, 500);
      return () => clearInterval(interval);
    }
  }, [state, inputMode]);

  // Focus manual input when switching to manual mode
  useEffect(() => {
    if (inputMode === "manual") {
      manualInputRef.current?.focus();
    }
  }, [inputMode]);

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
      // Not a URL — try direct RUT format
    }
    // Accept direct RUT: with or without dots, with hyphen + DV
    // e.g. "12345678-9", "12.345.678-K", "12345678-k"
    const cleaned = trimmed.replace(/\./g, "");
    if (/^\d{7,8}-[\dkK]$/i.test(cleaned)) {
      return cleaned.toUpperCase();
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
        // If manual mode was used for student, switch to scanner for item step
        if (inputMode === "manual") setInputMode("scanner");
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

  function handleCameraScan(decodedText: string) {
    if (processing) return;
    if (state === "scan-student") {
      handleStudentScan(decodedText);
    } else if (state === "scan-item") {
      handleItemScan(decodedText);
    }
  }

  function handleManualSubmit() {
    if (!manualRut.trim() || processing) return;
    handleStudentScan(manualRut);
  }

  function formatManualInput(value: string): string {
    // Strip non-alphanumeric except K/k
    const raw = value.replace(/[^0-9kK]/g, "");
    if (raw.length === 0) return "";
    // Separate body from DV (last char)
    if (raw.length <= 1) return raw;
    const body = raw.slice(0, -1);
    const dv = raw.slice(-1);
    // Add dots for formatting
    let formatted = "";
    const reversed = body.split("").reverse();
    for (let i = 0; i < reversed.length; i++) {
      if (i > 0 && i % 3 === 0) formatted = "." + formatted;
      formatted = reversed[i] + formatted;
    }
    return formatted + "-" + dv;
  }

  return (
    <div className="bg-vgsurface font-[family-name:var(--font-inter)] text-vgon-surface flex flex-col h-full">
      {/* Header */}
      <header className="flex justify-between items-center px-12 h-24 w-full bg-white/80 backdrop-blur-md z-40 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-3xl font-extrabold tracking-tighter text-vgprimary font-[family-name:var(--font-manrope)]">
            Vanguard Loan Management
          </span>
        </div>
        <div className="flex items-center gap-8">
          {/* Progress Indicator */}
          <div className="flex items-center gap-3 bg-vgsurface-low px-6 py-2 rounded-full border border-vgsurface-highest">
            <span className="font-[family-name:var(--font-inter)] font-bold text-vgprimary text-sm uppercase tracking-widest">
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
                    ? "bg-vgprimary"
                    : state === "error"
                      ? "bg-vgerror"
                      : "bg-vgsurface-highest"
                }`}
              />
              <div
                className={`w-8 h-2 rounded-full transition-colors ${
                  state === "scan-item" || state === "success"
                    ? "bg-vgprimary"
                    : state === "error"
                      ? "bg-vgerror"
                      : "bg-vgsurface-highest"
                }`}
              />
            </div>
          </div>
          <div className="flex items-center gap-6 border-l pl-8 border-vgsurface-highest">
            <div className="flex flex-col items-end">
              <span className="font-[family-name:var(--font-manrope)] font-bold text-sm tracking-wide text-vgprimary">
                Kiosk Mode
              </span>
              <span className="font-[family-name:var(--font-inter)] text-[10px] tracking-[0.1em] text-vgsecondary uppercase">
                Terminal #042
              </span>
            </div>
            <span className="material-symbols-outlined !text-4xl text-vgprimary">
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
            {/* Icon — smaller when camera is active to save space */}
            <div className={`relative ${inputMode === "camera" ? "mb-6" : "mb-12"}`}>
              <div className="absolute inset-0 bg-vgprimary/5 rounded-full scale-150 blur-3xl" />
              <div className={`bg-vgsurface-lowest rounded-[2rem] shadow-[0_12px_32px_rgba(26,28,30,0.06)] relative transition-all ${inputMode === "camera" ? "p-8" : "p-16"}`}>
                <span className={`material-symbols-outlined text-vgprimary transition-all ${inputMode === "camera" ? "!text-[80px]" : "!text-[160px]"}`}>
                  badge
                </span>
              </div>
              {inputMode !== "camera" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-1 bg-vgsecondary shadow-[0_0_15px_#13696a] opacity-50" />
              )}
            </div>
            <h1 className={`font-[family-name:var(--font-manrope)] font-extrabold text-vgprimary tracking-tight transition-all ${inputMode === "camera" ? "text-3xl md:text-4xl mb-2" : "text-5xl md:text-6xl mb-4"}`}>
              Identificación de Estudiante
            </h1>
            <p className={`text-vgon-surface/60 max-w-2xl font-medium ${inputMode === "camera" ? "text-lg mb-5" : "text-2xl mb-8"}`}>
              {inputMode === "scanner"
                ? "Acerque su cédula al lector QR para capturar su RUN."
                : inputMode === "camera"
                  ? "Apunte la cámara al código QR de su cédula."
                  : "Ingrese su RUT utilizando el teclado."}
            </p>

            {/* Mode selector */}
            <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,32,69,0.06)] border border-vgsurface-highest/60 mb-8">
              {([
                { mode: "scanner" as InputMode, icon: "qr_code_scanner", label: "Lector QR" },
                { mode: "camera" as InputMode, icon: "photo_camera", label: "Cámara" },
                { mode: "manual" as InputMode, icon: "keyboard", label: "Ingresar RUT" },
              ]).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => { setInputMode(mode); setInputValue(""); setManualRut(""); }}
                  className={`flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-[family-name:var(--font-inter)] font-semibold text-sm tracking-wide transition-all cursor-pointer ${
                    inputMode === mode
                      ? "bg-vgprimary text-white shadow-md"
                      : "text-vgon-surface/50 hover:text-vgprimary hover:bg-vgsurface-low"
                  }`}
                >
                  <span className={`material-symbols-outlined !text-xl ${inputMode === mode ? "" : ""}`}>
                    {icon}
                  </span>
                  {label}
                </button>
              ))}
            </div>

            {/* Scanner mode (USB QR reader) */}
            {inputMode === "scanner" && (
              <div className="w-full max-w-md relative animate-[fadeIn_0.3s_ease-out]">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  className="kiosk-scanner-input w-full bg-white border-2 border-vgsurface-highest rounded-2xl p-6 text-center text-3xl font-bold text-vgprimary placeholder:text-vgsurface-highest"
                  placeholder="Esperando RUN..."
                  autoFocus
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  <span className="material-symbols-outlined !text-4xl text-vgsecondary animate-pulse">
                    qr_code_scanner
                  </span>
                </div>
              </div>
            )}

            {/* Camera mode */}
            {inputMode === "camera" && (
              <CameraScanner
                onScan={handleCameraScan}
                active={state === "scan-student" && inputMode === "camera"}
              />
            )}

            {/* Manual RUT mode */}
            {inputMode === "manual" && (
              <div className="w-full max-w-md flex flex-col items-center gap-5 animate-[fadeIn_0.3s_ease-out]">
                <div className="w-full relative">
                  <input
                    ref={manualInputRef}
                    type="text"
                    value={manualRut}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9kK]/g, "");
                      if (raw.length <= 9) {
                        setManualRut(formatManualInput(e.target.value));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleManualSubmit();
                    }}
                    className="kiosk-scanner-input w-full bg-white border-2 border-vgsurface-highest rounded-2xl p-6 text-center text-3xl font-bold text-vgprimary placeholder:text-vgsurface-highest/70 tracking-widest"
                    placeholder="12.345.678-9"
                    autoFocus
                    inputMode="numeric"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2">
                    <span className="material-symbols-outlined !text-4xl text-vgprimary/30">
                      badge
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualRut.trim() || processing}
                  className="w-full bg-vgprimary text-white py-5 rounded-2xl font-[family-name:var(--font-manrope)] font-bold text-xl flex items-center justify-center gap-3 hover:bg-vgprimary/90 active:scale-[0.98] transition-all shadow-lg disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  {processing ? (
                    <>
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined !text-2xl">
                        arrow_forward
                      </span>
                      Continuar
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* State 2: Scan Item */}
        {state === "scan-item" && (
          <div className="flex flex-col items-center text-center w-full max-w-4xl animate-[fadeIn_0.7s_ease-out]">
            {/* Icon — smaller when camera is active */}
            <div className={`relative ${inputMode === "camera" ? "mb-4" : "mb-12"}`}>
              <div className="absolute inset-0 bg-vgsecondary/5 rounded-full scale-150 blur-3xl" />
              <div className={`bg-vgsurface-lowest rounded-[2rem] shadow-[0_12px_32px_rgba(26,28,30,0.06)] relative transition-all ${inputMode === "camera" ? "p-8" : "p-16"}`}>
                <span
                  className={`material-symbols-outlined text-vgsecondary transition-all ${inputMode === "camera" ? "!text-[80px]" : "!text-[160px]"}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  inventory_2
                </span>
              </div>
              {inputMode !== "camera" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-1 bg-vgprimary shadow-[0_0_15px_#002045] opacity-50" />
              )}
            </div>
            <div className="flex items-center gap-3 mb-4 bg-vgprimary/10 px-6 py-2 rounded-full border border-vgprimary/20">
              <span className="material-symbols-outlined !text-2xl text-vgprimary">
                person
              </span>
              <span className="font-[family-name:var(--font-manrope)] font-bold text-vgprimary text-xl">
                RUN: {formatRun(studentRun)}
              </span>
            </div>
            <h1 className={`font-[family-name:var(--font-manrope)] font-extrabold text-vgprimary tracking-tight ${inputMode === "camera" ? "text-3xl md:text-4xl mb-2" : "text-5xl md:text-6xl mb-4"}`}>
              Escaneo de Artículo
            </h1>
            <p className={`text-vgon-surface/60 max-w-2xl font-medium ${inputMode === "camera" ? "text-lg mb-4" : "text-2xl mb-6"}`}>
              {inputMode === "camera"
                ? "Apunte la cámara al código QR del artículo."
                : "Escanee el código QR del artículo que desea procesar."}
            </p>

            {/* Mode selector for item scan (scanner / camera only) */}
            <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,32,69,0.06)] border border-vgsurface-highest/60 mb-6">
              {([
                { mode: "scanner" as InputMode, icon: "qr_code_scanner", label: "Lector QR" },
                { mode: "camera" as InputMode, icon: "photo_camera", label: "Cámara" },
              ]).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => { setInputMode(mode); setInputValue(""); }}
                  className={`flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-[family-name:var(--font-inter)] font-semibold text-sm tracking-wide transition-all cursor-pointer ${
                    inputMode === mode
                      ? "bg-vgprimary text-white shadow-md"
                      : "text-vgon-surface/50 hover:text-vgprimary hover:bg-vgsurface-low"
                  }`}
                >
                  <span className="material-symbols-outlined !text-xl">
                    {icon}
                  </span>
                  {label}
                </button>
              ))}
            </div>

            {/* Scanner mode */}
            {inputMode === "scanner" && (
              <div className="w-full max-w-md relative animate-[fadeIn_0.3s_ease-out]">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  className="kiosk-scanner-input w-full bg-white border-2 border-vgsurface-highest rounded-2xl p-6 text-center text-3xl font-bold text-vgprimary placeholder:text-vgsurface-highest"
                  placeholder="Esperando Artículo..."
                  autoFocus
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  <span className="material-symbols-outlined !text-4xl text-vgprimary animate-pulse">
                    barcode_scanner
                  </span>
                </div>
              </div>
            )}

            {/* Camera mode */}
            {inputMode === "camera" && (
              <CameraScanner
                onScan={handleCameraScan}
                active={state === "scan-item" && inputMode === "camera"}
              />
            )}
          </div>
        )}

        {/* State 3: Success */}
        {state === "success" && successData && (
          <div className="flex flex-col items-center text-center animate-[zoomIn_0.5s_ease-out]">
            <div className="bg-vgsecondary p-12 rounded-full mb-10 shadow-xl">
              <span
                className="material-symbols-outlined text-white !text-[160px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
            <h2 className="font-[family-name:var(--font-manrope)] font-extrabold text-6xl text-vgprimary mb-8">
              Operación Registrada
            </h2>
            <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] flex flex-col gap-6 w-full max-w-2xl border border-vgsurface-low">
              <div className="flex justify-between items-center border-b border-vgsurface-low pb-6">
                <div className="text-left">
                  <span className="font-[family-name:var(--font-inter)] uppercase tracking-widest text-vgon-surface/50 text-sm block mb-1">
                    Usuario Identificado
                  </span>
                  <span className="font-[family-name:var(--font-manrope)] font-bold text-3xl text-vgprimary">
                    RUN: {formatRun(successData.run)}
                  </span>
                </div>
                <span className="material-symbols-outlined !text-5xl text-vgon-surface/20">
                  account_circle
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-vgsurface-low pb-6">
                <div className="text-left">
                  <span className="font-[family-name:var(--font-inter)] uppercase tracking-widest text-vgon-surface/50 text-sm block mb-1">
                    Artículo Procesado
                  </span>
                  <span className="font-[family-name:var(--font-manrope)] font-bold text-3xl text-vgprimary">
                    {successData.itemName}
                  </span>
                </div>
                <span className="material-symbols-outlined !text-5xl text-vgon-surface/20">
                  category
                </span>
              </div>
              <div className="flex justify-between items-center bg-vgsurface-lowest p-6 rounded-2xl border-2 border-dashed border-vgsurface-highest">
                <span className="font-[family-name:var(--font-inter)] uppercase tracking-widest text-vgon-surface/50 text-sm font-bold">
                  Tipo de Operación
                </span>
                <span
                  className={`px-8 py-2 rounded-full font-bold text-xl tracking-wide ${
                    successData.operationType === "PRÉSTAMO"
                      ? "bg-vgprimary text-white"
                      : "bg-vgsecondary text-white"
                  }`}
                >
                  {successData.operationType}
                </span>
              </div>
            </div>
            <div className="mt-12 flex items-center gap-4 bg-vgsurface-low px-8 py-4 rounded-full">
              <div className="w-3 h-3 rounded-full bg-vgsecondary animate-pulse" />
              <p className="font-[family-name:var(--font-inter)] text-xl text-vgon-surface/60">
                Finalizando sesión en{" "}
                <span className="font-bold text-vgprimary">
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
            <div className="bg-vgerror p-12 rounded-full mb-10 shadow-xl">
              <span
                className="material-symbols-outlined text-white !text-[160px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
            </div>
            <h2 className="font-[family-name:var(--font-manrope)] font-extrabold text-6xl text-vgprimary mb-6">
              Error en la Operación
            </h2>
            <p className="text-2xl text-vgon-surface/60 max-w-2xl font-medium mb-10">
              {errorData.message}
            </p>
            <div className="flex items-center gap-4 bg-vgerror-container/30 px-8 py-4 rounded-full border border-vgerror/20">
              <div className="w-3 h-3 rounded-full bg-vgerror animate-pulse" />
              <p className="font-[family-name:var(--font-inter)] text-xl text-vgerror">
                Regresando al inicio en{" "}
                <span className="font-bold">{countdown} segundos</span>...
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="h-32 w-full bg-vgsurface-low flex items-center justify-between px-16 border-t border-vgsurface-highest shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-vgsecondary animate-pulse" />
            <span className="font-[family-name:var(--font-inter)] font-bold tracking-widest text-vgprimary uppercase text-sm">
              Sistema Activo
            </span>
          </div>
          {/* Timeout indicator - only in state 2 */}
          {state === "scan-item" && (
            <div className="flex items-center gap-2 text-vgerror bg-vgerror-container/30 px-4 py-2 rounded-lg border border-vgerror/20">
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
              className="bg-vgprimary px-10 py-4 rounded-xl font-[family-name:var(--font-manrope)] font-bold text-white flex items-center gap-3 hover:bg-vgprimary/90 active:scale-95 transition-all shadow-lg cursor-pointer"
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
        @keyframes scanPulse {
          0%, 100% { opacity: 0.3; transform: translateY(-20px); }
          50% { opacity: 0.8; transform: translateY(20px); }
        }
      `}</style>
    </div>
  );
}
