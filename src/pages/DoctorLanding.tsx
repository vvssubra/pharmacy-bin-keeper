import { useNavigate } from "react-router-dom";
import { Pill, ShieldPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const services = [
  {
    icon: Pill,
    title: "Permintaan Ubat Kawalan",
    description: "Borang pengeluaran ubat terkawal yang memerlukan kelulusan farmasis",
    badge: "Perlu Kelulusan Farmasis",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-300",
    to: "/request/ubat",
  },
  {
    icon: ShieldPlus,
    title: "Borang Antibiotik",
    description: "Borang semakan klinikal antibiotik berdasarkan Clinical Pathway NAG 2024",
    badge: "Perlu Kelulusan Pakar",
    badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-300",
    to: "/request/antibiotik",
  },
];

export default function DoctorLanding() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-[700px] space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Pilih Jenis Permohonan</h1>
          <p className="text-sm text-muted-foreground">Pilih borang yang sesuai dengan keperluan pesakit</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <Card
              key={s.to}
              className="cursor-pointer transition-all hover:border-[#1A3C6E] hover:shadow-md group"
              onClick={() => navigate(s.to)}
            >
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="rounded-xl bg-muted p-4">
                  <s.icon className="h-8 w-8" style={{ color: "#1A3C6E" }} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </div>
                <Badge variant="outline" className={s.badgeClass}>{s.badge}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
