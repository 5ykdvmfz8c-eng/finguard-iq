import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "FINANCIAL IQ — Fraud Detection & Prevention" },
      { name: "description", content: "Detect duplicate payments, split payments and suspicious transactions." },
      { property: "og:title", content: "FINANCIAL IQ" },
      { property: "og:description", content: "Detect duplicate payments, split payments and suspicious transactions." },
    ],
  }),
});
