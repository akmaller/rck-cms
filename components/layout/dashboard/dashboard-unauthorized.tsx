import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DashboardUnauthorizedProps = {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
};

export function DashboardUnauthorized({
  title = "Akses dibatasi",
  description = "Anda tidak memiliki izin untuk membuka halaman ini.",
  backHref = "/dashboard",
  backLabel = "Kembali ke dasbor",
}: DashboardUnauthorizedProps) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center py-16">
      <Card className="max-w-md text-center">
        <CardHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
