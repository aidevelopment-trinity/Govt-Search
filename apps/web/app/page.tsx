import { GovContractsShell } from "@/components/gov-contracts-shell";
import { getProcurementSources } from "@/lib/gov-contracts";

export default async function Page() {
  const sources = await getProcurementSources();

  return <GovContractsShell sources={sources} />;
}
