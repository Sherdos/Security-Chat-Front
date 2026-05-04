import { useAuthSlice } from "../store/chatSelectors";

type AuthViewProps = {
  apiBase: string;
  handleAuthSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function AuthView({ apiBase, handleAuthSubmit }: AuthViewProps) {
  const {
    authMode,
    username,
    email,
    password,
    error,
    setAuthMode,
    setUsername,
    setEmail,
    setPassword,
  } = useAuthSlice();

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-tg-bg-main px-4 py-10">
      <div suppressHydrationWarning className="w-full max-w-sm rounded-2xl bg-tg-panel p-8 shadow-2xl shadow-black/40 ring-1 ring-white/5">
        <div suppressHydrationWarning className="mb-6 flex flex-col items-center">
          <div suppressHydrationWarning className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-tg-accent to-[#5eead4] text-3xl font-bold text-white shadow-lg shadow-tg-accent/30">
            OC
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Online Secure Chat
          </h1>
          <p className="mt-1 text-xs text-tg-text-muted">
            {authMode === "login" ? "Sign in to continue" : "Create an account"}
          </p>
        </div>

        <div suppressHydrationWarning className="mb-5 flex rounded-full bg-tg-bg p-1">
          <button
            type="button"
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              authMode === "login"
                ? "bg-tg-accent text-white shadow"
                : "text-tg-text-secondary hover:text-tg-text"
            }`}
            onClick={() => setAuthMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              authMode === "register"
                ? "bg-tg-accent text-white shadow"
                : "text-tg-text-secondary hover:text-tg-text"
            }`}
            onClick={() => setAuthMode("register")}
          >
            Register
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleAuthSubmit}>
          <input
            className="w-full rounded-xl border border-tg-border bg-tg-bg px-4 py-3 text-sm placeholder:text-tg-text-muted focus:border-tg-accent"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          {authMode === "register" && (
            <input
              className="w-full rounded-xl border border-tg-border bg-tg-bg px-4 py-3 text-sm placeholder:text-tg-text-muted focus:border-tg-accent"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          )}
          <input
            className="w-full rounded-xl border border-tg-border bg-tg-bg px-4 py-3 text-sm placeholder:text-tg-text-muted focus:border-tg-accent"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            className="w-full rounded-xl bg-tg-accent px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-tg-accent-hover"
            type="submit"
          >
            {authMode === "login" ? "Login" : "Create account"}
          </button>
          {error && (
            <p className="rounded-lg bg-tg-danger/10 px-3 py-2 text-center text-sm text-tg-danger">
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-[11px] text-tg-text-muted">
          Backend · {apiBase}
        </p>
      </div>
    </main>
  );
}
