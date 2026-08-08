export const ADMIN_TIME_ZONE_COOKIE = "frame_admin_time_zone";

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

function decodeCookieValue(value: string | undefined) {
  if (!value) return undefined;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function resolveAdminTimeZone(
  requestedTimeZone?: string,
  storedTimeZone?: string,
): AdminTimeZone {
  const candidates = [requestedTimeZone, decodeCookieValue(storedTimeZone)];

  for (const candidate of candidates) {
    const matchingOption = ADMIN_TIME_ZONES.find(
      (option) => option.value === candidate,
    );
    if (matchingOption) return matchingOption.value;
  }

  return "UTC";
}
