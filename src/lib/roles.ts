export type OrgRole = "admin" | "financial_manager" | "auditor" | "employee";
export const ROLE_LABEL: Record<OrgRole, string> = {
  admin: "Administrator", financial_manager: "Financial Manager", auditor: "Auditor", employee: "Employee",
};
export const can = {
  record: (r?: OrgRole) => r === "admin" || r === "financial_manager" || r === "employee",
  viewAll: (r?: OrgRole) => r === "admin" || r === "financial_manager" || r === "auditor",
  triage: (r?: OrgRole) => r === "admin" || r === "financial_manager",
  manageTeam: (r?: OrgRole) => r === "admin",
};
