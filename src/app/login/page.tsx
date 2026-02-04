"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./login.css";
import { LogoMark } from "../ui-kit/icons";

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Входим...");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      let payload: { error?: string; role?: string } = {};
      try {
        payload = (await response.json()) as { error?: string; role?: string };
      } catch {
        payload = {};
      }
      if (!response.ok) {
        setStatus(payload.error ?? "Не удалось войти.");
        return;
      }
      setStatus("Успешный вход.");
      if (payload.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/presentations");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось войти.");
    }
  }

  return (
    <main className="login-shell">
      <div className="login-panel">
        <LogoMark className="login-logo" />
        <h1 className="login-title">Вход</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-field">
            <span className="login-field-label">Почта:</span>
            <input
              type="email"
              placeholder="example@mail.com"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
              required
            />
          </label>
          <label className="login-field">
            <span className="login-field-label">Пароль:</span>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete="current-password"
              required
            />
            <button
              className="login-eye"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </label>
          <a className="login-link" href="#">
            Забыли пароль?
          </a>
          <button className="login-button" type="submit">
            Войти
          </button>
          {status ? <div className="login-status">{status}</div> : null}
        </form>
      </div>
    </main>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M6.2 6.2C3.7 8 2 12 2 12s4 6 10 6c2.1 0 4-0.7 5.6-1.7" />
      <path d="M9.5 5.1A10.7 10.7 0 0 1 12 6c6 0 10 6 10 6s-1.1 1.7-3.1 3.4" />
    </svg>
  );
}
