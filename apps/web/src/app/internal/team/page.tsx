'use client';

import { FormEvent, useEffect, useState } from 'react';
import { RefreshCw, UserPlus, Users } from 'lucide-react';
import { createInternalUser, getInternalUsers } from '@/lib/api';
import { InternalUser } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';

export default function InternalTeamPage() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadUsers() {
    setIsLoading(true);
    setError(null);
    try {
      setUsers(await getInternalUsers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load team members.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const user = await createInternalUser({
        label: String(form.get('label') ?? ''),
        email: String(form.get('email') ?? ''),
        role: String(form.get('role') ?? 'support'),
      });
      event.currentTarget.reset();
      setUsers((current) => [...current, user].sort((left, right) => left.label.localeCompare(right.label)));
      setNotice(`${user.label} has been added to the internal team.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to add team member.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <InternalShell
      activeView="team"
      eyebrow="Team management"
      title="Internal people and roles"
      action={
        <button className="icon-button" type="button" onClick={() => void loadUsers()} disabled={isLoading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      }
    >
      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="team-portal-grid">
        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <Users size={16} />
              Team Members
            </div>
            {isLoading && <span className="badge">Loading</span>}
          </div>
          <div className="team-list">
            {users.map((user) => (
              <article className="team-row" key={user.id}>
                <div>
                  <strong>{user.label}</strong>
                  <small>{user.email ?? user.id}</small>
                </div>
                <div className="team-row-meta">
                  <span className="badge" data-tone={user.role === 'admin' ? 'green' : 'blue'}>
                    {user.role ?? 'support'}
                  </span>
                  <span className="badge">{user.status ?? 'active'}</span>
                </div>
              </article>
            ))}
            {users.length === 0 && <div className="empty">No team members yet</div>}
          </div>
        </section>

        <form className="client-panel stack-form team-create-panel" onSubmit={handleCreate}>
          <div className="section-label">
            <UserPlus size={15} />
            Add person
          </div>
          <label>
            Name
            <input name="label" required placeholder="Support manager" />
          </label>
          <label>
            Email
            <input name="email" type="email" placeholder="person@example.com" />
          </label>
          <label>
            Role
            <select name="role" defaultValue="support">
              <option value="admin">Admin</option>
              <option value="support">Support</option>
              <option value="sales">Sales</option>
              <option value="qa">QA</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <p className="form-hint">
            New people become available as ticket owners immediately. Login permissions can be hardened later with invite emails and role-based access.
          </p>
          <button className="icon-button" disabled={isSaving} type="submit">
            <UserPlus size={15} />
            {isSaving ? 'Adding...' : 'Add to system'}
          </button>
        </form>
      </section>
    </InternalShell>
  );
}
