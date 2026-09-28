import { AppHeader, AppPage } from "@/components/app/page-header";
import { MarketplaceGrid } from "./marketplace-grid";

export const metadata = { title: "Marketplace" };

export default function MarketplacePage() {
  return (
    <AppPage wide>
      <AppHeader body="Add a Bot built for a job. It arrives with its description, skills, and routines (paused until you turn them on)." title="Marketplace" />
      <MarketplaceGrid />
    </AppPage>
  );
}
