/**
 * Single source of truth for sidebar navigation and menu search.
 * Keep paths aligned with Angular routes and RBAC with route guards.
 */

export type SidebarGroupKey = 'loads' | 'financial' | 'compliance' | 'admin';

export interface SidebarNavLeaf {
  id: string;
  label: string;
  routerLink: string;
  iconClass: string;
  /** If omitted, visible to any authenticated user. */
  rolesAny?: string[];
  exact?: boolean;
  /** Extra tokens for menu search (any case; normalized when matching). */
  keywords?: string[];
}

export interface SidebarNavGroup {
  kind: 'group';
  id: string;
  label: string;
  routerLink: string;
  iconClass: string;
  rolesAny: string[];
  exact?: boolean;
  groupKey: SidebarGroupKey;
  children: SidebarNavLeaf[];
  keywords?: string[];
}

export interface SidebarNavLinkBlock {
  kind: 'link';
  link: SidebarNavLeaf;
}

export interface SidebarNavDivider {
  kind: 'divider';
  rolesAny?: string[];
}

export type SidebarNavBlock = SidebarNavLinkBlock | SidebarNavGroup | SidebarNavDivider;

export const SIDEBAR_NAV: SidebarNavBlock[] = [
  {
    kind: 'link',
    link: {
      id: 'dashboard',
      label: 'Dashboard',
      routerLink: '/dashboard',
      iconClass: 'fas fa-home',
      exact: true,
      keywords: ['home', 'overview'],
    },
  },
  {
    kind: 'link',
    link: {
      id: 'driver-my-profile',
      label: 'My Profile',
      routerLink: '/drivers/my-profile',
      iconClass: 'fas fa-user',
      rolesAny: ['Driver'],
      keywords: ['account', 'me'],
    },
  },
  {
    kind: 'link',
    link: {
      id: 'driver-my-referrals',
      label: 'My Referrals',
      routerLink: '/drivers/my-referrals',
      iconClass: 'fas fa-users',
      rolesAny: ['Driver'],
      keywords: ['referral', 'recruit'],
    },
  },
  {
    kind: 'link',
    link: {
      id: 'driver-my-loads',
      label: 'My Loads',
      routerLink: '/loads',
      iconClass: 'fas fa-boxes',
      rolesAny: ['Driver'],
      keywords: ['loads', 'freight', 'dispatch', 'shipments'],
    },
  },
  {
    kind: 'link',
    link: {
      id: 'driver-my-vehicles',
      label: 'My Vehicles',
      routerLink: '/drivers/my-vehicles',
      iconClass: 'fas fa-truck',
      rolesAny: ['Driver'],
      keywords: ['truck', 'tractor', 'equipment'],
    },
  },
  {
    kind: 'link',
    link: {
      id: 'driver-my-incidents',
      label: 'My Incidents',
      routerLink: '/drivers/my-incidents',
      iconClass: 'fas fa-exclamation-circle',
      rolesAny: ['Driver'],
      keywords: ['safety', 'accident', 'compliance'],
    },
  },
  {
    kind: 'group',
    id: 'dispatch',
    label: 'Dispatch',
    routerLink: '/loads',
    iconClass: 'fas fa-boxes',
    rolesAny: ['Admin', 'Dispatcher', 'FleetManager'],
    exact: false,
    groupKey: 'loads',
    keywords: ['loads', 'freight', 'operations', 'shipments'],
    children: [
      {
        id: 'all-loads',
        label: 'All Loads',
        routerLink: '/loads',
        iconClass: 'fas fa-list',
        exact: true,
        keywords: ['loads', 'list', 'freight'],
      },
      {
        id: 'accessorial-types',
        label: 'Accessorial Types',
        routerLink: '/loads/accessorial-types',
        iconClass: 'fas fa-tags',
        rolesAny: ['Admin'],
        keywords: ['accessorials', 'extras', 'charges', 'fees'],
      },
    ],
  },
  {
    kind: 'link',
    link: {
      id: 'owner-operators',
      label: 'Owner Operators',
      routerLink: '/drivers',
      iconClass: 'fas fa-users',
      rolesAny: ['Admin', 'Dispatcher', 'FleetManager'],
      exact: true,
      keywords: ['drivers', 'oo', 'operators', 'fleet'],
    },
  },
  {
    kind: 'link',
    link: {
      id: 'inactive-owner-operators',
      label: 'Inactive Owner Operators',
      routerLink: '/drivers/inactive',
      iconClass: 'fas fa-user-slash',
      rolesAny: ['Admin', 'FleetManager'],
      keywords: ['inactive', 'terminated', 'disabled'],
    },
  },
  {
    kind: 'link',
    link: {
      id: 'brokers',
      label: 'Brokers',
      routerLink: '/customers',
      iconClass: 'fas fa-building',
      rolesAny: ['Admin', 'Dispatcher', 'Accountant'],
      exact: false,
      keywords: ['customers', 'brokers', 'shippers', 'carriers', 'accounts'],
    },
  },
  {
    kind: 'link',
    link: {
      id: 'equipment',
      label: 'Equipment',
      routerLink: '/equipment',
      iconClass: 'fas fa-truck',
      rolesAny: ['Admin', 'FleetManager'],
      keywords: ['trailers', 'assets', 'tractors'],
    },
  },
  {
    kind: 'group',
    id: 'financial',
    label: 'Financial',
    routerLink: '/financial',
    iconClass: 'fas fa-dollar-sign',
    rolesAny: ['Admin', 'Accountant'],
    exact: false,
    groupKey: 'financial',
    keywords: ['billing', 'accounting', 'money', 'finance'],
    children: [
      {
        id: 'financial-invoices',
        label: 'Invoices',
        routerLink: '/financial/invoices',
        iconClass: 'fas fa-file-invoice',
        exact: false,
        keywords: ['invoice', 'billing'],
      },
      {
        id: 'financial-settlements',
        label: 'Settlements',
        routerLink: '/financial/settlements',
        iconClass: 'fas fa-money-check-alt',
        exact: false,
        keywords: ['settlement', 'pay'],
      },
      {
        id: 'financial-payments',
        label: 'All Payments',
        routerLink: '/financial/payments',
        iconClass: 'fas fa-money-bill-wave',
        exact: false,
        keywords: ['payment', 'paid'],
      },
      {
        id: 'financial-ap',
        label: 'Accounts Payable',
        routerLink: '/financial/accounts-payable',
        iconClass: 'fas fa-file-invoice-dollar',
        exact: false,
        keywords: ['ap', 'payable', 'vendors'],
      },
      {
        id: 'financial-ar',
        label: 'Accounts Receivable',
        routerLink: '/financial/accounts-receivable',
        iconClass: 'fas fa-receipt',
        exact: false,
        keywords: ['ar', 'receivable', 'receivables'],
      },
      {
        id: 'financial-reports',
        label: 'Reports',
        routerLink: '/financial/reports',
        iconClass: 'fas fa-chart-line',
        exact: false,
        keywords: ['financial reports', 'pnl', 'analytics'],
      },
    ],
  },
  {
    kind: 'link',
    link: {
      id: 'payroll',
      label: 'Payroll',
      routerLink: '/payroll',
      iconClass: 'fas fa-money-check',
      rolesAny: ['Admin', 'Accountant'],
      exact: false,
      keywords: ['wages', 'pay', 'checks'],
    },
  },
  {
    kind: 'group',
    id: 'compliance',
    label: 'Compliance',
    routerLink: '/compliance',
    iconClass: 'fas fa-shield-alt',
    rolesAny: ['Admin', 'FleetManager'],
    exact: false,
    groupKey: 'compliance',
    keywords: ['safety', 'dot', 'regulations'],
    children: [
      {
        id: 'compliance-dashboard',
        label: 'Dashboard',
        routerLink: '/compliance/dashboard',
        iconClass: 'fas fa-chart-pie',
        keywords: ['compliance dashboard', 'overview'],
      },
      {
        id: 'compliance-incidents',
        label: 'Incidents',
        routerLink: '/compliance/incidents',
        iconClass: 'fas fa-exclamation-triangle',
        exact: false,
        keywords: ['incident', 'accident'],
      },
      {
        id: 'compliance-report-incident',
        label: 'Report Incident',
        routerLink: '/compliance/incidents/create',
        iconClass: 'fas fa-plus-circle',
        keywords: ['new incident', 'report'],
      },
      {
        id: 'compliance-calendar',
        label: 'Calendar',
        routerLink: '/compliance/calendar',
        iconClass: 'fas fa-calendar-alt',
        keywords: ['schedule', 'dates'],
      },
      {
        id: 'compliance-add-inspection',
        label: 'Add Inspection',
        routerLink: '/compliance/inspections/create',
        iconClass: 'fas fa-clipboard-check',
        keywords: ['inspection', 'dot inspection'],
      },
    ],
  },
  { kind: 'divider' },
  {
    kind: 'link',
    link: {
      id: 'messaging',
      label: 'Messages',
      routerLink: '/messaging',
      iconClass: 'fas fa-comments',
      exact: false,
      keywords: ['chat', 'inbox', 'communication'],
    },
  },
  {
    kind: 'link',
    link: {
      id: 'notifications',
      label: 'Notifications',
      routerLink: '/admin/notifications',
      iconClass: 'fas fa-bell',
      keywords: ['alerts', 'announcements'],
    },
  },
  {
    kind: 'link',
    link: {
      id: 'reports',
      label: 'Reports',
      routerLink: '/reports',
      iconClass: 'fas fa-chart-bar',
      rolesAny: ['Admin', 'FleetManager', 'Accountant'],
      keywords: ['analytics', 'kpi', 'business intelligence'],
    },
  },
  { kind: 'divider', rolesAny: ['Admin'] },
  {
    kind: 'group',
    id: 'admin',
    label: 'Admin',
    routerLink: '/admin',
    iconClass: 'fas fa-cog',
    rolesAny: ['Admin'],
    exact: false,
    groupKey: 'admin',
    keywords: ['settings', 'configuration', 'system'],
    children: [
      {
        id: 'admin-dashboard',
        label: 'Dashboard',
        routerLink: '/admin',
        iconClass: 'fas fa-chart-line',
        exact: true,
        keywords: ['admin dashboard'],
      },
      {
        id: 'admin-users',
        label: 'Users',
        routerLink: '/admin/users',
        iconClass: 'fas fa-users',
        keywords: ['accounts', 'permissions'],
      },
      {
        id: 'admin-inactive-users',
        label: 'Inactive Users',
        routerLink: '/admin/inactive-users',
        iconClass: 'fas fa-user-slash',
        keywords: ['disabled users'],
      },
      {
        id: 'admin-notifications',
        label: 'Notifications',
        routerLink: '/admin/notifications',
        iconClass: 'fas fa-bell',
        keywords: ['alerts'],
      },
      {
        id: 'admin-audit-logs',
        label: 'Audit Logs',
        routerLink: '/admin/audit-logs',
        iconClass: 'fas fa-history',
        keywords: ['audit', 'history', 'activity'],
      },
      {
        id: 'admin-email-logs',
        label: 'Email Logs',
        routerLink: '/admin/email-logs',
        iconClass: 'fas fa-envelope',
        keywords: ['email', 'mail'],
      },
      {
        id: 'admin-pending-drivers',
        label: 'Pending Drivers',
        routerLink: '/admin/pending-drivers',
        iconClass: 'fas fa-user-clock',
        keywords: ['onboarding', 'approval', 'queue'],
      },
      {
        id: 'admin-rejected-drivers',
        label: 'Rejected Drivers',
        routerLink: '/admin/rejected-drivers',
        iconClass: 'fas fa-user-times',
        keywords: ['denied'],
      },
      {
        id: 'admin-motive',
        label: 'Motive',
        routerLink: '/admin/motive',
        iconClass: 'fas fa-satellite-dish',
        keywords: ['eld', 'telematics', 'integration'],
      },
    ],
  },
];
