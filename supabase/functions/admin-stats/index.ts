import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isOwnerEmail } from "../_shared/ownerUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Empty token");

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    // Owner bypass via env-based config
    const isOwner = isOwnerEmail(user.email);

    // DB role check for non-owner admins
    let isDbAdmin = false;
    if (!isOwner) {
      const { data: roleData } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      isDbAdmin = !!roleData;
    }

    if (!isOwner && !isDbAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Fetch stats in parallel
    const [usersResult, trialsResult, adminsResult] = await Promise.all([
      supabaseClient.auth.admin.listUsers({ perPage: 1000 }),
      supabaseClient.from("user_trials").select("*"),
      supabaseClient.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);

    const users = usersResult.data?.users ?? [];
    const trials = trialsResult.data ?? [];
    const admins = adminsResult.data ?? [];

    const now = new Date();

    const activeTrials = trials.filter(
      (t) => new Date(t.trial_end) > now && t.scans_used < t.max_scans
    );
    const expiredTrials = trials.filter(
      (t) => new Date(t.trial_end) <= now || t.scans_used >= t.max_scans
    );
    const totalScans = trials.reduce((sum, t) => sum + (t.scans_used || 0), 0);

    const adminUserIds = admins.map((a) => a.user_id);
    const adminEmails = users
      .filter((u) => adminUserIds.includes(u.id))
      .map((u) => u.email);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentUsers = users.filter(
      (u) => new Date(u.created_at) > sevenDaysAgo
    );

    return new Response(
      JSON.stringify({
        total_users: users.length,
        recent_users_7d: recentUsers.length,
        total_trials: trials.length,
        active_trials: activeTrials.length,
        expired_trials: expiredTrials.length,
        total_scans: totalScans,
        admin_emails: adminEmails,
        admin_count: admins.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
