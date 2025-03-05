import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import "react-datepicker/dist/react-datepicker.css";

const AdminDashboard = () => {
  const socketRef = useRef();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    role: "employee",
    password: "",
    staff_id: "",
  });
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [selectedEmployee, setSelectedEmployee] = useState(null); 
  const [warningText, setWarningText] = useState(''); 

  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => {
        setMessage(""); 
      }, 3000);
      return () => clearTimeout(timeout); 
    }
  }, [message]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch("https://localhost:5000/admin/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        setEmployees(data.attendance);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching employees:", err);
        setLoading(false);
      });

    // Initialize socket connection
    socketRef.current = io("https://localhost:5000/", {
      query: { token },
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socketRef.current.on("employee_created", (data) => {
      setEmployees((prevEmployees) => {
        return [...prevEmployees, data.attendance];
      });
    });

    socketRef.current.on("employee_clocked_in", (data) => {
      setMessage(`${data.name} has clocked in.`);
      setEmployees((prevEmployees) =>
        prevEmployees.map((emp) =>
          emp.id === data.id
            ? { ...emp, clock_in_status: "Clocked In" }
            : emp
        )
      );
    });

    return () => {
      if (socketRef.current.connected) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleEditField = (id, field, value) => {
    const token = localStorage.getItem("token");

    fetch(`https://localhost:5000/employee/${id}/edit`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ [field]: value }),
    })
      .then((response) => response.json())
      .then((data) => {
        setMessage(data.message);
        setEmployees((prev) =>
          prev.map((emp) => (emp.id === id ? { ...emp, [field]: value } : emp))
        );
      })
      .catch((err) => console.error("Error editing employee:", err));
  };

  const handleAddEmployee = () => {
    const token = localStorage.getItem("token");
    fetch("https://localhost:5000/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newEmployee),
    })
      .then((response) => response.json())
      .then((data) => {
        setMessage(data.message);
        setNewEmployee({ name: "", email: "", role: "employee", password: "", staff_id: "", machine_line: "" });
        setShowAddEmployeeForm(false);
      })
      .catch((err) => console.error("Error creating employee:", err));
  };

  const handleAddWarning = (empId) => {
    const token = localStorage.getItem("token");

    if (!warningText.trim()) {
      setMessage("Warning text cannot be empty");
      return;
    }

    fetch(`https://localhost:5000/${empId}/add-warning`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ warning: warningText }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message === "Warning added successfully!") {
          setEmployees((prevEmployees) =>
            prevEmployees.map((emp) =>
              emp.id === empId ? { ...emp, warnings: data.warnings } : emp
            )
          );
          setMessage(data.message);
          setIsModalOpen(false); 
          setWarningText('');
        } else {
          setMessage(data.message);
        }
      })
      .catch((err) => console.error("Error adding warning:", err));
  };
  

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Admin Dashboard</h1>
  
      <button
        className="add-employee-button"
        onClick={() => setShowAddEmployeeForm(true)}
      >
        Add New Employee
      </button>
  
      <p className={`message ${!message && 'hidden'}`}>{message}</p>
  
      {loading ? (
        <p>Loading employees...</p>
      ) : (
        <div className="employee-list">
          <div className="employee-header-row">
            <div className="employee-header-cell">Staff ID</div>
            <div className="employee-header-cell">Name</div>
            <div className="employee-header-cell">Machine Line</div>
            <div className="employee-header-cell">Days</div>
            <div className="employee-header-cell">Clock-In</div>
            <div className="employee-header-cell">Overtime Hours</div>
            <div className="employee-header-cell">Warnings</div>
            <div className="employee-header-cell">Contract Details</div>
          </div>
          {employees.map((emp, index) => (
            <div
              key={emp.staff_id}
              className={`employee-row ${index % 2 === 0 ? 'even-row' : 'odd-row'}`}
            >
              <div className="employee-cell">{emp.staff_id}</div>
              <div className="employee-cell employee-name">
                <input
                  type="text"
                  value={emp.name}
                  onChange={(e) =>
                    handleEditField(emp.id, 'name', e.target.value)
                  }
                />
              </div>
              <div className="employee-cell">
                <input
                  type="text"
                  value={emp.machine_line || ''}
                  onChange={(e) =>
                    handleEditField(emp.id, 'machine_line', e.target.value)
                  }
                />
              </div>
              <div className="employee-cell">
              <div className="employee-cell">{emp.day}</div>
              </div>
              <div className="employee-cell">{emp.clock_in_status}</div>
              <div className="employee-cell">{emp.overtime_hours}</div>
              <div className="employee-cell">
                <button onClick={() => {
                  setSelectedEmployee(emp);
                  setIsModalOpen(true);
                }}>
                {emp.warnings ? emp.warnings.length : 0}
                </button>
              </div>
              <div className="employee-cell">
                <input
                  type="text"
                  value={emp.contract_details || ''}
                  onChange={(e) =>
                    handleEditField(emp.id, 'contract_details', e.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
  
      {showAddEmployeeForm && (
        <div className="add-employee-form">
          <h2>Add New Employee</h2>
          <input
            type="text"
            placeholder="Employee Name"
            value={newEmployee.name}
            onChange={(e) =>
              setNewEmployee({ ...newEmployee, name: e.target.value })
            }
          />
          <input
            type="email"
            placeholder="Employee Email"
            value={newEmployee.email}
            onChange={(e) =>
              setNewEmployee({ ...newEmployee, email: e.target.value })
            }
          />
          <input
            type="password"
            placeholder="Password"
            value={newEmployee.password}
            onChange={(e) =>
              setNewEmployee({ ...newEmployee, password: e.target.value })
            }
          />
          <select
            value={newEmployee.role}
            onChange={(e) =>
              setNewEmployee({ ...newEmployee, role: e.target.value })
            }
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
          {newEmployee.role === 'employee' && (
            <input
              type="text"
              placeholder="Machine Line"
              value={newEmployee.machine_line}
              onChange={(e) =>
                setNewEmployee({ ...newEmployee, machine_line: e.target.value })
              }
            />
          )}
          <button onClick={handleAddEmployee}>Submit</button>
          <button onClick={() => setShowAddEmployeeForm(false)}>
            Cancel
          </button>
        </div>
      )}

      {/* Warning Modal */}
      {isModalOpen && selectedEmployee && (
        <div className="modal">
          <h3>Add Warning for {selectedEmployee.name}</h3>
          <textarea
            value={warningText}
            onChange={(e) => setWarningText(e.target.value)}
            placeholder="Enter warning text here"
          />
          <button
            onClick={() => handleAddWarning(selectedEmployee.id)}
          >
            Add Warning
          </button>
          <button onClick={() => setIsModalOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
