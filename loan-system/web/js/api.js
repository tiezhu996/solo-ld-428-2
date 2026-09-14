/* 极简 API 封装，零依赖。 */
const API = (() => {
  async function request(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const resp = await fetch(path, opts);
    let data = null;
    const text = await resp.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }
    if (!resp.ok) {
      const err = new Error((data && data.error) || `请求失败 (${resp.status})`);
      err.status = resp.status;
      err.data = data || {};
      throw err;
    }
    return data;
  }
  return {
    get: (p) => request("GET", p),
    post: (p, b) => request("POST", p, b || {}),
    put: (p, b) => request("PUT", p, b || {}),
    del: (p) => request("DELETE", p),
  };
})();
