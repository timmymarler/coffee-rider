// Shared constants for groups and invites
export const GROUPS_COLLECTION = "groups";
export const GROUP_MEMBERS_SUBCOLLECTION = "members";
export const GROUP_INVITES_COLLECTION = "groupInvites";

export const GROUP_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
};

export const GROUP_MEMBER_ROLE = {
  OWNER: "owner",
  MOD: "mod",
  MEMBER: "member",
};

export const GROUP_MEMBER_STATUS = {
  ACTIVE: "active",
  KICKED: "kicked",
  LEFT: "left",
};

export const GROUP_INVITE_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  REVOKED: "revoked",
  EXPIRED: "expired",
};

export const GROUP_INVITE_EXPIRY_DAYS = 30;

export function computeInviteExpiry(days = GROUP_INVITE_EXPIRY_DAYS) {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}
