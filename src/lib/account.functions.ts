import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requestMyPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ redirectTo: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("user_id", context.userId)
      .single();

    if (profileError || !profile?.email) throw new Error("Owner email is unavailable");

    const { error } = await context.supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error("Password reset email could not be sent");
    return { ok: true as const };
  });