import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UploadMingguan() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Upload Mingguan</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Muat Naik Fail Mingguan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-16">
            <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-1 text-sm font-medium text-foreground">
              Seret & lepas fail di sini
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              Format: .xlsx, .csv — Maksimum 5MB
            </p>
            <Button variant="outline">Pilih Fail</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
