import { ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NoPermission() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldX className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Tiada Kebenaran</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Anda tidak mempunyai kebenaran untuk halaman ini.</p>
          <p>Hubungi jurufarmasit untuk diberikan peranan yang sesuai (doktor, pakar, atau jurufarmasit).</p>
        </CardContent>
      </Card>
    </div>
  );
}
