"use client";

import { useEffect, useMemo, useState } from "react";

type ClientRow = {
  id: string;
  name: string;
  email: string;
  inn: string | null;
  website_url: string | null;
  auth_user_id: string | null;
  auth_invited_at: string | null;
  created_at: string;
};

export default function AdminPage() {
  const [status, setStatus] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [me, setMe] = useState<{ role: string; orgId: string } | null>(null);
  const [clientForm, setClientForm] = useState({
    name: "",
    email: "",
    inn: "",
    website_url: "",
    create_auth_user: true,
    password: "",
  });

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
    }),
    [],
  );

  async function fetchClients() {
    setStatus("Loading clients...");
    const response = await fetch("/api/admin/clients", { headers: authHeaders });
    if (!response.ok) {
      setStatus(`Failed to load clients: ${response.status}`);
      return;
    }
    const payload = await response.json();
    setClients(payload.clients ?? []);
    setStatus("Clients loaded.");
  }

  async function fetchMe() {
    const response = await fetch("/api/auth/me");
    if (!response.ok) {
      setMe(null);
      return;
    }
    const payload = await response.json();
    setMe({ role: payload.role, orgId: payload.orgId });
  }

  async function handleRegisterClient(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Registering client...");
    const response = await fetch("/api/admin/clients", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(clientForm),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Client registration failed.");
      return;
    }
    setStatus("Client registered.");
    setClientForm({
      name: "",
      email: "",
      inn: "",
      website_url: "",
      create_auth_user: true,
      password: "",
    });
    await fetchClients();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  useEffect(() => {
    fetchMe();
    fetchClients();
  }, []);

  return (
    <main>
      <header className="admin-header">
        <h1 className="admin-title">Admin Control Room</h1>
        <p className="admin-subtitle">
          Register clients and keep onboarding tight.
        </p>
      </header>

      <section className="admin-card">
        <h2 className="card-title">Session</h2>
        <div className="token-row">
          <div className="status">
            {me ? `Signed in as ${me.role}` : "Not authenticated"}
          </div>
          <div className="action-row">
            <button className="button secondary" type="button" onClick={fetchClients}>
              Refresh clients
            </button>
            <button className="button secondary" type="button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
        <div className="status">{status}</div>
      </section>

      <div className="admin-grid">
        <section className="admin-card">
          <h2 className="card-title">Register a Client</h2>
          <form onSubmit={handleRegisterClient} className="form-grid">
            <label>
              Name
              <input
                value={clientForm.name}
                onChange={(event) =>
                  setClientForm({ ...clientForm, name: event.target.value })
                }
                placeholder="Acme LLC"
                required
              />
            </label>
            <label>
              Email
              <input
                value={clientForm.email}
                onChange={(event) =>
                  setClientForm({ ...clientForm, email: event.target.value })
                }
                placeholder="owner@acme.com"
                required
              />
            </label>
            <label>
              INN
              <input
                value={clientForm.inn}
                onChange={(event) =>
                  setClientForm({ ...clientForm, inn: event.target.value })
                }
                placeholder="1234567890"
              />
            </label>
            <label>
              Website URL
              <input
                value={clientForm.website_url}
                onChange={(event) =>
                  setClientForm({ ...clientForm, website_url: event.target.value })
                }
                placeholder="https://acme.com"
              />
            </label>
            <label>
              Auth Mode
              <select
                value={
                  clientForm.create_auth_user
                    ? clientForm.password
                      ? "password"
                      : "invite"
                    : "skip"
                }
                onChange={(event) => {
                  const mode = event.target.value;
                  if (mode === "skip") {
                    setClientForm({
                      ...clientForm,
                      create_auth_user: false,
                      password: "",
                    });
                  } else if (mode === "password") {
                    setClientForm({ ...clientForm, create_auth_user: true });
                  } else {
                    setClientForm({ ...clientForm, create_auth_user: true, password: "" });
                  }
                }}
              >
                <option value="invite">Invite via email</option>
                <option value="password">Set password manually</option>
                <option value="skip">Skip auth user</option>
              </select>
            </label>
            <label>
              Password (optional)
              <input
                value={clientForm.password}
                onChange={(event) =>
                  setClientForm({ ...clientForm, password: event.target.value })
                }
                placeholder="Set manual password"
                type="password"
                disabled={!clientForm.create_auth_user}
              />
            </label>
            <div className="action-row">
              <button className="button" type="submit">
                Create client
              </button>
            </div>
          </form>
        </section>

      </div>

      <section className="admin-card">
        <h2 className="card-title">Clients</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Website</th>
              <th>Invite</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>{client.name}</td>
                <td>{client.email}</td>
                <td>{client.website_url ?? "—"}</td>
                <td>
                  {client.auth_invited_at ? (
                    <span className="badge">Invited</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{new Date(client.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
