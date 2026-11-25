import { queryOptions } from "@tanstack/react-query";
import { getFinanceWorkspace, getLuxsoWorkspace, getStaffContext, getStaffMembers } from "@/lib/staff.functions";

export const staffContextQuery = () => queryOptions({ queryKey: ["staff-context"], queryFn: () => getStaffContext() });
export const financeWorkspaceQuery = () => queryOptions({ queryKey: ["finance-workspace"], queryFn: () => getFinanceWorkspace() });
export const luxsoWorkspaceQuery = () => queryOptions({ queryKey: ["luxso-workspace"], queryFn: () => getLuxsoWorkspace() });
export const staffMembersQuery = () => queryOptions({ queryKey: ["staff-members"], queryFn: () => getStaffMembers() });
