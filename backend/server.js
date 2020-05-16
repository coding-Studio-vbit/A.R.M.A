require("dotenv").config();
const express = require("express");
const path = require("path");
const body_parser = require("body-parser");
const users = require("./node/users.js");
const dataValidator = require("./node/dataValidator.js");
const mailSender = require("./node/mail-sender.js");
const fs = require("fs");
const port_number = process.env.PORT || 8080; //PORT SPECIFIED IN THE .env file
const app = express();
const pool = require("./db");
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}

//express configuration
app.use(express.static(path.join(__dirname, "/public")));
app.use(body_parser.json());
app.use(body_parser.urlencoded({ extended: false }));
app.use(allowCrossDomain);

//LOGIN

app.post("/login", (req, res) => {
  //check password.
  try {
    users
      .checkForumPassword(
        req.body.user.username,
        req.body.user.password,
        (err, status) => {
          if (err) {
            console.log(err);
            return res.status(401).send({ message: err });
          } else if (status == true) {
            const accessToken = users.generateAccessToken(
              req.body.user.username,
              process.env.SECRET_ACCESS_TOKEN
            );

            res.send({ message: ("USERNAME: "+req.body.user.username), accessToken: accessToken });
            console.log("token: " + accessToken);
            var obj = fs.readFileSync("./validkeys.json");
            obj = obj.toString();
            obj = JSON.parse(obj);

            //create a new property with the username with the value as an object and the user type

            obj[req.body.user.username] = {
              accessToken: accessToken,
              userType: "FORUM",
            };

            //save the data.
            fs.writeFileSync("validkeys.json", JSON.stringify(obj));
          } else {
            return res.send({ message: "Invalid Password" }); //password wrong, return UNAUTHORIZED.
          }
        }
      )
      .catch((error) => {
        console.log(error);
        res.status(500).send("Internal Server Error");
      });
  } catch (err) {
    res.status(400).json({ message: "BAD REQUEST" });
  }
});

//Faculty Login

app.post("/loginFaculty", (req, res) => {
  //check password.
  try {
    //for loginFaculty the faculty_roll property is sent instead of the username property

    users
      .checkFacultyPassword(
        req.body.user.faculty_roll,
        req.body.user.password,
        (err, status) => {
          if (err) {
            console.log(err);
            return res.status(401).send({ message: err });
          } else if (status == true) {
            const accessToken = users.generateAccessToken(
              req.body.user.faculty_roll,
              process.env.SECRET_ACCESS_TOKEN
            );
            res.send({ message: "USERNAME: "+req.body.user.faculty_roll, accessToken: accessToken });
            console.log("token: " + accessToken);
            var obj = fs.readFileSync("./validkeys.json");
            obj = obj.toString();
            obj = JSON.parse(obj);

            obj[req.body.user.faculty_roll] = {
              accessToken: accessToken,
              userType: "FACULTY",
            };

            //save the data.
            fs.writeFileSync("validkeys.json", JSON.stringify(obj));
          } else {
            return res.status(401).send({ message: "Invalid Password" }); //password wrong, return UNAUTHORIZED.
          }
        }
      )
      .catch((error) => {
        console.log(error);
        res.status(500).send("Internal Server Error");
      });
  } catch (err) {
    res.status(400).json({ message: "BAD REQUEST" });
  }
});

//LOGOUT
// logout is same for both faculty and forums.

app.post("/logout", (req, res) => {
  //if check token, remove the token from validkeys.json and redirect to login page.
  //For logout the request should have both the username and the access token.

  try {
    users.fetchAccessToken(req, (err, token) => {
      if (err) return res.status(400).json({ message: err });

      const username = req.body.user.username; //get the username

      if (!username || !token) {
        return res
          .status(400)
          .json({ message: "username or token unspecified!" });
      }
      var obj = fs.readFileSync("validkeys.json");
      obj = JSON.parse(obj.toString());
      if (obj.hasOwnProperty(username) && obj[username].accessToken == token) {
        //if the username has an entry in the validkeys.json and the token is also a match then allow logout.
        delete obj[req.body.user.username];
      } else
        return res
          .status(401)
          .send({ message: "CANNOT LOGOUT WITHOUT LOGIN!" }); //UNAUTHORIZED. Can't logout without login.
      res.send({ message: "LOGOUT SUCCESSFUL!" });
      //save the file.
      fs.writeFileSync("validkeys.json", JSON.stringify(obj));
    });
  } catch (err) {
    res.status(400).json({ message: "BAD REQUEST" });
  }
});

//DASHBOARD ( TESTING )

app.get("/dashboard", async(req, res) => {
  try {
    console.log(req.body);
    const data = await pool.query("select forum_id,forum_name,subject,status from requests where request_id in (select request_id from recipients where faculty_id=2)");
    res.json(data.rows);
  } catch (err) {
    console.log(err.message);
  }
});

//REGISTRATION STATUS CHECK

app.post("/checkRegistrationStatus", (req, res) => {
  try {
    const queryUsername = req.body.query.username;
    if (!queryUsername) {
      return res.status(400).json({ message: "Username unspecified in query" });
    } else {
      users.checkRegistrationStatus(queryUsername, (err, state) => {
        if (err)
          return res.status(500).json({ message: "Internal Server Error" });
        else return res.json({ message: state });
      });
    }
  } catch (err) {
    return res.status(400).json({ message: "BAed REeKset" });
  }
});
//REGISTRATION STATUS CHECK FOR FACULTY

