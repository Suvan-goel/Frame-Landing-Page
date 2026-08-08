import {
  isAdminTimeZone,
  resolveAdminTimeZone,
  type AdminTimeZone,
} from "./admin-time-zone";
import { getSupabaseAdmin } from "./supabase-admin.server";

const GLOBAL_ADMIN_SETTINGS_ID = "global";

type AdminSettingsRow = {
  time_zone: string;
};

export async function getPersistedAdminTimeZone(): Promise<AdminTimeZone> {
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("time_zone")
    .eq("id", GLOBAL_ADMIN_SETTINGS_ID)
    .maybeSingle<AdminSettingsRow>();

  if (error) {
    console.error("Admin time zone lookup failed", error);
    throw new Error("The saved admin time zone is temporarily unavailable.");
  }

  return resolveAdminTimeZone(data?.time_zone);
}

export async function setPersistedAdminTimeZone(
  timeZone: AdminTimeZone,
  updatedBy: string,
): Promise<void> {
  if (!isAdminTimeZone(timeZone)) {
    throw new Error("Invalid admin time zone.");
  }

  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from("admin_settings").upsert(
    {
      id: GLOBAL_ADMIN_SETTINGS_ID,
      time_zone: timeZone,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Admin time zone update failed", error);
    throw new Error("The admin time zone could not be saved.");
  }
}
