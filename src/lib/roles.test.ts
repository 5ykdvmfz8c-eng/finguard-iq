import { describe, expect, it } from "vitest";
import { can } from "./roles";
describe("role permissions", () => {
  it("auditors are read-only", () => { expect(can.record("auditor")).toBe(false); expect(can.triage("auditor")).toBe(false); expect(can.viewAll("auditor")).toBe(true); });
  it("employees can record but not see all or triage", () => { expect(can.record("employee")).toBe(true); expect(can.viewAll("employee")).toBe(false); expect(can.triage("employee")).toBe(false); });
  it("only administrators manage the team", () => { expect(can.manageTeam("admin")).toBe(true); expect(can.manageTeam("financial_manager")).toBe(false); });
});
