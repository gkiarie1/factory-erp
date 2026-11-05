import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { AuthContext } from './AuthProvider';
import { api } from '../api';
import TeamDirectory from './TeamDirectory';
import Requests from './Requests';

vi.mock('../api', () => ({ api: vi.fn() }));
const auth = { isAuthenticated: false, login: vi.fn(), clearSession: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
});
function loginView(mode) {
  return render(
    <React.StrictMode>
      <AuthContext.Provider value={auth}>
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Login mode={mode} />
        </MemoryRouter>
      </AuthContext.Provider>
    </React.StrictMode>,
  );
}

test('login submits credentials and shows server failures', async () => {
  api.mockRejectedValueOnce(new Error('Invalid staff ID or password.'));
  loginView('login');
  fireEvent.change(screen.getByLabelText('Staff ID'), {
    target: { value: 'EMP001' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'employee123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to workspace' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid staff ID or password.',
  );
  expect(api).toHaveBeenCalledWith('/login', {
    method: 'POST',
    body: { staff_id: 'EMP001', password: 'employee123' },
  });
  expect(auth.login).not.toHaveBeenCalled();
});

test('reset flow retains the token in StrictMode after removing it from the address bar', async () => {
  window.history.replaceState({}, '', '/reset-password?token=secret-token');
  api.mockResolvedValue({
    message: 'Password updated. Sign in with your new password.',
  });
  loginView('reset');
  expect(window.location.search).toBe('');
  fireEvent.change(screen.getByLabelText('New password', { exact: false }), {
    target: { value: 'my-long-new-password' },
  });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'my-long-new-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/auth/reset-password', {
      method: 'POST',
      body: { token: 'secret-token', password: 'my-long-new-password' },
    }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Password updated.',
  );
  expect(auth.clearSession).toHaveBeenCalled();
});

test('team search and attendance filters combine without losing employee actions', () => {
  const openDialog = vi.fn();
  const base = {
    email: 'team@example.test',
    machine_line: 'Assembly',
    overtime_hours: 2,
    leave_days: 14,
    warnings: [],
  };
  render(
    <TeamDirectory
      openDialog={openDialog}
      employees={[
        {
          ...base,
          id: 1,
          name: 'Jane Doe',
          staff_id: 'EMP001',
          clock_in_status: 'Clocked In',
        },
        {
          ...base,
          id: 2,
          name: 'John Smith',
          staff_id: 'EMP002',
          clock_in_status: 'Not Clocked In',
        },
      ]}
    />,
  );
  fireEvent.change(screen.getByLabelText('Filter attendance'), {
    target: { value: 'Clocked In' },
  });
  expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Jane Doe' }));
  expect(openDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'edit',
      employee: expect.objectContaining({ id: 1 }),
    }),
  );
  fireEvent.change(screen.getByLabelText('Search team'), {
    target: { value: 'nobody' },
  });
  expect(screen.getByText('No matches this time')).toBeInTheDocument();
});

test('request actions use request records and preserve review notes in history', () => {
  const onDecision = vi.fn();
  const request = {
    id: 8,
    employee_id: 3,
    name: 'Jane Doe',
    staff_id: 'EMP003',
    kind: 'leave',
    date: '2027-01-12',
    hours: 0,
    status: 'pending',
    reason: '',
  };
  render(
    <Requests
      requests={[
        request,
        { ...request, id: 9, status: 'rejected', reason: 'Coverage needed' },
      ]}
      admin
      onDecision={onDecision}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
  expect(onDecision).toHaveBeenCalledWith(request, 'approve');
  fireEvent.click(screen.getByRole('button', { name: /Rejected/i }));
  expect(screen.getByText('Coverage needed')).toBeInTheDocument();
});

test('control-room line modules reflect crew attendance and link to the roster', async () => {
  const { AdminOverview } = await import('./DashboardPanels');
  const setTab = vi.fn();
  render(
    <AdminOverview
      data={{
        attendance: [
          {
            name: 'Jane',
            machine_line: 'Assembly 01',
            clock_in_status: 'Clocked In',
          },
          {
            name: 'John',
            machine_line: 'Assembly 01',
            clock_in_status: 'Not Clocked In',
          },
          {
            name: 'Sam',
            machine_line: 'Packing 02',
            clock_in_status: 'Not Clocked In',
          },
        ],
        requests: [],
        activity: [],
      }}
      setTab={setTab}
      onDecision={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('img', { name: 'Assembly 01: 1 of 2 crew on shift' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: 'Packing 02: 0 of 1 crew on shift' }),
  ).toBeInTheDocument();
  expect(screen.getByText('33%')).toBeInTheDocument();
  expect(screen.getByText('No crew on shift')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open crew roster' }));
  expect(setTab).toHaveBeenCalledWith('team');
});
