export const identityHrRoutes = [
  {
    label: "บัญชีผู้ใช้",
    href: "/accounts",
    capability: "accounts:read",
    group: "จัดการบุคลากร",
  },
  {
    label: "โครงสร้างองค์กร",
    href: "/organization",
    capability: "organization:read",
    group: "จัดการบุคลากร",
  },
  {
    label: "ทะเบียนพนักงาน",
    href: "/employees",
    capability: "employees:read",
    group: "จัดการบุคลากร",
  },
] as const;
export type IdentityHrRoute = (typeof identityHrRoutes)[number];
