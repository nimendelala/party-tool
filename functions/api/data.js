export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
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

    // All other requests: let assets handle them
    return new Response("Not Found", {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
}
