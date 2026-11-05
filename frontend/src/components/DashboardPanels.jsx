import React from 'react';
import {
  FactoryIcon,
  ConveyorIcon,
  CrewIcon,
  ShiftIcon,
  WorkOrderIcon,
  LogbookIcon,
  SafetyIcon,
  PowerIcon,
  CalendarIcon,
} from './FactoryIcons';
import { FiArrowRight, FiArrowUpRight, FiCheck } from 'react-icons/fi';
import {
  ActionLink,
  Avatar,
  Empty,
  PanelHeading,
  relativeTime,
  shortDate,
  Status,
} from './ui';

const actionNames = {
  'session.logged_in': 'Signed in to the workspace',
  'session.logged_out': 'Signed out',
  'session.login_failed': 'Unsuccessful sign-in attempt',
  'employee.created': 'Team member added',
  'employee.updated': 'Employee details updated',
  'employee.warning_recorded': 'Warning recorded',
  'attendance.clocked_in': 'Clocked in for a shift',
  'attendance.clocked_out': 'Finished a shift',
  'request.submitted': 'Submitted a request',
  'request.approved': 'Request approved',
  'request.rejected': 'Request declined',
  'password.changed': 'Password changed',
  'password.reset_completed': 'Account password recovered',
  'password.reset_requested': 'Password recovery requested',
  'password.operator_link_issued': 'Recovery link issued by an operator',
  'account.admin_created': 'Administrator account created',
  'account.activated': 'Account activated',
  'account.deactivated': 'Account deactivated',
};
export function ActivityList({ events = [] }) {
  if (!events.length)
    return (
      <Empty title="A clean slate">
        Your team’s activity will appear here as work gets underway.
      </Empty>
    );
  return (
    <div className="activity-list">
      {events.map((event) => (
        <div className="activity-item" key={event.id}>
          <span
            className={`activity-dot ${event.action.includes('failed') ? 'alert' : ''}`}
          >
            <FactoryIcon
              name={
                event.action.includes('failed') ||
                event.action.includes('warning')
                  ? 'safety'
                  : event.action.startsWith('attendance')
                    ? 'shift'
                    : event.action.startsWith('request')
                      ? 'workorder'
                      : event.action.startsWith('employee')
                        ? 'crew'
                        : 'access'
              }
            />
          </span>
          <div>
            <strong>{actionNames[event.action] || event.action}</strong>
            <p>
              {event.actor} <span>→</span> {event.target}
            </p>
          </div>
          <time
            dateTime={event.created_at}
            title={new Date(event.created_at).toLocaleString()}
          >
            {relativeTime(event.created_at)}
          </time>
        </div>
      ))}
    </div>
  );
}
function lineSymbol(name) {
  const value = name.toLowerCase();
  return /dispatch|shipping/.test(value)
    ? 'dispatch'
    : /pack|warehouse/.test(value)
      ? 'forklift'
      : /press|mill|cut/.test(value)
        ? 'press'
        : /weld|maint|machine/.test(value)
          ? 'gear'
          : 'conveyor';
}
export function AdminOverview({ data, setTab, onDecision, busy }) {
  const employees = data.attendance;
  const present = employees.filter(
    (e) => e.clock_in_status === 'Clocked In',
  ).length;
  const pending = data.requests.filter((r) => r.status === 'pending');
  const lines = Object.entries(
    employees.reduce((groups, employee) => {
      const name = employee.machine_line || 'Unassigned';
      if (!groups[name]) groups[name] = { total: 0, present: 0, crew: [] };
      groups[name].total += 1;
      groups[name].present += employee.clock_in_status === 'Clocked In' ? 1 : 0;
      groups[name].crew.push(employee.name);
      return groups;
    }, {}),
  ).sort((a, b) => b[1].present - a[1].present || a[0].localeCompare(b[0]));
  const coverage = employees.length
    ? Math.round((present / employees.length) * 100)
    : 0;
  return (
    <>
      <div className="control-signal">
        <span className="signal-symbol">
          <FactoryIcon name={pending.length ? 'safety' : 'workorder'} />
        </span>
        <div>
          <strong>
            {pending.length ? 'OPERATOR ATTENTION' : 'APPROVAL QUEUE CLEAR'}
          </strong>
          <p>
            {pending.length
              ? `${pending.length} workforce ${pending.length === 1 ? 'request is' : 'requests are'} waiting for a decision.`
              : 'No pending leave or overtime requests.'}
          </p>
        </div>
        <button className="secondary" onClick={() => setTab('requests')}>
          Open approval queue <FiArrowRight />
        </button>
        <span className="signal-code">WORKFORCE / 01</span>
      </div>
      <section className="panel floor-board">
        <PanelHeading
          title={
            <>
              <ConveyorIcon /> Machine-line crew coverage
            </>
          }
          subtitle="Employee attendance grouped by assigned machine line."
          action={
            <span className="board-tag">
              <span /> ATTENDANCE SIGNALS
            </span>
          }
        />
        <div className="floor-summary">
          <span>
            <FactoryIcon name="plant" />
            <strong>
              {lines.filter(([name]) => name !== 'Unassigned').length}
            </strong>{' '}
            assigned lines
          </span>
          <span>
            <CrewIcon />
            <strong>{present}</strong> crew on shift
          </span>
          <span>
            <PowerIcon />
            <strong>{coverage}%</strong> roster attendance
          </span>
          <button className="text-button" onClick={() => setTab('team')}>
            Open crew roster <FiArrowUpRight />
          </button>
        </div>
        {lines.length ? (
          <div className="machine-grid">
            {lines.map(([name, line], index) => (
              <article
                className={`machine-module ${line.present ? 'staffed' : 'unstaffed'}`}
                key={name}
              >
                <div className="machine-module-top">
                  <span className="machine-symbol">
                    <FactoryIcon
                      name={name === 'Unassigned' ? 'crew' : lineSymbol(name)}
                    />
                  </span>
                  <span className="machine-code">
                    {name === 'Unassigned'
                      ? 'UNASSIGNED'
                      : `LINE / ${String(index + 1).padStart(2, '0')}`}
                  </span>
                  <i />
                </div>
                <h3>{name}</h3>
                <div className="machine-reading">
                  <strong>{String(line.present).padStart(2, '0')}</strong>
                  <span>
                    / {String(line.total).padStart(2, '0')}
                    <small>CREW ON SHIFT</small>
                  </span>
                </div>
                <div
                  className="segment-meter"
                  role="img"
                  aria-label={`${name}: ${line.present} of ${line.total} crew on shift`}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <span
                      className={
                        i < Math.round((line.present / line.total) * 12)
                          ? 'filled'
                          : ''
                      }
                      key={i}
                    />
                  ))}
                </div>
                <div className="machine-module-bottom">
                  <span>
                    <CrewIcon />
                    {line.present ? 'Crew present' : 'No crew on shift'}
                  </span>
                  <span>{Math.round((line.present / line.total) * 100)}%</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="No line assignments recorded"
            action={
              <button onClick={() => setTab('team')}>
                <CrewIcon /> Set up crew assignments
              </button>
            }
          >
            Add employees and assign machine lines to begin monitoring coverage.
          </Empty>
        )}
        <div className="board-footnote">
          <FactoryIcon name="press" />
          <span>
            Coverage reflects employee attendance on assigned machine lines.
          </span>
          <span>SHIFT COORDINATION</span>
        </div>
      </section>
      <div className="operations-grid">
        <section className="panel review-panel">
          <PanelHeading
            title={
              <>
                <WorkOrderIcon /> Approval desk
              </>
            }
            subtitle="Leave and overtime awaiting review"
            action={<span className="count">{pending.length} pending</span>}
          />
          {pending.length ? (
            <div className="review-list">
              {pending.slice(0, 4).map((item) => (
                <div className="review-item" key={item.id}>
                  <span className={`request-illustration ${item.kind}`}>
                    <FactoryIcon
                      name={item.kind === 'leave' ? 'calendar' : 'shift'}
                    />
                  </span>
                  <div className="review-person">
                    <strong>{item.name}</strong>
                    <p>
                      <span className="capitalize">{item.kind}</span> ·{' '}
                      {shortDate(item.date)} ·{' '}
                      {item.kind === 'leave' ? '1 day' : `${item.hours} hours`}
                    </p>
                  </div>
                  <button
                    disabled={busy}
                    className="approve-button"
                    aria-label={`Approve ${item.kind} request from ${item.name}`}
                    onClick={() => onDecision(item, 'approve')}
                  >
                    <FiCheck /> Approve
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Approval desk clear">
              New workforce requests will appear here for review.
            </Empty>
          )}
          <button
            className="panel-bottom-link"
            onClick={() => setTab('requests')}
          >
            All workforce requests <FiArrowRight />
          </button>
        </section>
        <section className="panel">
          <PanelHeading
            title={
              <>
                <LogbookIcon /> Operations feed
              </>
            }
            subtitle="Recent workforce events"
            action={
              <ActionLink onClick={() => setTab('activity')}>
                Full log
              </ActionLink>
            }
          />
          <ActivityList events={(data.activity || []).slice(0, 4)} />
        </section>
      </div>
    </>
  );
}
export function EmployeeOverview({ data, setTab, openDialog, mutate, busy }) {
  const onShift = data.clock_in_status === 'Clocked In';
  const pending = data.requests.filter((r) => r.status === 'pending');
  return (
    <>
      <div className="employee-overview">
        <section className="shift-card">
          <div className="shift-header">
            <span className="shift-symbol">
              {onShift ? <PowerIcon /> : <CrewIcon />}
            </span>
            <Status value={data.clock_in_status} />
          </div>
          <p className="eyebrow">OPERATOR SHIFT TERMINAL</p>
          <h2>{onShift ? 'Shift in progress' : 'Ready for shift'}</h2>
          <p>
            {onShift
              ? `Your shift started ${data.clocked_in_at ? new Date(data.clocked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'earlier'}. Remember to clock out when you finish.`
              : 'Verify your machine-line assignment and clock in when your shift begins.'}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              mutate(`/employee/${onShift ? 'clock-out' : 'clock-in'}`, {})
            }
          >
            <ShiftIcon /> {onShift ? 'Finish my shift' : 'Start my shift'}
            <FiArrowRight />
          </button>
          <div className="shift-detail">
            <span>{data.machine_line || 'Machine line unassigned'}</span>
            <span>{data.staff_id}</span>
          </div>
        </section>
        <section className="panel quick-request">
          <PanelHeading
            title="Shift requests"
            subtitle="Coordinate leave and additional shift hours."
          />
          <button
            className="quick-request-button"
            onClick={() => openDialog({ type: 'leave' })}
          >
            <span className="request-illustration leave">
              <CalendarIcon />
            </span>
            <div>
              <strong>Request a day off</strong>
              <p>{data.leave_days} leave days available</p>
            </div>
            <FiArrowUpRight />
          </button>
          <button
            className="quick-request-button"
            onClick={() => openDialog({ type: 'overtime' })}
          >
            <span className="request-illustration overtime">
              <ShiftIcon />
            </span>
            <div>
              <strong>Overtime assignment</strong>
              <p>Submit an overtime request</p>
            </div>
            <FiArrowUpRight />
          </button>
          <div className="request-note">
            <FiCheck /> Your requests are saved and tracked in one place.
          </div>
        </section>
      </div>
      <div className="overview-grid employee-details">
        <section className="panel">
          <PanelHeading
            title="Your recent requests"
            subtitle={`${pending.length} awaiting a decision`}
            action={
              <ActionLink onClick={() => setTab('requests')}>
                View all
              </ActionLink>
            }
          />
          {data.requests.length ? (
            <div className="recent-requests">
              {data.requests.slice(0, 4).map((r) => (
                <div key={r.id}>
                  <span className={`request-illustration ${r.kind}`}>
                    {r.kind === 'leave' ? <CalendarIcon /> : <ShiftIcon />}
                  </span>
                  <div>
                    <strong className="capitalize">{r.kind} request</strong>
                    <p>
                      {shortDate(r.date)} ·{' '}
                      {r.kind === 'leave' ? '1 day' : `${r.hours} hours`}
                    </p>
                  </div>
                  <Status value={r.status} />
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No shift requests yet">
              Request leave or overtime and follow its progress here.
            </Empty>
          )}
        </section>
        <section className="panel">
          <PanelHeading
            title={
              <>
                <CrewIcon /> Operator record
              </>
            }
            subtitle="Personnel and machine-line assignment"
          />
          <dl className="employment-details">
            <div>
              <dt>Staff ID</dt>
              <dd>{data.staff_id}</dd>
            </div>
            <div>
              <dt>Work email</dt>
              <dd>{data.email}</dd>
            </div>
            <div>
              <dt>Machine line</dt>
              <dd>{data.machine_line || 'Unassigned'}</dd>
            </div>
            <div>
              <dt>Contract details</dt>
              <dd>
                {data.contract_details ||
                  'Contact your administrator for contract details.'}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      {data.warnings.length > 0 && (
        <section className="panel warnings-panel">
          <PanelHeading
            title={
              <>
                <SafetyIcon /> Safety & personnel notices
              </>
            }
            subtitle={`${data.warnings.length} recorded ${data.warnings.length === 1 ? 'warning' : 'warnings'}`}
          />
          {data.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </section>
      )}
    </>
  );
}
