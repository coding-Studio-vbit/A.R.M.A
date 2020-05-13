import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import logo from "../images/logo.png";

const FacultyLogin = () => {
  const [password, setPassword] = useState("");
  const [rollNo, setRollNo] = useState("");

  const stutt = () => {
    axios
      .post("/loginFaculty", {
        user: {
          faculty_roll: rollNo,
          password: password,
        },
      })
      .then((res) => console.log(res))
      .catch((err) => console.log(err));
  };
  const isEnabled = password.length > 0 && rollNo.length >= 10;
  return (
    <div className="mine">
      <img src={logo} alt="logo" style={{ width: "150px", height: "150px" }} />
      <br />
      <h1> A.R.M.A Faculty Login </h1>
      <div style={{ marginTop: 20 }}></div>
      <div style={{ marginTop: 20 }}></div>
      <form>
        <div className="form-group">
          <label for="InputRollNo">Roll Number</label>
          <input
            type="text"
            className="form-control"
            id="InputRollNo"
            placeholder="Roll Number"
            onChange={(e) => setRollNo(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label for="InputPassword1">Password</label>
          <input
            type="password"
            className="form-control"
            id="InputPassword1"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <br />
        <button
          type="button"
          disabled={!isEnabled}
          className="btn btn-primary"
          onClick={stutt}
        >
          Login
        </button>
      </form>
      <br />
      <Link to={"/register"} style={{ display: "block", marginTop: 20 }}>
        Go To Faculty Registration Page
      </Link>
    </div>
  );
};

export default FacultyLogin;