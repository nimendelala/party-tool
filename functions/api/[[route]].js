export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const apiHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, no-cache, must-revalidate"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: apiHeaders });
  }

  // GET /api/data - read shared data
  if (path === "/api/data" && request.method === "GET") {
    try {
      const raw = await env.PARTY_DATA.get("students");
      const students = raw ? JSON.parse(raw) : [];
      const tasksRaw = await env.PARTY_DATA.get("tasks");
      const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
      const groupsRaw = await env.PARTY_DATA.get("_groups");
      const groups = groupsRaw ? JSON.parse(groupsRaw) : [];
      return new Response(JSON.stringify({ students: students, tasks: tasks, groups: groups }), {
        headers: { ...apiHeaders, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ students: [], tasks: [] }), {
        headers: { ...apiHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // PUT /api/data - save shared data
  if (path === "/api/data" && request.method === "PUT") {
    try {
      const body = await request.json();
      if (Array.isArray(body.students)) {
        await env.PARTY_DATA.put("students", JSON.stringify(body.students));
      }
      if (Array.isArray(body.tasks)) {
        await env.PARTY_DATA.put("tasks", JSON.stringify(body.tasks));
      }
      if (Array.isArray(body.groups)) {
        await env.PARTY_DATA.put("_groups", JSON.stringify(body.groups));
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...apiHeaders, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...apiHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // POST /api/auth - verify password
  if (path === "/api/auth" && request.method === "POST") {
    try {
      const body = await request.json();
      const stored = await env.PARTY_DATA.get("_password");
      const valid = body.password === (stored || "123");
      return new Response(JSON.stringify({ ok: valid }), {
        headers: { ...apiHeaders, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false }), {
        headers: { ...apiHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // POST /api/auth/change - change login password (requires admin password)
  if (path === "/api/auth/change" && request.method === "POST") {
    try {
      const body = await request.json();
      const adminStored = await env.PARTY_DATA.get("_admin_pw");
      const adminPw = adminStored || "123";
      if (body.adminPassword !== adminPw) {
        return new Response(JSON.stringify({ ok: false, error: "管理密码错误" }), {
          headers: { ...apiHeaders, "Content-Type": "application/json" }
        });
      }
      await env.PARTY_DATA.put("_password", body.newPassword);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...apiHeaders, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { ...apiHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // Fallback for other paths under /api
  return new Response("Not Found", { status: 404 });
}
