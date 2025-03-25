import React, { useEffect, useState } from 'react';
import { Modal, Button, Badge } from 'react-bootstrap';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { io } from 'socket.io-client';


const EmployeeProfile = () => {
  const [profile, setProfile] = useState({
    staff_id: '',
    name: '',
    clock_in_status: '',
    machine_line: '',
    leave_days: 0,
    warnings_count: 0,
    warnings_details: [],
    contract_details: '',
    overtime_hours: 0.0,
  });

  const [showWarningsModal, setShowWarningsModal] = useState(false);
  const [showLeaveCalendar, setShowLeaveCalendar] = useState(false);
  const [showOvertimeCalendar, setShowOvertimeCalendar] = useState(false);
  const [selectedLeaveDate, setSelectedLeaveDate] = useState(null);
  const [selectedOvertimeDate, setSelectedOvertimeDate] = useState(null);
  const [rejectionMessage, setRejectionMessage] = useState(null);

  const getAuthToken = () => {
    const employeeToken = localStorage.getItem("employee_token");
    const employeeRole = localStorage.getItem("employee_role");
  
    if (employeeToken && employeeRole === "employee") {
      return employeeToken;
    } else {
      return null; 
    }
  };

  const eToken = getAuthToken();

  useEffect(() => {
    fetch('http://localhost:5000/employee/profile', {
      headers: { Authorization: `Bearer ${eToken}` },
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => setProfile(data))
      .catch((err) => console.error("Fetch error:", err));
  }, []);
  
  
  useEffect(() => {
    const socket = io('http://localhost:5000');
    socket.on('leave_approved', (data) => {
      alert(`Leave approved for ${data.name} on ${data.leave_date}`);
    });

    socket.on('leave_rejected', (data) => {
      setRejectionMessage(`Leave request rejected: ${data.reason}`);
    });

    socket.on('overtime_approved', (data) => {
      alert(`Overtime approved for ${data.name}, ${data.overtime_hours} extra hours`);
    });

    socket.on('overtime_rejected', (data) => {
      setRejectionMessage(`Overtime request rejected: ${data.reason}`);
    });
    return () => {
      socket.off('leave_approved');
      socket.off('leave_rejected');
      socket.off('overtime_approved');
      socket.off('overtime_rejected');
    };
  }, []);

  const handleLeaveSubmit = () => {
    fetch('http://localhost:5000/employee/apply-leave', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${eToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ leave_date: selectedLeaveDate }),
    })
      .then((response) => response.json())
      .then((data) => {
        alert(data.message);
        setShowLeaveCalendar(false);
      })
      .catch((err) => console.error(err));
  };

  const handleOvertimeSubmit = () => {
    fetch('http://localhost:5000/employee/apply-overtime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${eToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ overtime_date: selectedOvertimeDate }),
    })
      .then((response) => response.json())
      .then((data) => {
        alert(data.message);
        setShowOvertimeCalendar(false);
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className="employee-profile">
      <div className="profile-card">
      <div className='profile'>
        <div className="profile-header">
          <img
            src="https://banner2.cleanpng.com/20180622/tqt/aazen4lhc.webp"
            alt="Profile Icon"
            className="profile-image"
          />
          
          <div className="profile-info">
            <h1>{profile.name}</h1>
            <p>Staff ID: {profile.staff_id}</p>
          </div>
        

        <div className="profile-details">
          <h2>Details</h2>
          <p><strong>Clock-In Status:</strong> {profile.clock_in_status}</p>
          <p><strong>Machine Line:</strong> {profile.machine_line || 'Not Assigned'}</p>
          <p><strong>Overtime Hours:</strong> {profile.overtime_hours} hours this month</p>
        </div>

        <div className="profile-actions">
          <div>
            <h2>Leave Days</h2>
            <p>Remaining: {profile.leave_days} days</p>
            <Button onClick={() => setShowLeaveCalendar(true)}>Request Leave</Button>
          </div>

          <div>
            <h2>Warnings</h2>
            <p>You have <Badge bg="danger">{profile.warnings_count || 0} </Badge> warnings</p>
            <Button onClick={() => setShowWarningsModal(true)}>View Warnings</Button>
          </div>

          <div>
            <h2>Overtime</h2>
            <Button onClick={() => setShowOvertimeCalendar(true)}>Apply for Overtime</Button>
          </div>
        </div>
      </div>

      {rejectionMessage && <p className="rejection-message">{rejectionMessage}</p>}

      {/* Warnings Modal */}
      <Modal show={showWarningsModal} onHide={() => setShowWarningsModal(false)}>
        <Modal.Header>
          <Modal.Title>Warning Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {profile.warnings_count > 0 ? (
            profile.warnings_details.map((warning, index) => (
              <div key={index} className="warning-item">
                <p>{warning}</p>
              </div>
            ))
          ) : (
            <p>No warnings to display</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowWarningsModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Leave Calendar Modal */}
      <Modal show={showLeaveCalendar} onHide={() => setShowLeaveCalendar(false)}>
        <Modal.Header >
          <Modal.Title>Select Leave Day</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Calendar onChange={setSelectedLeaveDate} value={selectedLeaveDate} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={handleLeaveSubmit}>Submit</Button>
          <Button variant="primary" onClick={() => setShowLeaveCalendar(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Overtime Calendar Modal */}
      <Modal show={showOvertimeCalendar} onHide={() => setShowOvertimeCalendar(false)}>
        <Modal.Header>
          <Modal.Title>Select Overtime Day</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Calendar onChange={setSelectedOvertimeDate} value={selectedOvertimeDate} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={handleOvertimeSubmit}>Submit</Button>
          <Button variant="primary" onClick={() => setShowOvertimeCalendar(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
    </div>
    </div>
  );
};

export default EmployeeProfile;
