"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface CameraScannerProps {
  onScan: (value: string) => void;
  active: boolean;
}

export default function CameraScanner({ onScan, active }: CameraScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const hasScannedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          // SCANNING state
          await scannerRef.current.stop();
        }
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!active || scannerRef.current || !containerRef.current) return;

    setStarting(true);
    setError(null);
    hasScannedRef.current = false;

    try {
      const scanner = new Html5Qrcode("kiosk-camera-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1,
        },
        (decodedText) => {
          if (!hasScannedRef.current) {
            hasScannedRef.current = true;
            onScan(decodedText);
          }
        },
        () => {
          // ignore scan failures (no QR found in frame)
        }
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No se pudo acceder a la cámara";
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setError("Permiso de cámara denegado. Habilite el acceso en su navegador.");
      } else if (msg.includes("NotFound") || msg.includes("device")) {
        setError("No se encontró una cámara disponible.");
      } else {
        setError("Error al iniciar la cámara. Intente nuevamente.");
      }
      scannerRef.current = null;
    } finally {
      setStarting(false);
    }
  }, [active, onScan]);

  useEffect(() => {
    if (active) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [active, startScanner, stopScanner]);

  if (!active) return null;

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-3 animate-[fadeIn_0.4s_ease-out]">
      <div className="relative w-64 h-64 rounded-2xl overflow-hidden bg-black/90 shadow-[0_8px_40px_rgba(0,32,69,0.15)]">
        {/* Scanning overlay corners */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Top-left */}
          <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-vgsecondary rounded-tl-xl" />
          {/* Top-right */}
          <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-vgsecondary rounded-tr-xl" />
          {/* Bottom-left */}
          <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-vgsecondary rounded-bl-xl" />
          {/* Bottom-right */}
          <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-vgsecondary rounded-br-xl" />
          {/* Scan line */}
          <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-vgsecondary/60 animate-[scanPulse_2s_ease-in-out_infinite]" />
        </div>

        {/* Camera feed container */}
        <div
          id="kiosk-camera-reader"
          ref={containerRef}
          className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full [&>img]:hidden [&_#qr-shaded-region]:!border-none"
        />

        {/* Starting overlay */}
        {starting && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 gap-4">
            <div className="w-10 h-10 border-3 border-vgsecondary/30 border-t-vgsecondary rounded-full animate-spin" />
            <span className="text-white/80 font-medium text-sm tracking-wide">
              Iniciando cámara...
            </span>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 gap-4 px-6">
            <span className="material-symbols-outlined text-vgerror !text-5xl">
              videocam_off
            </span>
            <span className="text-white/80 font-medium text-sm text-center leading-relaxed">
              {error}
            </span>
          </div>
        )}
      </div>

      <p className="text-vgon-surface/50 text-sm font-medium">
        Posicione el código QR frente a la cámara
      </p>
    </div>
  );
}
