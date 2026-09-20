export type Permission = { key: string; action: string; description: string };
export type PermissionFeature = {
  feature: string;
  description: string;
  permissions: Permission[];
};

/**
 * The full catalog of permission keys the platform actually enforces, kept
 * to single, unit actions - never a combined/unified "manage" that bundles
 * create+update+delete (or approve+reject, etc.) under one key. A role
 * bundles whichever of these it needs; the granularity lives here, not in
 * the role.
 *
 * This is deliberately a static, code-defined list rather than something
 * stored in the database: a permission only means something because a
 * PermissionsGuard somewhere checks for its key, so the catalog can only
 * ever be as real as the code that enforces it. Add a key here in the same
 * change that adds the `@AuthPermissions(...)` guard using it.
 */
export const PERMISSION_FEATURES: PermissionFeature[] = [
  {
    feature: 'Shops',
    description: 'Shop locations',
    permissions: [
      { key: 'shop.view', action: 'View', description: 'See shops and their details' },
      { key: 'shop.create', action: 'Create', description: 'Create a shop' },
      { key: 'shop.update', action: 'Update', description: 'Edit a shop' },
      { key: 'shop.delete', action: 'Delete', description: 'Remove a shop' },
    ],
  },
  {
    feature: 'Categories',
    description: 'Inventory classification',
    permissions: [
      {
        key: 'inventory.category.view',
        action: 'View',
        description: 'See categories and their details',
      },
      {
        key: 'inventory.category.create',
        action: 'Create',
        description: 'Create a category',
      },
      {
        key: 'inventory.category.update',
        action: 'Update',
        description: 'Edit a category',
      },
      {
        key: 'inventory.category.delete',
        action: 'Delete',
        description: 'Remove a category',
      },
    ],
  },
  {
    feature: 'Inventory',
    description: 'The warehouse product catalog',
    permissions: [
      {
        key: 'inventory.view',
        action: 'View',
        description: 'See warehouse items and their details',
      },
      {
        key: 'inventory.create',
        action: 'Create',
        description: 'Create an inventory item',
      },
      {
        key: 'inventory.update',
        action: 'Update',
        description: 'Edit an inventory item',
      },
      {
        key: 'inventory.delete',
        action: 'Delete',
        description: 'Remove an inventory item',
      },
    ],
  },
  {
    feature: 'Sales',
    description: 'Checkout and till sales',
    permissions: [
      {
        key: 'sale.view',
        action: 'View',
        description: 'See past sales and receipts',
      },
      {
        key: 'sale.create',
        action: 'Create',
        description: 'Ring up a sale at checkout',
      },
      {
        key: 'payment-transaction.view',
        action: 'View',
        description: 'See Paystack payment transactions and their trend',
      },
    ],
  },
  {
    feature: 'Shop inventory',
    description: 'Inventory assigned to a shop',
    permissions: [
      {
        key: 'shop.inventory.view',
        action: 'View',
        description: 'See what a shop carries and how much',
      },
      {
        key: 'shop.inventory.create',
        action: 'Create',
        description: 'Assign an inventory item to a shop',
      },
      {
        key: 'shop.inventory.adjust-quantity',
        action: 'Adjust quantity',
        description: "Change a shop's on-hand quantity of an item",
      },
      {
        key: 'shop.inventory.update-status',
        action: 'Update status',
        description: 'Mark whether a shop still carries an item',
      },
      {
        key: 'shop.inventory.delete',
        action: 'Delete',
        description: 'Unassign an inventory item from a shop',
      },
    ],
  },
  {
    feature: 'Transfers',
    description: 'Warehouse-to-shop and shop-to-shop stock movement',
    permissions: [
      {
        key: 'stock.transfer.view',
        action: 'View',
        description: 'See transfers and their status',
      },
      {
        key: 'stock.transfer.complete',
        action: 'Complete',
        description: 'Complete a pending transfer',
      },
      {
        key: 'stock.transfer.cancel',
        action: 'Cancel',
        description: 'Cancel a pending transfer',
      },
    ],
  },
  {
    feature: 'Suppliers',
    description: 'External suppliers the warehouse buys stock from',
    permissions: [
      { key: 'supplier.view', action: 'View', description: 'See suppliers and their details' },
      { key: 'supplier.create', action: 'Create', description: 'Add a supplier' },
      { key: 'supplier.update', action: 'Update', description: 'Edit a supplier' },
      { key: 'supplier.delete', action: 'Delete', description: 'Remove a supplier' },
    ],
  },
  {
    feature: 'Supply requests',
    description: 'Ordering more stock from suppliers into the warehouse',
    permissions: [
      {
        key: 'supply.request.view',
        action: 'View',
        description: 'See supply requests and their status',
      },
      {
        key: 'supply.request.create',
        action: 'Create',
        description: 'Order stock from a supplier',
      },
      {
        key: 'supply.request.approve',
        action: 'Approve',
        description: 'Approve a supply request',
      },
      {
        key: 'supply.request.reject',
        action: 'Reject',
        description: 'Reject a supply request',
      },
    ],
  },
  {
    feature: 'Stock requests',
    description: 'Shops requesting more stock from the warehouse',
    permissions: [
      {
        key: 'stock.request.view',
        action: 'View',
        description: 'See stock requests and their status',
      },
      {
        key: 'stock.request.create',
        action: 'Create',
        description: 'Request more stock from the warehouse for a shop',
      },
      {
        key: 'stock.request.approve',
        action: 'Approve',
        description: 'Approve a stock request',
      },
      {
        key: 'stock.request.reject',
        action: 'Reject',
        description: 'Reject a stock request',
      },
    ],
  },
  {
    feature: 'Expenses',
    description: 'Operating costs',
    permissions: [
      {
        key: 'expense.view',
        action: 'View',
        description: 'See expenses and their details',
      },
      {
        key: 'expense.update',
        action: 'Update',
        description: 'Edit an expense',
      },
      {
        key: 'expense.update-status',
        action: 'Update status',
        description: 'Mark an expense paid or pending',
      },
      {
        key: 'expense.delete',
        action: 'Delete',
        description: 'Remove an expense',
      },
    ],
  },
  {
    feature: 'Ledger',
    description: "Shops' financial ledgers",
    permissions: [
      {
        key: 'ledger.view',
        action: 'View',
        description: "See a shop's ledger entries and balance",
      },
      {
        key: 'ledger.adjust',
        action: 'Adjust',
        description: 'Post a manual credit or debit to a shop wallet',
      },
    ],
  },
  {
    feature: 'Reports',
    description: 'Nightly per-shop and organisation-wide daily reports',
    permissions: [
      {
        key: 'daily-report.view',
        action: 'View',
        description: 'See daily reports for a shop or the whole organisation',
      },
      {
        key: 'daily-report.generate',
        action: 'Generate',
        description:
          'Manually (re)generate a daily report for a shop or the whole organisation',
      },
    ],
  },
  {
    feature: 'Vendors',
    description: 'Buyers who purchase on credit',
    permissions: [
      {
        key: 'vendor.view',
        action: 'View',
        description: "See vendors, their credit accounts and ledgers",
      },
      {
        key: 'vendor.create',
        action: 'Create',
        description: 'Register a new vendor',
      },
      {
        key: 'vendor.update',
        action: 'Update',
        description: "Edit a vendor's profile",
      },
      {
        key: 'vendor.payment.record',
        action: 'Record payment',
        description: 'Record a payment against a vendor’s balance',
      },
    ],
  },
  {
    feature: 'Sessions',
    description: 'Sign-in activity across every account',
    permissions: [
      {
        key: 'session.view',
        action: 'View',
        description: 'See sign-in history across the platform',
      },
    ],
  },
  {
    feature: 'Audit logs',
    description: 'The platform-wide activity history',
    permissions: [
      {
        key: 'audit.view',
        action: 'View',
        description: 'See who did what, and when',
      },
    ],
  },
  {
    feature: 'Employees',
    description: 'Staff accounts and access',
    permissions: [
      {
        key: 'user.view',
        action: 'View',
        description: 'See employees and their details',
      },
      {
        key: 'user.create',
        action: 'Create',
        description: 'Create an employee account',
      },
      {
        key: 'user.update',
        action: 'Update',
        description: "Edit an employee's details",
      },
      {
        key: 'user.update-status',
        action: 'Update status',
        description: "Enable or disable an employee's account",
      },
      {
        key: 'user.update-permissions',
        action: 'Update permissions',
        description: "Change what an employee is allowed to do",
      },
      {
        key: 'user.reset-password',
        action: 'Reset password',
        description: 'Set a new password for an employee',
      },
      {
        key: 'user.delete',
        action: 'Delete',
        description: 'Remove an employee account',
      },
    ],
  },
  {
    feature: 'Roles & permissions',
    description: 'Access control',
    permissions: [
      { key: 'role.view', action: 'View', description: 'See roles and their details' },
      { key: 'role.create', action: 'Create', description: 'Create a role' },
      { key: 'role.update', action: 'Update', description: 'Edit a role' },
      { key: 'role.delete', action: 'Delete', description: 'Remove a role' },
    ],
  },
  {
    feature: 'Settings',
    description: 'Business-wide configuration',
    permissions: [
      {
        key: 'settings.view',
        action: 'View',
        description: 'See business settings',
      },
      {
        key: 'settings.update',
        action: 'Update',
        description: 'Edit business settings',
      },
    ],
  },
  {
    feature: 'Customers',
    description: 'Example customer records',
    permissions: [
      {
        key: 'customer.view',
        action: 'View',
        description: 'See customer records',
      },
      {
        key: 'customer.delete',
        action: 'Delete',
        description: 'Remove a customer record',
      },
    ],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_FEATURES.flatMap(
  (feature) => feature.permissions.map((permission) => permission.key),
);
