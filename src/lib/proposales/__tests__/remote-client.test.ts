import { describe, expect, it } from "vitest";

import { mapFinalWinningProposalToApiPayload } from "../api-payload";

describe("Proposales v3 payload", () => {
  it("maps a winning run to an official draft proposal shape", () => {
    const payload = mapFinalWinningProposalToApiPayload(
      {
        title: "Client From Hell - S Rank",
        client: { name: "Demo Client", email: "demo@example.com", company: "Hotel Demo" },
        projectSummary: "A difficult event negotiation.",
        scope: ["Protect budget", "Add VIP rooms"],
        lineItems: [
          { name: "Event package", quantity: 1, total: { amount: 25000, currency: "EUR" } },
        ],
        total: { amount: 25000, currency: "EUR" },
        sourceProposalId: "cfh-test-run",
        metadata: { rank: "S", totalScore: 92 },
      },
      { companyId: 5448, language: "en" },
    );

    expect(payload).toMatchObject({
      company_id: 5448,
      language: "en",
      title_md: "Client From Hell - S Rank",
      recipient: {
        first_name: "Demo",
        last_name: "Client",
        email: "demo@example.com",
        company_name: "Hotel Demo",
      },
      data: {
        source: "client-from-hell",
        source_proposal_id: "cfh-test-run",
        rank: "S",
        totalScore: 92,
      },
      invoicing_enabled: false,
    });
    expect(payload.description_md).toContain("25,000 EUR");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("line_items");
  });

  it("omits fictional recipients without an email", () => {
    const payload = mapFinalWinningProposalToApiPayload(
      {
        title: "Demo",
        client: { name: "Fictional Client", company: "Demo Hotel" },
        projectSummary: "Game result",
        scope: ["One move"],
      },
      { companyId: 5448, language: "en" },
    );

    expect(payload).not.toHaveProperty("recipient");
  });
});
