import { ROLE_CAPABILITIES } from "./capabilities";

export function getCapabilities(role = "guest") {
  return ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES.guest;
}
