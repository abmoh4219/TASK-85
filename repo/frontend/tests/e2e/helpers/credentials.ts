/**
 * Canonical seeded users. Override via env vars if the seed data changes.
 */
export interface Credential {
  role: 'admin' | 'supervisor' | 'hr' | 'employee';
  username: string;
  password: string;
  /** The heading text the dashboard displays for this role. */
  dashboardHeading: RegExp;
}

const PASSWORD = process.env.E2E_PASSWORD ?? 'meridian2024';

export const CREDENTIALS: Record<Credential['role'], Credential> = {
  admin: {
    role: 'admin',
    username: process.env.E2E_ADMIN_USER ?? 'admin',
    password: PASSWORD,
    dashboardHeading: /administrator overview/i,
  },
  supervisor: {
    role: 'supervisor',
    username: process.env.E2E_SUPERVISOR_USER ?? 'supervisor',
    password: PASSWORD,
    dashboardHeading: /supervisor dashboard/i,
  },
  hr: {
    role: 'hr',
    username: process.env.E2E_HR_USER ?? 'hr',
    password: PASSWORD,
    dashboardHeading: /hr dashboard/i,
  },
  employee: {
    role: 'employee',
    username: process.env.E2E_EMPLOYEE_USER ?? 'employee',
    password: PASSWORD,
    dashboardHeading: /my workspace/i,
  },
};

export const ALL_ROLES: Credential[] = [
  CREDENTIALS.admin,
  CREDENTIALS.supervisor,
  CREDENTIALS.hr,
  CREDENTIALS.employee,
];
