export const identityHrRoutes = [
  {
    label: "บัญชีผู้ใช้",
    href: "/accounts",
    roles: ["OWNER", "HR"],
    group: "จัดการบุคลากร",
  },
  {
    label: "โครงสร้างองค์กร",
    href: "/organization",
    roles: ["OWNER", "HR"],
    group: "จัดการบุคลากร",
  },
  {
    label: "ทะเบียนพนักงาน",
    href: "/employees",
    roles: ["EMPLOYEE", "SUPERVISOR", "BRANCH_MANAGER", "HR", "OWNER"],
    group: "จัดการบุคลากร",
  },
] as const;
export type IdentityHrRoute = (typeof identityHrRoutes)[number];
