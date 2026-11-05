import { FactoryIcon, WorkOrderIcon } from './FactoryIcons';
import React, { useState } from 'react';
import { FiCheck, FiPlus, FiX } from 'react-icons/fi';
import { Avatar, Empty, PanelHeading, shortDate, Status } from './ui';

export default function Requests({
  requests,
  admin,
  onDecision,
  busy,
  openDialog,
}) {
  const [filter, setFilter] = useState('pending');
  const [kind, setKind] = useState('all');
  const filtered = requests.filter(
    (r) =>
      (filter === 'all' || r.status === filter) &&
      (kind === 'all' || r.kind === kind),
  );
  return (
    <section className="panel">
      <PanelHeading
        title={
          <>
            <WorkOrderIcon />
            {admin ? 'Workforce approval queue' : 'My shift requests'}
          </>
        }
        subtitle={
          admin
            ? 'Review leave and overtime requests from your team.'
            : 'Keep track of what’s submitted, approved, and coming up.'
        }
        action={
          !admin && (
            <button
              className="secondary"
              onClick={() => openDialog({ type: 'leave' })}
            >
              <FiPlus /> New request
            </button>
          )
        }
      />
      <div className="request-toolbar">
        <div className="filter-tabs" role="group" aria-label="Request status">
          {['pending', 'approved', 'rejected', 'all'].map((status) => (
            <button
              aria-pressed={filter === status}
              className={filter === status ? 'selected' : ''}
              onClick={() => setFilter(status)}
              key={status}
            >
              {status === 'all' ? 'All requests' : status}
              <span>
                {
                  requests.filter(
                    (r) => status === 'all' || r.status === status,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <select
          aria-label="Request type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="leave">Leave</option>
          <option value="overtime">Overtime</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {admin && <th>Team member</th>}
              <th>Request</th>
              <th>Date</th>
              <th>Duration</th>
              <th>Status</th>
              <th>{admin ? 'Decision' : 'Decision note'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                {admin && (
                  <td>
                    <div className="person-cell">
                      <Avatar name={r.name} />
                      <div>
                        <strong>{r.name}</strong>
                        <small>{r.staff_id}</small>
                      </div>
                    </div>
                  </td>
                )}
                <td>
                  <span className={`request-type ${r.kind}`}>
                    <FactoryIcon
                      name={r.kind === 'leave' ? 'calendar' : 'shift'}
                    />
                    <span className="capitalize">{r.kind}</span>
                  </span>
                </td>
                <td>{shortDate(r.date)}</td>
                <td>{r.kind === 'leave' ? '1 day' : `${r.hours} hours`}</td>
                <td>
                  <Status value={r.status} />
                </td>
                <td>
                  {admin && r.status === 'pending' ? (
                    <div className="row-actions">
                      <button
                        disabled={busy}
                        className="approve-button"
                        onClick={() => onDecision(r, 'approve')}
                      >
                        <FiCheck /> Approve
                      </button>
                      <button
                        disabled={busy}
                        className="decline-button"
                        onClick={() => onDecision(r, 'reject')}
                      >
                        <FiX /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className="decision-note">
                      {r.reason ||
                        (r.status === 'pending' ? 'Awaiting review' : '—')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <Empty
            title={
              filter === 'pending' ? 'All caught up.' : 'Nothing to show yet.'
            }
          >
            {filter === 'pending'
              ? 'There are no pending requests in this view.'
              : 'Requests will appear here when their status changes.'}
          </Empty>
        )}
      </div>
      <div className="table-footer">
        {filtered.length} {filtered.length === 1 ? 'request' : 'requests'} in
        this view<span>SHIFT REQUEST REGISTER</span>
      </div>
    </section>
  );
}
