import React, { useCallback, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiHelpCircle,
  FiLogOut,
  FiRefreshCw,
} from 'react-icons/fi';
import {
  PlantIcon,
  CrewIcon,
  ShiftIcon,
  WorkOrderIcon,
  LogbookIcon,
  PowerIcon,
  AccessIcon,
  PulseIcon,
} from './FactoryIcons';
import { AuthContext } from './AuthProvider';
import { api, SOCKET_PATH, SOCKET_URL } from '../api';
import {
  Avatar,
  Brand,
  Empty,
  Feedback,
  Field,
  localDate,
  Modal,
  PanelHeading,
  Stat,
  Status,
} from './ui';
import {
  ActivityList,
  AdminOverview,
  EmployeeOverview,
} from './DashboardPanels';
import TeamDirectory from './TeamDirectory';
import Requests from './Requests';

const titles = {
  overview: [
    'Workforce control room',
    'Monitor shift coverage, coordinate crews, and keep approvals moving.',
  ],
  team: [
    'Crew roster',
    'Personnel assignments, attendance, and workforce records.',
  ],
  requests: [
    'Approval queue',
    'Review leave and overtime requests before the next shift.',
  ],
  activity: [
    'Operations log',
    'A time-stamped record of workforce and account activity.',
  ],
  settings: [
    'Access & configuration',
    'Operator identity, credentials, and workspace access.',
  ],
};
const dialogTitles = {
  create: 'Register crew member',
  edit: 'Update crew assignment',
  warning: 'Record personnel warning',
  leave: 'Submit leave request',
  overtime: 'Submit overtime request',
  reject: 'Reject request / decision note',
  password: 'Update your password',
  account: 'Update account access',
};

