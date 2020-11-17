const electron = require("electron").remote;
const stringify = require("csv-stringify");
const { dialog } = electron;
const { ipcRenderer } = require("electron");
const parseSync = require("csv-parse/lib/sync");
const path = require("path");
const fs = require("fs");

const infoPath =
  process.env.NODE_ENV === "development" ? "./data/info.csv" : path.join(process.resourcesPath, "data/info.csv");
let userArrJSON = fs.readFileSync(infoPath, "utf8");
let userAcc = parseSync(userArrJSON, {
  columns: true,
  skip_empty_lines: true,
});
let userArr = [];
userAcc.forEach((v) => {
  userArr.push(v.Account);
});
const btnImport = document.getElementById("btnImport");
btnImport.addEventListener("click", function (e) {
  e.preventDefault;
  const inpTextArea = document.querySelector("#import-area").value;
  if (inpTextArea == null || inpTextArea == "" || JSON.stringify(inpTextArea) == "{}") {
    const errMsgBox = dialog.showErrorBox("Account can not be empty !!!", "");
  } else {
    let columns = {
      account: "Account",
      password: "Password",
      proxy: "Proxy",
      proxyusername: "ProxyUsername",
      proxypassword: "ProxyPassword",
    };
    let textSplit = inpTextArea.split("\n");
    let data = [];
    for (let index = 0; index < textSplit.length; index++) {
      const row = textSplit[index].split("	");
      if (row != "") {
        if (typeof row[3] == "undefined" || typeof row[4] == "undefined") {
          row[3] = "";
          row[4] = "";
        }
        data.push(row);
      }
    }
    //filter duplicated accounts
    let dataOutput = data.filter((v) => {
      return !userArr.includes(v[0]);
    });
    stringify(dataOutput, function (err, output) {
      fs.writeFile(infoPath, output, { flag: "a" }, function (err) {
        if (err) {
          throw err;
        }
        ipcRenderer.send("import-success", "success");
      });
    });
  }
});
