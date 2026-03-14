import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function getRoleRedirect(role: string | null): string {
  switch (role) {
    case "doctor": return "/request";
    case "specialist": return "/specialist";
    default: return "/";
  }
}

export default function Login() {
  const { user, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (user) return <Navigate to={getRoleRedirect(role)} replace />;

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
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) setError(error.message);
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-background pt-24 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Digital Bin Card</CardTitle>
          <CardDescription>Klinik Kesihatan Kempas</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" onValueChange={() => setError(null)}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Log Masuk</TabsTrigger>
              <TabsTrigger value="signup">Daftar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Kata laluan</Label>
                  <Input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                </div>
                {error && (
                  <p id="login-error" role="alert" aria-live="polite" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={submitting} aria-describedby={error ? "login-error" : undefined}>
                  {submitting ? "Logging in…" : "Log Masuk"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nama Penuh</Label>
                  <Input id="signup-name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required autoComplete="name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Kata laluan</Label>
                  <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
                </div>
                {error && (
                  <p id="signup-error" role="alert" aria-live="polite" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={submitting} aria-describedby={error ? "signup-error" : undefined}>
                  {submitting ? "Mendaftar…" : "Daftar Akaun"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
