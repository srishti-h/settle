import { notFound } from "next/navigation";
import invoices from "@/data/invoices.json";
import Workbench from "./workbench";

export function generateStaticParams() {
  return invoices.map(i => ({ id: i.id }));
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = invoices.find(i => i.id === id);
  if (!inv) notFound();
  return <Workbench id={inv.id} />;
}
