import type { Metadata } from "next";
import { ModulePage } from "@/features/home/components/module-page";

export const metadata: Metadata = {
  title: "Saved Posts",
  robots: { index: false },
};

export default function Page() {
  return <ModulePage module="saved" />;
}