app.post("/checkFacultyRegistrationStatus", (req, res) => {
  try {
    const queryUsername = req.body.query.faculty_roll;
    if (!queryUsername) {
      return res.status(400).json({ message: "Username unspecified in query" });
    } else {
      users.checkFacultyRegistrationStatus(queryUsername, (err, state) => {
        if (err)
          return res.status(500).json({ message: "Internal Server Error" });
        else return res.json({ message: state });
      });
    }
  } catch (err) {
    return res.status(400).json({ message: "Bad Request" });
  }
});

//REGISTER FORUM REQUEST

app.post("/registerForum", (req, res) => {
  try {
    const data = req.body.registrationData;
    if (!data)
      return res.status(400).json({ message: "No registration data found!" });
    else
      dataValidator.validateRegistrationData(data, (err, ok) => {
        if (err) return res.json({ message: "Invalid Data!", errors: err });
        else {
          //check if user is already registered.

          users.checkRegistrationStatus(data.username, (err, state) => {
            if (err)
              return res
                .status(500)
                .json({ message: "Internal Server Database error!" });
            else if (state == true)
              res.json({ message: "User has already registered" });
            else {
              res.json({ message: "response recorded" });
              mailSender.sendMail(
                "Registration Notification",
                "Your Request has been recorded.You will be contacted shortly.",
                data.email,
                (err, res) => {
                  if (err) {
                    return console.log(
                      { message: "Error sending email to user." },
                      err
                    );
                  }
                }
              );

              mailSender.sendMail(
                "Registration Request",
                JSON.stringify(data),
                process.env.USERMAIL,
                (err, res) => {
                  if (err) {
                    return console.log(
                      { message: "Error sending email to self." },
                      err
                    );
                  }
                }
              );

              //now create a new record in the registration request table.
              users.newForumRegistrationRequest(
                data.username,
                data.email,
                data.phone,
                (err, st) => {
                  if (err)
                    return console.log(
                      err,
                      "Error inserting forum registration request into table!"
                    );
                  return console.log(
                    "new forum registration request received!"
                  );
                }
              );
            }
          });
        }
      });
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: "BAD REQUEST!" });
  }
});

//REGISTER FACULTY REQUEST
app.post("/registerFaculty", (req, res) => {
  //console.log(req.body.registrationData);
  try {
    const data = req.body.registrationData;
    console.log(data);
    if (!data)
      return res.status(400).json({ message: "No registration data found!" });
    else
      dataValidator.validateFacultyRegistrationData(data, (err, ok) => {
        if (err) return res.json({ message: "Invalid Data!", errors: err });
        else {
          //check if user is already registered.

          users.checkFacultyRegistrationStatus(
            data.faculty_roll,
            (err, state) => {
              if (err)
                return res
                  .status(500)
                  .json({ message: "Internal Server Database error!" });
              else if (state == true)
                res.json({ message: "User has already registered" });
              else {
                res.json({ message: "response recorded" });
                mailSender.sendMail(
                  "Registration Notification",
                  "Your Request has been recorded.You will be contacted shortly.",
                  data.faculty_email,
                  (err, res) => {
                    if (err) {
                      return console.log(
                        { message: "Error sending email to user." },
                        err
                      );
                    }
                  }
                );

                //sending mail to self.
                mailSender.sendMail(
                  "Registration Request",
                  JSON.stringify(data),
                  process.env.USERMAIL,
                  (err, res) => {
                    if (err) {
                      return console.log({
                        message: "Error sending email to self.",
                      });
                    }
                  }
                );

                //now create a new record in the registration request table.
                users.newFacultyRegistrationRequest(
                  data.faculty_name,
                  data.faculty_dept,
                  data.faculty_roll,
                  data.faculty_email,
                  data.faculty_phone,
                  (err, st) => {
                    if (err)
                      return console.log(
                        err,
                        "Error inserting faculty registration request into table!"
                      );
                    return console.log(
                      "new faculty registration request received!"
                    );
                  }
                );
              }
            }
          );
        }
      });
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: "BAD REQUEST!" });
  }
});

//Get user type using Access Token.

app.post("/getUserType", (req, res) => {
  try {
    users.fetchAccessToken(req, (err, token) => {
      if (err) {
        return res.status(400).json({ message: "No token found!" });
      }
      users.authenticateToken(
        token,
        process.env.SECRET_ACCESS_TOKEN,
        (err, username) => {
          if (err) {
            return res.status(400).json(err);
          }
          var fileData = fs.readFileSync("validkeys.json");
          fileData = fileData.toString();
          fileData = JSON.parse(fileData);
          if (!fileData.hasOwnProperty(username)) {
            return res.status(400).json({ message: "User isnt Logged in!" });
          }
          const { userType } = fileData[username];
          return res.send({ userType: userType });
        }
      );
    });
  } catch (err) {
    res.status(500).json("Internal Server Error!");
    console.log(err);
  }
});

//-----------------------------------------------------------------------------------------------------------------------------------------//

//start the server.
app.listen(port_number, () => {
  console.log("server up and running on port:" + String(port_number));
});
