export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const apiHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: apiHeaders });
  }

  // --- D1 helpers ---

  async function readData() {
    const row = await env.DB.prepare(
      'SELECT students, tasks, version FROM app_data WHERE id = 1'
    ).first();

    if (row) {
      return {
        students: JSON.parse(row.students || '[]'),
        tasks: JSON.parse(row.tasks || '[]'),
        version: row.version || 1
      };
    }

    // Empty D1 — try migrating from KV (one-time)
    try {
      const rawStudents = await env.PARTY_DATA.get("students");
      const rawTasks = await env.PARTY_DATA.get("tasks");
      const rawVersion = await env.PARTY_DATA.get("_version");
      const data = await env.PARTY_DATA.get("data", { type: "json" });

      let students = [], tasks = [], version = 1;

      if (data && typeof data.version === "number") {
        students = data.students || [];
        tasks = data.tasks || [];
        version = data.version || 1;
      } else if (rawStudents) {
        students = JSON.parse(rawStudents);
        tasks = rawTasks ? JSON.parse(rawTasks) : [];
        version = parseInt(rawVersion || "1");
      }

      if (students.length > 0 || tasks.length > 0) {
        await env.DB.prepare(
          'INSERT OR REPLACE INTO app_data (id, students, tasks, version) VALUES (1, ?, ?, ?)'
        ).bind(JSON.stringify(students), JSON.stringify(tasks), version).run();
      } else {
        await env.DB.prepare(
          'INSERT OR IGNORE INTO app_data (id, students, tasks, version) VALUES (1, ?, ?, ?)'
        ).bind('[]', '[]', 1).run();
      }

      return { students, tasks, version };
    } catch (e) {
      return { students: [], tasks: [], version: 1 };
    }
  }

  // --- GET /api/data ---
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

  // --- PUT /api/data ---
  if (path === "/api/data" && request.method === "PUT") {
    try {
      const body = await request.json();
      const reqVersion = body._version || 0;
      const current = await readData();
      const storedVersion = current.version || 1;

      // Version conflict
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
      const students = JSON.stringify(
        Array.isArray(body.students) ? body.students : current.students
      );
      const tasks = JSON.stringify(
        Array.isArray(body.tasks) ? body.tasks : current.tasks
      );

      // Optimistic locking: only update if version hasn't changed
      const result = await env.DB.prepare(
        'UPDATE app_data SET students = ?, tasks = ?, version = ? WHERE id = 1 AND version = ?'
      ).bind(students, tasks, newVersion, storedVersion).run();

      if (result.changes === 0) {
        // Race: another request updated between our read and write
        const fresh = await env.DB.prepare(
          'SELECT students, tasks, version FROM app_data WHERE id = 1'
        ).first();
        const freshData = fresh ? {
          students: JSON.parse(fresh.students || '[]'),
          tasks: JSON.parse(fresh.tasks || '[]'),
          version: fresh.version || 1
        } : { students: [], tasks: [], version: 1 };

        return new Response(JSON.stringify({
          conflict: true,
          students: freshData.students,
          tasks: freshData.tasks,
          version: freshData.version
        }), {
          status: 409,
          headers: { ...apiHeaders, "Content-Type": "application/json" }
        });
      }

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

  // --- POST /api/auth ---
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

  // --- POST /api/auth/change ---
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

  return new Response("Not Found", { status: 404 });
}
