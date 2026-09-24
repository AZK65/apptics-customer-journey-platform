import { getCustomers } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { FadeIn } from "@/components/motion-wrappers";
import { CustomersTable } from "@/components/customers-table";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await getCustomers();
  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} people tracked end-to-end across every touchpoint.`}
      />
      <div className="p-6">
        <FadeIn>
          <CustomersTable customers={customers} />
        </FadeIn>
      </div>
    </div>
  );
}
