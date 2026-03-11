import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, XCircle, Activity } from "lucide-react";

const stats = [
  { label: "Jumlah Ubat", value: "—", icon: Package, color: "text-accent" },
  { label: "Stok Rendah", value: "—", icon: AlertTriangle, color: "text-warning" },
  { label: "Kehabisan Stok", value: "—", icon: XCircle, color: "text-destructive" },
  { label: "Aktiviti Terkini", value: "—", icon: Activity, color: "text-muted-foreground" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Ringkasan Stok</CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Tiada data lagi.</p>
        </CardContent>
      </Card>
    </div>
  );
}
