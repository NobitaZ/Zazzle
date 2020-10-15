const electron = require("electron");
const { ipcRenderer } = electron;
const app = electron.remote;
let username = document.querySelector("#username");
let password = document.querySelector("#password");
username.value = "123";
password.value = "123123";
let version = window.location.hash.substring(1);
username.focus();
document.getElementById("version").innerText = version;
document.querySelector("form").addEventListener("submit", submitForm);
function submitForm(e) {
    e.preventDefault();
    const items = {
        username: username.value,
        password: password.value,
    };

    console.log(ipcRenderer);
    ipcRenderer.send("auth-form", items);
}
const msgDiv = document.querySelector("#msg-cus");
msgDiv.innerHTML = "\n";
ipcRenderer.on("msg-login", function (e, item) {
    if (item == "user-failed") {
        msgDiv.className = "";
        username.value = "";
        password.value = "";
        username.focus();
        msgDiv.className += "alert alert-danger alert-dismissible show";
        msgDiv.innerHTML = "Incorrect Username";
    } else if (item == "pass-failed") {
        msgDiv.className = "";
        username.value = "";
        password.value = "";
        username.focus();
        msgDiv.className += "alert alert-danger alert-dismissible show";
        msgDiv.innerHTML = "Incorrect Password";
    }
});
ipcRenderer.on("db", function (e, item) {
    const version = document.querySelector(".version");
    const dbstatus = document.querySelector(".db-status");
    if (item == "connected") {
        dbstatus.innerHTML = "DB Connected";
    } else {
        dbstatus.innerHTML = "DB Error";
    }
});

ipcRenderer.on("appUpdate", function (event, text) {
    var container = document.querySelector(".msg-update");
    container.innerHTML = text;
});