export default function Workspace({ admin = false }) {
  const { logout, token, clearSession } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState('connecting');
  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState('overview');
  const [accounts, setAccounts] = useState([]);
  const [activity, setActivity] = useState(null);
  const [page, setPage] = useState(1);
  const [help, setHelp] = useState(false);
  const closeDialog = useCallback(() => setDialog(null), []);
  const openDialog = useCallback((value) => {
    setError('');
    setDialog(value);
  }, []);
  const load = useCallback(async () => {
    try {
      const [result, identity] = await Promise.all([
        api(admin ? '/admin/dashboard' : '/employee/profile'),
        api('/auth/me'),
      ]);
      setData(result);
      setMe(identity);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [admin]);
  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await api('/all'));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  const loadActivity = useCallback(async () => {
    try {
      setActivity(await api(`/admin/activity?page=${page}`));
    } catch (e) {
      setError(e.message);
    }
  }, [page]);
  useEffect(() => {
    load();
    const socket = io(SOCKET_URL, { path: SOCKET_PATH, auth: { token } });
    socket.on('data_changed', load);
    socket.on('connect', () => setConnection('live'));
    socket.on('disconnect', () => setConnection('polling'));
    socket.on('connect_error', () => setConnection('polling'));
    const timer = setInterval(load, 30000);
    return () => {
      socket.disconnect();
      clearInterval(timer);
    };
  }, [load, token]);
  useEffect(() => {
    if (admin && tab === 'settings') loadAccounts();
    if (admin && tab === 'activity') loadActivity();
  }, [admin, tab, loadAccounts, loadActivity, data]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function mutate(path, body, method = 'POST') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api(path, { method, body });
      setNotice(result.message);
      setDialog(null);
      if (path === '/auth/change-password') {
        clearSession();
        return;
      }
      await load();
      if (admin && tab === 'settings') await loadAccounts();
      if (admin && tab === 'activity') await loadActivity();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const { type } = dialog;
    if (type === 'create') mutate('/register', values);
    else if (type === 'edit')
      mutate(`/employee/${dialog.employee.id}/edit`, values, 'PATCH');
    else if (type === 'warning')
      mutate(`/employee/${dialog.employee.id}/add-warning`, values);
    else if (type === 'reject')
      mutate(`/admin/requests/${dialog.request.id}/reject`, values);
    else if (type === 'password') {
      if (values.password !== values.confirm_password) {
        setError('The new passwords don’t match.');
        return;
      }
      mutate('/auth/change-password', values);
    } else if (type === 'account')
      mutate(
        `/admin/accounts/${dialog.account.id}`,
        { is_active: !dialog.account.is_active },
        'PATCH',
      );
    else mutate(`/employee/apply-${type}`, values);
  }
  function decide(item, decision) {
    if (decision === 'reject') openDialog({ type: 'reject', request: item });
    else mutate(`/admin/requests/${item.id}/approve`, {});
  }
  const employees = data?.attendance || [];
  const requests = data?.requests || [];
  const pending = requests.filter((r) => r.status === 'pending');
  const present = employees.filter(
    (e) => e.clock_in_status === 'Clocked In',
  ).length;
  const heading =
    !admin && tab === 'overview'
      ? [
          `Shift station / ${data?.name?.split(' ')[0] || 'Operator'}`,
          'Check your assignment, record attendance, and manage shift requests.',
        ]
      : titles[tab];
  const nav = [
    {
      id: 'overview',
      label: admin ? 'Control room' : 'Shift station',
      icon: PlantIcon,
    },
    ...(admin ? [{ id: 'team', label: 'Crew roster', icon: CrewIcon }] : []),
    {
      id: 'requests',
      label: 'Approvals',
      icon: WorkOrderIcon,
      count: pending.length,
    },
    ...(admin
      ? [{ id: 'activity', label: 'Operations log', icon: LogbookIcon }]
      : []),
  ];
  return (
    <div className="workspace">
      <header className="control-masthead">
        <Brand />
        <div className="facility-label">
          <PlantIcon />
          <div>
            <strong>FACTORY OPERATIONS</strong>
            <span>{admin ? 'Workforce command' : 'Operator terminal'}</span>
          </div>
        </div>
        <div className="control-operator">
          <span
            className={`connection ${connection === 'live' ? 'live' : ''}`}
            title={
              connection === 'live'
                ? 'Connected to live workforce updates'
                : 'Refreshes every 30 seconds'
            }
          >
            <i />
            {connection === 'live'
              ? 'CONNECTED'
              : connection === 'connecting'
                ? 'CONNECTING'
                : 'AUTO REFRESH'}
          </span>
          <Avatar name={me?.name || 'Operator'} size="small" />
          <div>
            <strong>{me?.name || 'Operator'}</strong>
            <small>
              {me?.staff_id || 'Authenticating…'} / {admin ? 'ADMIN' : 'CREW'}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => logout().catch(() => {})}
          >
            <FiLogOut />
          </button>
        </div>
      </header>
      <div className="control-navigation">
        <nav aria-label="Main navigation">
          {nav.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              className={`nav ${tab === id ? 'active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                setTab(id);
                setError('');
              }}
            >
              <Icon />
              <span>{label}</span>
              {count > 0 && <span className="nav-count">{count}</span>}
            </button>
          ))}
        </nav>
        <div className="control-tools">
          <button
            className={`icon-button ${tab === 'settings' ? 'selected' : ''}`}
            aria-label="Settings & account"
            title="Settings & account"
            onClick={() => setTab('settings')}
          >
            <AccessIcon />
          </button>
          <button
            className="icon-button"
            aria-label="Operating guide"
            title="Operating guide"
            onClick={() => setHelp(true)}
          >
            <FiHelpCircle />
          </button>
          <span className="control-date">
            <FiCalendar />
            {new Intl.DateTimeFormat('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }).format(new Date())}
          </span>
        </div>
      </div>
      <main className="main">
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {new Intl.DateTimeFormat('en', { weekday: 'long' })
                  .format(new Date())
                  .toUpperCase()}{' '}
                · {admin ? 'CONTROL / WORKFORCE' : 'TERMINAL / ATTENDANCE'}
              </p>
              <h1>{heading[0]}</h1>
              <p>{heading[1]}</p>
            </div>
            <div className="heading-actions">
              <button
                className="icon-button refresh-button"
                onClick={load}
                aria-label="Refresh workspace"
                title="Refresh workspace"
              >
                <FiRefreshCw />
              </button>
              {admin && ['overview', 'team'].includes(tab) && (
                <button onClick={() => openDialog({ type: 'create' })}>
                  <CrewIcon /> Add crew member
                </button>
              )}
              {!admin && tab === 'requests' && (
                <button onClick={() => openDialog({ type: 'overtime' })}>
                  <ShiftIcon /> Request overtime
                </button>
              )}
            </div>
          </div>
          <Feedback error message={loadError} />
          <Feedback
            error
            message={!dialog ? error : ''}
            onClose={() => setError('')}
          />
          <Feedback message={notice} onClose={() => setNotice('')} />
          {!data ? (
            <div className="loading-layout" aria-busy={!loadError}>
              <div className="stats">
                {[0, 1, 2, 3].map((i) => (
                  <div className="stat skeleton" key={i} />
                ))}
              </div>
              <section className="panel">
                <Empty
                  title={
                    loadError
                      ? 'We couldn’t load your workspace'
                      : 'Loading workforce signals…'
                  }
                  action={
                    loadError && (
                      <button className="secondary" onClick={load}>
                        <FiRefreshCw /> Try again
                      </button>
                    )
                  }
                >
                  {loadError
                    ? 'Your data is safe. Check the connection and try again.'
                    : 'Retrieving roster, attendance, and approval records.'}
                </Empty>
              </section>
            </div>
          ) : (
            <>
              {['overview', 'team'].includes(tab) && (
                <div className="stats">
                  {admin ? (
                    <>
                      <Stat
                        label="Registered crew"
                        value={employees.length}
                        hint="Personnel in the workforce roster"
                        icon={CrewIcon}
                      />
                      <Stat
                        label="On shift now"
                        value={present}
                        hint={`${employees.length - present} currently off shift`}
                        icon={PowerIcon}
                        tone="sage"
                      />
                      <Stat
                        label="Pending approvals"
                        value={pending.length}
                        hint="Leave & overtime requests"
                        icon={WorkOrderIcon}
                        tone="sand"
                      />
                      <Stat
                        label="Approved overtime"
                        value={
                          <>
                            {employees
                              .reduce((sum, e) => sum + e.overtime_hours, 0)
                              .toFixed(1)}
                            <em> hrs</em>
                          </>
                        }
                        hint="Total approved hours"
                        icon={ShiftIcon}
                        tone="lavender"
                      />
                    </>
                  ) : (
                    <>
                      <Stat
                        label="Your leave balance"
                        value={
                          <>
                            {data.leave_days}
                            <em> days</em>
                          </>
                        }
                        hint="Available calendar-day allowance"
                        icon={WorkOrderIcon}
                      />
                      <Stat
                        label="Your attendance"
                        value={
                          data.clock_in_status === 'Clocked In'
                            ? 'On shift'
                            : 'Off shift'
                        }
                        hint={data.machine_line || 'Machine line unassigned'}
                        icon={PowerIcon}
                        tone="sage"
                      />
                      <Stat
                        label="Awaiting a decision"
                        value={pending.length}
                        hint="Submitted for administrator review"
                        icon={ShiftIcon}
                        tone="sand"
                      />
                      <Stat
                        label="Approved overtime"
                        value={
                          <>
                            {data.overtime_hours.toFixed(1)}
                            <em> hrs</em>
                          </>
                        }
                        hint="Total approved hours"
                        icon={PulseIcon}
                        tone="lavender"
                      />
                    </>
                  )}
                </div>
              )}
              {tab === 'overview' &&
                (admin ? (
                  <AdminOverview
                    data={data}
                    setTab={setTab}
                    onDecision={decide}
                    busy={busy}
                  />
                ) : (
                  <EmployeeOverview
                    data={data}
                    setTab={setTab}
                    openDialog={openDialog}
                    mutate={mutate}
                    busy={busy}
                  />
                ))}
              {tab === 'team' && admin && (
                <TeamDirectory employees={employees} openDialog={openDialog} />
              )}
              {tab === 'requests' && (
                <Requests
                  requests={requests}
                  admin={admin}
                  onDecision={decide}
                  busy={busy}
                  openDialog={openDialog}
                />
              )}
              {tab === 'activity' && admin && (
                <section className="panel full-activity">
                  <PanelHeading
                    title="Every action has a story"
                    subtitle="Account, attendance, and request events recorded by the server."
                    action={
                      <span className="count">
                        {activity?.total || 0} events
                      </span>
                    }
                  />
                  <ActivityList events={activity?.events || []} />
                  <div className="table-footer">
                    <span>
                      Page {page} of {Math.max(1, activity?.pages || 1)}
                    </span>
                    <div className="pagination">
                      <button
                        className="icon-button"
                        aria-label="Previous page"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        <FiChevronLeft />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Next page"
                        disabled={!activity || page >= activity.pages}
                        onClick={() => setPage(page + 1)}
                      >
                        <FiChevronRight />
                      </button>
                    </div>
                  </div>
                </section>
              )}
              {tab === 'settings' && (
                <div className="settings-layout">
                  <section className="panel account-card">
                    <PanelHeading
                      title="Operator account"
                      subtitle="Staff identity and workspace credentials."
                    />
                    <div className="account-identity">
                      <Avatar name={me?.name} size="large" />
                      <div>
                        <h3>{me?.name}</h3>
                        <p>{me?.email}</p>
                        <span className="status positive">{me?.role}</span>
                      </div>
                    </div>
                    <dl className="employment-details">
                      <div>
                        <dt>Staff ID</dt>
                        <dd>{me?.staff_id}</dd>
                      </div>
                      <div>
                        <dt>Workspace</dt>
                        <dd>Factory people operations</dd>
                      </div>
                    </dl>
                  </section>
                  <section className="panel security-card">
                    <span className="security-symbol">
                      <AccessIcon />
                    </span>
                    <h2>Account protection</h2>
                    <p>
                      Use a strong, unique password. Updating it signs you out
                      on every device.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => openDialog({ type: 'password' })}
                    >
                      Change my password <FiArrowRight />
                    </button>
                    <small>
                      Sessions expire after 30 minutes. Sign out when using a
                      shared device.
                    </small>
                  </section>
                  {admin && (
                    <section className="panel accounts-panel">
                      <PanelHeading
                        title="Workspace access"
                        subtitle="Deactivate accounts to revoke access immediately."
                      />
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Account</th>
                              <th>Role</th>
                              <th>Access</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accounts.map((account) => (
                              <tr key={account.id}>
                                <td>
                                  <strong>{account.staff_id}</strong>
                                  <small>{account.email}</small>
                                </td>
                                <td className="capitalize">{account.role}</td>
                                <td>
                                  <Status
                                    value={
                                      account.is_active ? 'Active' : 'Inactive'
                                    }
                                  />
                                </td>
                                <td>
                                  {account.id === me?.id ? (
                                    <span className="muted">
                                      Operator account
                                    </span>
                                  ) : (
                                    <button
                                      className={`text-button ${account.is_active ? 'danger' : ''}`}
                                      onClick={() =>
                                        openDialog({ type: 'account', account })
                                      }
                                    >
                                      {account.is_active
                                        ? 'Deactivate'
                                        : 'Activate'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
          <footer>
            <Brand compact />
            <span>WORKFORCE SYSTEM / FACTORY CONTROL</span>
            <span>ATTENDANCE · CREW · SHIFT COORDINATION</span>
          </footer>
        </div>
      </main>
      {dialog && (
        <Modal
          title={dialogTitles[dialog.type]}
          onClose={closeDialog}
          busy={busy}
        >
          <form onSubmit={submit}>
            <Feedback error message={error} />
            {['create', 'edit'].includes(dialog.type) && (
              <>
                <p className="dialog-description">
                  {dialog.type === 'create'
                    ? 'A warm welcome starts with the essentials. Share their staff ID privately once their account is ready.'
                    : `Update ${dialog.employee.name}’s details. Changes are saved to the activity log.`}
                </p>
                <Field
                  autoFocus
                  label="Full name"
                  name="name"
                  required
                  maxLength={150}
                  defaultValue={dialog.employee?.name || ''}
                />
                {dialog.type === 'create' && (
                  <>
                    <Field
                      label="Work email"
                      name="email"
                      type="email"
                      required
                      maxLength={150}
                    />
                    <div className="form-columns">
                      <Field
                        label="Staff ID"
                        name="staff_id"
                        maxLength={50}
                        hint="Leave blank to generate one."
                      />
                      <label>
                        Account role
                        <select name="role" defaultValue="employee">
                          <option value="employee">Employee</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </label>
                    </div>
                    <Field
                      label="Temporary password"
                      name="password"
                      type="password"
                      required
                      minLength={12}
                      maxLength={72}
                      autoComplete="new-password"
                      hint="At least 12 characters. Ask them to change it after signing in."
                    />
                  </>
                )}
                <Field
                  label="Machine line"
                  name="machine_line"
                  maxLength={150}
                  defaultValue={dialog.employee?.machine_line || ''}
                />
                <label>
                  Contract details
                  <textarea
                    name="contract_details"
                    maxLength={5000}
                    defaultValue={dialog.employee?.contract_details || ''}
                  />
                </label>
              </>
            )}
            {dialog.type === 'warning' && (
              <>
                <p className="dialog-description">
                  Notes are visible to {dialog.employee.name}. Keep them clear,
                  specific, and constructive.
                </p>
                {dialog.employee.warnings.length > 0 && (
                  <div className="existing-warnings">
                    {dialog.employee.warnings.map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                  </div>
                )}
                <label>
                  Warning details
                  <textarea name="warning" required maxLength={500} autoFocus />
                </label>
              </>
            )}
            {dialog.type === 'reject' && (
              <>
                <p className="dialog-description">
                  Let {dialog.request.name} know why this request couldn’t be
                  approved.
                </p>
                <label>
                  Decision note
                  <textarea
                    name="reason"
                    required
                    maxLength={500}
                    autoFocus
                    placeholder="Add a helpful explanation…"
                  />
                </label>
              </>
            )}
            {['leave', 'overtime'].includes(dialog.type) && (
              <>
                <p className="dialog-description">
                  {dialog.type === 'leave'
                    ? `One day at a time. You have ${data?.leave_days || 0} days available; one day is reserved when approved.`
                    : 'Let your administrator know when you’d like to work extra hours.'}
                </p>
                <Field
                  label="Request date"
                  name={`${dialog.type}_date`}
                  type="date"
                  min={localDate()}
                  required
                  autoFocus
                />
                {dialog.type === 'overtime' && (
                  <Field
                    label="Number of hours"
                    name="overtime_hours"
                    type="number"
                    min="0.25"
                    max="16"
                    step="0.25"
                    required
                    hint="Up to 16 hours. Subject to administrator approval."
                  />
                )}
              </>
            )}
            {dialog.type === 'password' && (
              <>
                <p className="dialog-description">
                  Choose a password of at least 12 characters. A memorable
                  phrase works well.
                </p>
                <Field
                  label="Current password"
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={72}
                  autoFocus
                />
                <Field
                  label="New password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={72}
                  required
                />
                <Field
                  label="Confirm new password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={72}
                  required
                />
              </>
            )}
            {dialog.type === 'account' && (
              <p className="dialog-description">
                {dialog.account.is_active
                  ? `Deactivate ${dialog.account.staff_id}? They will lose access immediately and all existing sessions will be invalidated.`
                  : `Restore access for ${dialog.account.staff_id}? They will be able to sign in with their password again.`}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={closeDialog}
              >
                Cancel
              </button>
              <button disabled={busy}>
                {busy
                  ? 'Saving…'
                  : dialog.type === 'create'
                    ? 'Add team member'
                    : ['leave', 'overtime'].includes(dialog.type)
                      ? 'Submit request'
                      : 'Save changes'}
                <FiArrowRight />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {help && (
        <Modal
          title="Control room / operating guide"
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            <h3>Start and finish your shift</h3>
            <p>
              Employees clock in and out from My working day. Signing in does
              not start a shift.
            </p>
            <h3>Make a request</h3>
            <p>
              Choose a date for one day of leave or specify overtime hours.
              Requests are saved and can be tracked under Requests. One request
              of each type is allowed per date.
            </p>
            <h3>Keep everyone in the loop</h3>
            <p>
              Administrators review requests and leave a note when rejecting.
              Approved leave reserves a day immediately. Overtime totals show
              approved hours, not hours measured on shift.
            </p>
            <h3>Need account access?</h3>
            <p>
              Use Forgot password on the sign-in screen. If your workplace
              hasn’t configured email, ask an administrator to issue a recovery
              link.
            </p>
            <button onClick={() => setHelp(false)}>
              Got it <FiCheckCircle />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
