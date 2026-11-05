import { CrewIcon, ConveyorIcon, SafetyIcon } from './FactoryIcons';
import React, { useState } from 'react';
import { FiDownload, FiEdit2, FiSearch } from 'react-icons/fi';
import { Avatar, Empty, PanelHeading, Status } from './ui';

export default function TeamDirectory({ employees, openDialog }) {
  const [search, setSearch] = useState('');
  const [attendance, setAttendance] = useState('all');
  const [line, setLine] = useState('all');
  const filtered = employees.filter(
    (e) =>
      `${e.name} ${e.email} ${e.staff_id} ${e.machine_line}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (attendance === 'all' || e.clock_in_status === attendance) &&
      (line === 'all' || (e.machine_line || 'Unassigned') === line),
  );
  function download() {
    const csvCell = (value) =>
      `"${String(value)
        .replace(/^(?:[\t\r\n]|\s*[=+@-])/, "'$&")
        .replace(/"/g, '""')}"`;
    const rows = [
      [
        'Name',
        'Staff ID',
        'Email',
        'Machine line',
        'Attendance',
        'Leave days',
        'Approved overtime hours',
      ],
      ...filtered.map((e) => [
        e.name,
        e.staff_id,
        e.email,
        e.machine_line,
        e.clock_in_status,
        e.leave_days,
        e.overtime_hours,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ['\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')],
        { type: 'text/csv;charset=utf-8;' },
      ),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'factory-team.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="panel directory-panel">
      <PanelHeading
        title={
          <>
            <CrewIcon /> Crew roster{' '}
            <span className="count">{employees.length}</span>
          </>
        }
        subtitle="Personnel records, line assignments, and shift attendance."
        action={
          <button
            className="secondary"
            onClick={download}
            disabled={!filtered.length}
          >
            <FiDownload /> Export view
          </button>
        }
      />
      <div className="table-toolbar">
        <div className="search-input">
          <FiSearch />
          <input
            aria-label="Search team"
            placeholder="Search name, staff ID or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="table-filters">
          <select
            aria-label="Filter attendance"
            value={attendance}
            onChange={(e) => setAttendance(e.target.value)}
          >
            <option value="all">All attendance</option>
            <option value="Clocked In">On shift</option>
            <option value="Not Clocked In">Off shift</option>
          </select>
          <select
            aria-label="Filter machine line"
            value={line}
            onChange={(e) => setLine(e.target.value)}
          >
            <option value="all">All machine lines</option>
            {[...new Set(employees.map((e) => e.machine_line || 'Unassigned'))]
              .sort()
              .map((name) => (
                <option key={name}>{name}</option>
              ))}
          </select>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team member</th>
              <th>
                <ConveyorIcon /> Machine line
              </th>
              <th>Attendance</th>
              <th>Leave balance</th>
              <th>Overtime</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>
                  <div className="person-cell">
                    <Avatar name={e.name} />
                    <div>
                      <strong>{e.name}</strong>
                      <small>{e.email}</small>
                      <span className="staff-id">{e.staff_id}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="machine-line">
                    <>
                      <ConveyorIcon /> {e.machine_line || 'Unassigned'}
                    </>
                  </span>
                </td>
                <td>
                  <Status value={e.clock_in_status} />
                </td>
                <td>
                  <strong>{e.leave_days}</strong>
                  <span className="muted"> days</span>
                </td>
                <td>
                  {e.overtime_hours.toFixed(1)}
                  <span className="muted"> hrs</span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      title="Edit employee"
                      aria-label={`Edit ${e.name}`}
                      onClick={() => openDialog({ type: 'edit', employee: e })}
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      className="icon-button"
                      title={`${e.warnings.length} warnings`}
                      aria-label={`Warnings for ${e.name}: ${e.warnings.length}`}
                      onClick={() =>
                        openDialog({ type: 'warning', employee: e })
                      }
                    >
                      <SafetyIcon />
                      {e.warnings.length > 0 && (
                        <span>{e.warnings.length}</span>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <Empty
            title={
              employees.length
                ? 'No matches this time'
                : 'Let’s build your team'
            }
          >
            {employees.length
              ? 'Try another search or clear your filters.'
              : 'Add your first team member to bring your workspace to life.'}
          </Empty>
        )}
      </div>
      <div className="table-footer">
        <span>
          Showing {filtered.length} of {employees.length} team members
        </span>
        <CrewIcon />
        <span>WORKFORCE REGISTER</span>
      </div>
    </section>
  );
}
