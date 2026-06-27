import { getCustomers } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { JourneySankey } from "@/components/journey-sankey";

// Render per-request so live CRM data is always fresh.
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const customers = await getCustomers();

  return (
    <div>
      <PageHeader
        title="Journey Flow"
        subtitle="How every lead flows through the pipeline — and where they drop off. Click a stage to drill in."
      />

      <div className="p-6">
        <JourneySankey customers={customers} />
      </div>
    </div>
  );
}
