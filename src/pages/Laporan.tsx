import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function Laporan() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Laporan</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Penapis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">Dari</Label>
              <Input id="from" type="date" className="w-40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Hingga</Label>
              <Input id="to" type="date" className="w-40" />
            </div>
            <Button>Jana Laporan</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Keputusan</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Ubat</TableHead>
                <TableHead>Baki Awal</TableHead>
                <TableHead>Terima</TableHead>
                <TableHead>Keluaran</TableHead>
                <TableHead>Baki Akhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="mb-2 h-8 w-8" />
                    <p className="text-sm">Sila tetapkan tarikh dan klik &apos;Jana Laporan&apos;.</p>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
