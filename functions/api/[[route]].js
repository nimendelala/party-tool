export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  // GET /api/data - read shared data
  if (path === "/api/data" && request.method === "GET") {
    try {
      const raw = await env.PARTY_DATA.get("students");
      const students = raw ? JSON.parse(raw) : [];
      const tasksRaw = await env.PARTY_DATA.get("tasks");
      const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
      return new Response(JSON.stringify({ students: students, tasks: tasks }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ students: [], tasks: [] }), {
        headers: { ...cors, "Content-Type": "application/json" }
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
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" }
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
        headers: { ...cors, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false }), {
        headers: { ...cors, "Content-Type": "application/json" }
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
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      await env.PARTY_DATA.put("_password", body.newPassword);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }

  // Fallback for other paths under /api
  return new Response("Not Found", { status: 404 });
}
