import type { ProposalesConfig } from "./config";
import type { FinalWinningProposalInput } from "./types";

export function mapFinalWinningProposalToApiPayload(
  input: FinalWinningProposalInput,
  config: Pick<ProposalesConfig, "companyId" | "language">,
) {
  const lineItems = input.lineItems ?? [];
  const scope = input.scope.map((item) => `- ${item}`).join("\n");
  const pricing = lineItems.length
    ? lineItems
        .map((item) => {
          const amount = item.total ?? item.unitPrice;
          const quantity = item.quantity ? `${item.quantity} x ` : "";
          return `- ${item.name}: ${quantity}${amount ? formatMoney(amount.amount, amount.currency) : "Included"}`;
        })
        .join("\n")
    : "- Final package configured in game";
  const total = input.total
    ? `\n\n*Total:* ${formatMoney(input.total.amount, input.total.currency)}`
    : "";
  const [firstName, ...lastNameParts] = input.client.name.trim().split(/\s+/);
  const recipient = input.client.email
    ? {
        recipient: {
          first_name: firstName,
          ...(lastNameParts.length ? { last_name: lastNameParts.join(" ") } : {}),
          email: input.client.email,
          ...(input.client.company ? { company_name: input.client.company } : {}),
        },
      }
    : {};

  return {
    company_id: config.companyId,
    language: config.language,
    title_md: input.title,
    description_md: [
      "# Winning proposal",
      input.projectSummary,
      "*Selected negotiation moves*",
      scope,
      "*Package estimate*",
      `${pricing}${total}`,
    ].join("\n\n"),
    ...recipient,
    data: {
      source: "client-from-hell",
      ...(input.sourceProposalId ? { source_proposal_id: input.sourceProposalId } : {}),
      ...(input.acceptedBy ? { game_winner: input.acceptedBy } : {}),
      ...(input.acceptedAt ? { completed_at: input.acceptedAt } : {}),
      ...input.metadata,
    },
    invoicing_enabled: false,
  };
}

function formatMoney(amount: number, currency: string): string {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(amount)} ${currency.toUpperCase()}`;
}
