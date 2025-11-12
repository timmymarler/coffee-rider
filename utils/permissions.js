// utils/permissions.js

// Define all roles and their capabilities
export const roles = {
  guest: {
    label: "Guest",
    description: "Can browse cafés and view public info.",
  },
  user: {
    label: "User",
    description:
      "Can browse cafés, view ratings and comments, and add new cafés.",
  },
  pro: {
    label: "Pro",
    description:
      "Can do everything a User can, plus add and view comments, save routes, and use multi-stop routing.",
  },
  admin: {
    label: "Admin",
    description:
      "Full control — can create, edit, and delete cafés, comments, ratings, users, and routes. Can audit all actions.",
  },
};

// Role-based permissions matrix
export const can = (role) => {
  return {
    // Browsing & viewing
    viewCafes: true,
    viewRatings: true,
    viewComments: ["user", "pro", "admin"].includes(role),

    // Content creation
    addCafe: ["user", "pro", "admin"].includes(role),
    addComment: ["pro", "admin"].includes(role),
    rateCafe: ["user", "pro", "admin"].includes(role),

    // Routes
    saveRoutes: ["pro", "admin"].includes(role),
    multiStopRouting: ["pro", "admin"].includes(role),

    // Admin-only power tools
    manageAll: role === "admin",
    auditLogs: role === "admin",

    // Profile & membership
    editProfile: ["user", "pro", "admin"].includes(role),
    upgradeToPro: role === "user",
  };
};

// Helper to check quickly in UI
export function canDo(role, action) {
  const permissions = can(role);
  return !!permissions[action];
}
