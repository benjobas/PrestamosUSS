"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";

interface SedeOption {
  id: string;
  name: string;
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Two-step login state
  const [sedes, setSedes] = useState<SedeOption[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState("");
  const [showSedeSelector, setShowSedeSelector] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    // If sede selector is showing, require selection
    if (showSedeSelector && !selectedSedeId) {
      setError("Debe seleccionar una sede");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Step 1: If we haven't validated credentials yet, call login API
      if (!showSedeSelector) {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password }),
        });

        if (!res.ok) {
          setError("Credenciales inválidas");
          setLoading(false);
          return;
        }

        const data = await res.json();

        // If user has multiple sedes, show selector
        if (data.sedes.length > 1) {
          setSedes(data.sedes);
          setShowSedeSelector(true);
          setLoading(false);
          return;
        }

        // Single sede or no sede — proceed directly
        const sedeId = data.sedes[0]?.id || "";
        await doSignIn(sedeId);
        return;
      }

      // Step 2: Sede already selected, sign in
      await doSignIn(selectedSedeId);
    } catch {
      setError("Error de conexión. Intente nuevamente.");
      setLoading(false);
    }
  }

  async function doSignIn(sedeId: string) {
    const result = await signIn("credentials", {
      username: username.trim(),
      password,
      sedeId,
      redirect: false,
    });

    if (result?.error) {
      setError("Credenciales inválidas");
      setLoading(false);
      return;
    }

    window.location.href = "/prestamos";
  }

  return (
    <div className="bg-[#faf9fd] text-[#1a1c1e] min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 brand-pattern pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#002045]/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#13696a]/5 rounded-full blur-[120px]" />

      {/* Main container */}
      <main className="relative z-10 w-full max-w-[440px] px-6">
        {/* Brand header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#002045] rounded-xl mb-6 shadow-xl">
            <span className="material-symbols-outlined text-white text-3xl">
              account_balance
            </span>
          </div>
          <h1
            className="text-3xl font-extrabold text-[#002045] tracking-tighter mb-2"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Vanguard
          </h1>
          <p
            className="text-[#43474e] font-medium tracking-tight"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Sistema de Gestión de Préstamos
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-xl shadow-[0px_12px_32px_rgba(26,28,30,0.04)] p-8 md:p-10 border border-[#c4c6cf]/10">
          {/* Error alert */}
          {error && (
            <div className="mb-6 flex items-center gap-3 p-4 bg-[#ffdad6] text-[#93000a] rounded-xl border border-[#ba1a1a]/10">
              <span className="material-symbols-outlined text-[20px]">
                error
              </span>
              <span
                className="text-sm font-semibold"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {error}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username field */}
            <div className="space-y-2">
              <label
                className="block text-[11px] font-bold tracking-widest text-[#43474e] uppercase ml-1"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                Usuario
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#74777f] text-[20px] group-focus-within:text-[#002045] transition-colors">
                  person
                </span>
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={showSedeSelector}
                  placeholder="Ingrese su usuario"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#e3e2e6] border-none rounded-xl text-[#1a1c1e] placeholder:text-[#74777f]/60 focus:ring-2 focus:ring-[#002045]/20 focus:bg-white transition-all text-sm disabled:opacity-60"
                  style={{ fontFamily: "Inter, sans-serif" }}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label
                className="block text-[11px] font-bold tracking-widest text-[#43474e] uppercase ml-1"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                Contraseña
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#74777f] text-[20px] group-focus-within:text-[#002045] transition-colors">
                  lock
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={showSedeSelector}
                  placeholder="••••••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#e3e2e6] border-none rounded-xl text-[#1a1c1e] placeholder:text-[#74777f]/60 focus:ring-2 focus:ring-[#002045]/20 focus:bg-white transition-all text-sm disabled:opacity-60"
                  style={{ fontFamily: "Inter, sans-serif" }}
                />
              </div>
            </div>

            {/* Sede selector — only shown after successful credential validation with multiple sedes */}
            {showSedeSelector && (
              <div className="space-y-2">
                <label
                  className="block text-[11px] font-bold tracking-widest text-[#43474e] uppercase ml-1"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  Seleccionar Sede
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#74777f] text-[20px] group-focus-within:text-[#002045] transition-colors">
                    location_on
                  </span>
                  <select
                    value={selectedSedeId}
                    onChange={(e) => setSelectedSedeId(e.target.value)}
                    className="appearance-none w-full pl-12 pr-10 py-3.5 bg-[#e3e2e6] border-none rounded-xl text-[#1a1c1e] focus:ring-2 focus:ring-[#002045]/20 focus:bg-white transition-all text-sm cursor-pointer"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    <option disabled value="">
                      Seleccione ubicación...
                    </option>
                    {sedes.map((sede) => (
                      <option key={sede.id} value={sede.id}>
                        {sede.name}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#74777f] pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={
                  loading || !username.trim() || !password.trim()
                }
                className="w-full py-4 bg-gradient-to-r from-[#002045] to-[#1a365d] text-white font-bold rounded-xl shadow-lg shadow-[#002045]/20 hover:shadow-xl hover:shadow-[#002045]/30 active:scale-[0.98] transition-all duration-200 text-sm tracking-wide disabled:opacity-50 disabled:pointer-events-none"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Ingresando...
                  </span>
                ) : showSedeSelector ? (
                  "Continuar"
                ) : (
                  "Iniciar Sesión"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p
            className="text-xs font-bold text-[#43474e] uppercase tracking-[0.2em] opacity-60"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Vanguard Gestor de Préstamos
          </p>
          <div
            className="flex justify-center gap-4 mt-4 text-[11px] text-[#74777f] font-medium"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            <span>v1.0.0</span>
            <span>•</span>
            <span>© 2026 Vanguard USS</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
