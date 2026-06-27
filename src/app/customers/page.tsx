import { getCustomers } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { CustomersTable } from "@/components/customers-table";

// Render per-request so live CRM data is always fresh.
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
        <CustomersTable customers={customers} />
      </div>
    </div>
  );
}
