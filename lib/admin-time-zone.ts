export const ADMIN_TIME_ZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (UK)" },
  { value: "Europe/Rome", label: "Rome / Central Europe" },
  { value: "America/New_York", label: "New York (Eastern)" },
  { value: "America/Chicago", label: "Chicago (Central)" },
  { value: "America/Denver", label: "Denver (Mountain)" },
  { value: "America/Los_Angeles", label: "Los Angeles (Pacific)" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "India" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
] as const;

export type AdminTimeZone = (typeof ADMIN_TIME_ZONES)[number]["value"];

export function isAdminTimeZone(value: unknown): value is AdminTimeZone {
  return (
    typeof value === "string" &&
    ADMIN_TIME_ZONES.some((option) => option.value === value)
  );
}

export function resolveAdminTimeZone(storedTimeZone?: string): AdminTimeZone {
  return isAdminTimeZone(storedTimeZone) ? storedTimeZone : "UTC";
}
