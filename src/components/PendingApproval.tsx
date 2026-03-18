// src/components/PendingApproval.tsx
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PendingApproval() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-start justify-center bg-background pt-24 px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-xl">Akaun Dalam Proses Kelulusan</CardTitle>
          <CardDescription>Digital Bin Card — Klinik Kesihatan Kempas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Akaun anda telah didaftarkan. Sila hubungi pentadbir sistem untuk
            mendapatkan akses. Anda akan dapat log masuk setelah peranan ditetapkan.
          </p>
          <Button variant="outline" className="w-full" onClick={signOut}>
            Log Keluar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
