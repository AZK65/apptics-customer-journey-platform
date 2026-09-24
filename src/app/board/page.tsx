import { getCustomers } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { FadeInUp } from "@/components/motion-wrappers";
import { JourneySankey } from "@/components/journey-sankey";

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
        <FadeInUp>
          <JourneySankey customers={customers} />
        </FadeInUp>
      </div>
    </div>
  );
}
