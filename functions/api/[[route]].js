export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const apiHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "CDN-Cache-Control": "no-cache",
    "Surrogate-Control": "no-store",
    "Pragma": "no-cache",
    "Expires": "0"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: apiHeaders });
  }

  // Helper: read data, migrating from legacy separate keys if needed
  async function readData() {
    let data = await env.PARTY_DATA.get("data", { type: "json" });
    if (data && typeof data.version === "number") return data;

    // Migration: read from legacy separate keys, combine into one
    const rawStudents = await env.PARTY_DATA.get("students");
    const students = rawStudents ? JSON.parse(rawStudents) : [];
    const rawTasks = await env.PARTY_DATA.get("tasks");
    const tasks = rawTasks ? JSON.parse(rawTasks) : [];
    const version = parseInt(await env.PARTY_DATA.get("_version") || "1");
    data = { students, tasks, version };
    await env.PARTY_DATA.put("data", JSON.stringify(data));
    return data;
  }

  // GET /api/data - read shared data
  if (path === "/api/data" && request.method === "GET") {
    try {
      const data = await readData();
      return new Response(JSON.stringify(data), {
        headers: { ...apiHeaders, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ students: [], tasks: [], version: 1 }), {
        headers: { ...apiHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // PUT /api/data - save shared data
  if (path === "/api/data" && request.method === "PUT") {
    try {
      const body = await request.json();
      const reqVersion = body._version || 0;
      const current = await readData();
      const storedVersion = current.version || 1;

      // Version conflict: client save was based on stale data
      if (reqVersion > 0 && reqVersion < storedVersion) {
        return new Response(JSON.stringify({
          conflict: true,
          students: current.students,
          tasks: current.tasks,
          version: storedVersion
        }), {
          status: 409,
          headers: { ...apiHeaders, "Content-Type": "application/json" }
        });
      }

      const newVersion = Math.max(reqVersion, storedVersion) + 1;
      const newData = {
        students: Array.isArray(body.students) ? body.students : current.students,
        tasks: Array.isArray(body.tasks) ? body.tasks : current.tasks,
        version: newVersion
      };
      await env.PARTY_DATA.put("data", JSON.stringify(newData));
      return new Response(JSON.stringify({ ok: true, version: newVersion }), {
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
