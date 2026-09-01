import type { ScenarioDefinition } from "./types";

export const scenarios = [
  {
    id: "luxury-shoestring",
    title: "80 Guests, Luxury Taste, Tiny Budget",
    setup:
      "A weekend celebration wants a premium hotel experience, dinner, ceremony setup, and a room block while staying under a tight cap.",
    clientMessage:
      "We want it to feel exclusive, elegant, and completely effortless. Also, the budget is very much not moving.",
    choices: [
      {
        id: "premium-perception",
        label: "Sell premium perception",
        response:
          "Lead with a premium dinner flow, signature welcome moment, and optimized room block while keeping luxury items optional.",
        tone: "professional",
        outcome: "great",
        delta: { budget: 7, timeline: -6, trust: 8, morale: 6, quality: 9, scope: 5 },
      },
      {
        id: "full-luxury",
        label: "Pitch full luxury",
        response:
          "Quote the luxury version first and hope the client falls in love before noticing the number.",
        tone: "risky",
        outcome: "bad",
        delta: { budget: -14, timeline: -3, trust: -9, morale: 7, quality: 15, scope: -11 },
      },
      {
        id: "strip-it-down",
        label: "Cut the experience",
        response:
          "Remove the memorable touches and protect the budget with a basic banquet package.",
        tone: "direct",
        outcome: "okay",
        delta: { budget: 12, timeline: 8, trust: -4, morale: -5, quality: -5, scope: 9 },
      },
    ],
  },
  {
    id: "conference-hard-cap",
    title: "Conference, Dinner, Rooms, Hard Cap",
    setup:
      "A scaleup needs a conference day, dinner, AV, and 42 rooms. HR wants polish; procurement wants receipts.",
    clientMessage:
      "Can you make this feel senior-leadership level but still pass procurement without a dramatic call?",
    choices: [
      {
        id: "tiered-proposal",
        label: "Create tiered options",
        response:
          "Present good, better, and recommended versions with clear tradeoffs and a procurement-safe anchor.",
        tone: "professional",
        outcome: "great",
        delta: { budget: 7, timeline: -7, trust: 10, morale: 6, quality: 9, scope: 8 },
      },
      {
        id: "hide-costs",
        label: "Hide the tradeoffs",
        response:
          "Bundle everything into one impressive number and avoid calling out where the budget is tight.",
        tone: "risky",
        outcome: "bad",
        delta: { budget: -13, timeline: -4, trust: -15, morale: 6, quality: 14, scope: -10 },
      },
      {
        id: "procurement-only",
        label: "Optimize only for cost",
        response:
          "Build the leanest compliant offer and let the experience feel like a spreadsheet victory.",
        tone: "direct",
        outcome: "okay",
        delta: { budget: 13, timeline: 9, trust: 4, morale: -6, quality: -5, scope: 8 },
      },
    ],
  },
  {
    id: "surprise-guests",
    title: "Surprise Extra Guests",
    setup:
      "The client casually increases guest count after seeing the first proposal, but still expects the same mood and budget.",
    clientMessage:
      "Small update: it is probably 115 guests instead of 80. That should not change much, right?",
    choices: [
      {
        id: "change-order",
        label: "Issue a clean revision",
        response:
          "Create a revised proposal version with guest-count assumptions, added costs, and protected inclusions.",
        tone: "risky",
        outcome: "great",
        delta: { budget: 9, timeline: -7, trust: 10, morale: -4, quality: 7, scope: 11 },
      },
      {
        id: "absorb-guests",
        label: "Absorb the increase",
        response:
          "Keep the price flat and quietly reduce service levels to make the numbers work.",
        tone: "professional",
        outcome: "bad",
        delta: { budget: 15, timeline: 4, trust: -10, morale: -12, quality: -13, scope: -15 },
      },
      {
        id: "hard-reset",
        label: "Restart qualification",
        response:
          "Pause the deal and require a full new intake before discussing options.",
        tone: "direct",
        outcome: "okay",
        delta: { budget: 12, timeline: -5, trust: -4, morale: 3, quality: 6, scope: 10 },
      },
    ],
  },
  {
    id: "budget-cut",
    title: "Last-Minute Budget Cut",
    setup:
      "The client likes the proposal, then procurement cuts the available budget by 12 percent before approval.",
    clientMessage:
      "Everyone is aligned, except finance. Can you make it cheaper without making it feel cheaper?",
    choices: [
      {
        id: "scope-swap",
        label: "Offer a scope swap",
        response:
          "Preserve the premium moments by swapping lower-impact inclusions out instead of discounting the whole event.",
        tone: "professional",
        outcome: "great",
        delta: { budget: 8, timeline: -9, trust: 9, morale: 7, quality: 8, scope: 9 },
      },
      {
        id: "discount-everything",
        label: "Discount everything",
        response:
          "Reduce the package price without changing expectations, hoping margin can survive the applause.",
        tone: "risky",
        outcome: "bad",
        delta: { budget: 14, timeline: 6, trust: -8, morale: -12, quality: -10, scope: -15 },
      },
      {
        id: "remove-wow",
        label: "Remove the wow",
        response:
          "Cut the high-visibility experience layer first and keep the operational basics intact.",
        tone: "direct",
        outcome: "okay",
        delta: { budget: 12, timeline: 8, trust: 3, morale: -7, quality: -6, scope: 9 },
      },
    ],
  },
  {
    id: "vip-joins",
    title: "VIP Joins the Room",
    setup:
      "A simple leadership dinner suddenly includes the global CEO, who expects privacy, polish, and zero friction.",
    clientMessage:
      "Tiny executive update: the CEO is joining. Can we make the whole thing feel board-level by tomorrow?",
    choices: [
      {
        id: "vip-addendum",
        label: "Add VIP package",
        response:
          "Create a premium addendum for suite handling, arrival flow, private dining, and dedicated on-site ownership.",
        tone: "direct",
        outcome: "great",
        delta: { budget: -10, timeline: -8, trust: 11, morale: 8, quality: 12, scope: 10 },
      },
      {
        id: "same-package",
        label: "Keep same package",
        response:
          "Tell the client the current proposal should be fine with a few informal adjustments.",
        tone: "professional",
        outcome: "bad",
        delta: { budget: 10, timeline: 7, trust: -8, morale: -6, quality: -9, scope: -7 },
      },
      {
        id: "overbuild",
        label: "Overbuild the offer",
        response:
          "Upgrade every line item to luxury and send a dramatic new total.",
        tone: "risky",
        outcome: "okay",
        delta: { budget: -11, timeline: -7, trust: 3, morale: 9, quality: 15, scope: -10 },
      },
    ],
  },
  {
    id: "final-approval",
    title: "Final Proposal, Final Chaos",
    setup:
      "One last chance to send the winning proposal into Proposales before the client changes their mind again.",
    clientMessage:
      "Looks good. Before we sign, can you just include the latest notes, the VIP thing, and maybe make it pop?",
    choices: [
      {
        id: "versioned-close",
        label: "Version and close",
        response:
          "Create a final proposal version with assumptions, accepted changes, pricing, and a clean signature path.",
        tone: "professional",
        outcome: "great",
        delta: { budget: 8, timeline: 9, trust: 10, morale: -7, quality: 9, scope: 10 },
      },
      {
        id: "keep-editing",
        label: "Keep editing live",
        response:
          "Continue changing the proposal in real time while the client invents new details.",
        tone: "risky",
        outcome: "bad",
        delta: { budget: 5, timeline: 12, trust: -8, morale: 6, quality: -9, scope: -14 },
      },
      {
        id: "freeze-everything",
        label: "Freeze the deal",
        response:
          "Refuse all changes and send the old version exactly as approved.",
        tone: "direct",
        outcome: "okay",
        delta: { budget: 11, timeline: 10, trust: -5, morale: -4, quality: 4, scope: 9 },
      },
    ],
  },
  {
    id: "allergy-list",
    title: "The Allergy List Arrives Late",
    setup:
      "Dinner service starts tomorrow. The client sends a spreadsheet with severe allergies, preference notes, and no clear owner.",
    clientMessage:
      "We found twelve dietary notes in three email threads. You have this under control, yes?",
    choices: [
      {
        id: "verbal-reassurance",
        label: "Promise it is handled",
        response:
          "Reply immediately with reassurance, then ask each department to interpret the spreadsheet independently before service.",
        tone: "professional",
        outcome: "okay",
        delta: { budget: 5, timeline: 9, trust: 4, morale: 6, quality: -7, scope: -6 },
      },
      {
        id: "dietary-matrix",
        label: "Build one service matrix",
        response:
          "Turn every dietary note into a named guest, meal, owner, kitchen confirmation, and final client sign-off before the menu locks.",
        tone: "risky",
        outcome: "great",
        delta: { budget: -7, timeline: -10, trust: 13, morale: 8, quality: 14, scope: 9 },
      },
      {
        id: "standard-menu-only",
        label: "Enforce the standard menu",
        response:
          "Reject late dietary changes, serve the existing menu, and place responsibility for exceptions back on the client.",
        tone: "direct",
        outcome: "bad",
        delta: { budget: 16, timeline: 11, trust: -14, morale: -13, quality: -8, scope: 10 },
      },
    ],
  },
  {
    id: "signature-delay",
    title: "Signature Deadline Slips Again",
    setup:
      "The date is being held without a deposit. A competing inquiry wants the same ballroom while the client asks for one more review.",
    clientMessage:
      "Legal needs another day. Please keep everything reserved and unchanged until we are comfortable.",
    choices: [
      {
        id: "hold-indefinitely",
        label: "Keep the hold open",
        response:
          "Protect the relationship by extending the venue hold with no deposit, deadline, or change to commercial terms.",
        tone: "professional",
        outcome: "bad",
        delta: { budget: -13, timeline: -12, trust: 6, morale: 8, quality: 4, scope: -15 },
      },
      {
        id: "pressure-discount",
        label: "Offer a signing discount",
        response:
          "Add a short-lived discount to create urgency, even though the delay is legal approval rather than price resistance.",
        tone: "risky",
        outcome: "okay",
        delta: { budget: -5, timeline: 15, trust: -4, morale: 7, quality: 3, scope: 5 },
      },
      {
        id: "controlled-deadline",
        label: "Set a controlled deadline",
        response:
          "Issue a final version with a clear hold expiry, deposit condition, and one named route for legal comments before release.",
        tone: "direct",
        outcome: "great",
        delta: { budget: 10, timeline: 11, trust: 9, morale: -6, quality: 8, scope: 13 },
      },
    ],
  },
] as const satisfies readonly ScenarioDefinition[];
