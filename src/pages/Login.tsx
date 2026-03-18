import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050d1a]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-blue-400" />
          <p className="text-sm text-white/40">Loading…</p>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) setError(error.message);
    setSubmitting(false);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) setError(error.message);
    setGoogleLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setForgotSent(true);
    }
    setForgotLoading(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pb-12"
      style={{ background: "linear-gradient(135deg, #050d1a 0%, #0d2040 45%, #1a3a6e 100%)" }}
    >
      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)", filter: "blur(60px)" }}
        />
        <div
          className="absolute top-1/2 -right-56 h-[600px] w-[600px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #2563eb 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        <div
          className="absolute -bottom-56 left-1/4 h-[500px] w-[500px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)", filter: "blur(70px)" }}
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-sm">

        {/* Logo + Title header */}
        <div className="mb-7 flex flex-col items-center gap-4">
          {/* Dual logos row */}
          <div className="flex items-center gap-5">
            {/* Anthropic logo — left */}
            <div className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-xl">
              <img
                src="https://www.anthropic.com/favicon.ico"
                alt="Anthropic"
                className="h-10 w-10 object-contain drop-shadow-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/60">Anthropic</span>
            </div>

            {/* Divider */}
            <div className="h-14 w-px bg-white/20" />

            {/* KKM logo — right */}
            <div className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-xl">
              <img
                src="https://ecentral.my/wp-content/uploads/2023/05/logo-kkm.png"
                alt="Kementerian Kesihatan Malaysia"
                className="h-14 w-14 object-contain drop-shadow-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-base font-bold uppercase tracking-widest text-white">
              Pharmacy Drug Monitoring System
            </h1>
            <p className="mt-1 text-xs tracking-wider text-white/45">
              Kementerian Kesihatan Malaysia
            </p>
          </div>
        </div>

        {/* Glass card */}
        <div
          className="rounded-2xl p-6 shadow-2xl"
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          {/* Forgot password mode */}
          {forgotMode && (
            <div className="space-y-4">
              {forgotSent ? (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                    <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-white/80">Reset link sent! Check your email.</p>
                  <Button
                    type="button"
                    className="w-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(""); }}
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="text-center">
                    <h2 className="text-sm font-semibold text-white">Reset Password</h2>
                    <p className="mt-1 text-xs text-white/50">Enter your email to receive a reset link</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs font-medium text-white/70">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="your@email.com"
                      className="border-white/20 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-400/50 focus-visible:border-blue-400/50"
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-red-300" role="alert" aria-live="polite">{error}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 text-white hover:bg-blue-500"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? "Sending…" : "Send Reset Link"}
                  </Button>
                  <Button
                    type="button"
                    className="w-full border border-white/20 bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() => { setForgotMode(false); setError(null); }}
                  >
                    Cancel
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Login / Signup tabs */}
          {!forgotMode && (
            <Tabs defaultValue="login" onValueChange={() => setError(null)}>
              <TabsList
                className="mb-5 grid w-full grid-cols-2 rounded-xl p-1"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <TabsTrigger
                  value="login"
                  className="rounded-lg text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Log In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-lg text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* Login tab */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-medium text-white/70">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="your@email.com"
                      className="border-white/20 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-400/50 focus-visible:border-blue-400/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-xs font-medium text-white/70">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="border-white/20 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-400/50 focus-visible:border-blue-400/50"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-white/45 underline underline-offset-2 hover:text-white/80 transition-colors"
                      onClick={() => { setForgotMode(true); setError(null); }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  {error && (
                    <p id="login-error" role="alert" aria-live="polite" className="text-xs text-red-300">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    disabled={submitting}
                    aria-describedby={error ? "login-error" : undefined}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Logging in…
                      </span>
                    ) : "Log In"}
                  </Button>

                  <div className="relative my-1 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/15" />
                    <span className="text-[10px] uppercase tracking-wider text-white/30">or</span>
                    <div className="h-px flex-1 bg-white/15" />
                  </div>

                  <Button
                    type="button"
                    className="w-full border border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white disabled:opacity-50"
                    disabled={googleLoading || submitting}
                    onClick={handleGoogleLogin}
                  >
                    {googleLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Processing…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                      </span>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup tab */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name" className="text-xs font-medium text-white/70">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="Nama penuh anda"
                      className="border-white/20 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-400/50 focus-visible:border-blue-400/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className="text-xs font-medium text-white/70">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="your@email.com"
                      className="border-white/20 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-400/50 focus-visible:border-blue-400/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password" className="text-xs font-medium text-white/70">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Minimum 6 characters"
                      className="border-white/20 bg-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-400/50 focus-visible:border-blue-400/50"
                    />
                  </div>
                  {error && (
                    <p id="signup-error" role="alert" aria-live="polite" className="text-xs text-red-300">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    disabled={submitting}
                    aria-describedby={error ? "signup-error" : undefined}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Creating account…
                      </span>
                    ) : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Bottom AI banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 py-2.5"
        style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
          ✦&nbsp;&nbsp;Powered by Anthropic Claude · World's Most Capable AI&nbsp;&nbsp;✦
        </p>
      </div>
    </div>
  );
}
