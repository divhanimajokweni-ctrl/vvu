import { SiteNav } from "@/components/vvu/site-nav";
import { Hero } from "@/components/vvu/hero";
import { ModelTable } from "@/components/vvu/model-table";
import { Simulator } from "@/components/vvu/simulator";
import { ShareModel } from "@/components/vvu/share-model";
import { PaymentRails } from "@/components/vvu/payment-rails";
import { ComputeLadder } from "@/components/vvu/compute-ladder";
import { Receipts } from "@/components/vvu/receipts";
import { SiteFooter } from "@/components/vvu/site-footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <ModelTable />
        <Simulator />
        <ShareModel />
        <PaymentRails />
        <ComputeLadder />
        <Receipts />
      </main>
      <SiteFooter />
    </div>
  );
}
