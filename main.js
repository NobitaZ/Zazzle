const puppeteer = require("puppeteer");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require(path.join(__dirname, "models/User"));
const Logs = require(path.join(__dirname, "models/Logs"));
const {
    app,
    BrowserWindow,
    Menu,
    ipcMain,
    remote,
    dialog,
    session,
} = require("electron");
const config = require(path.join(__dirname, "./config/keys"));
const fs = require("fs");
// const parse = require("csv-parse");
const WindowsToaster = require("node-notifier").WindowsToaster;
const myFunc = require(path.join(__dirname, "./src/windowRenderer"));
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

//Enviroment
process.env.NODE_ENV = "development";
// process.env.NODE_ENV = 'production';

let mainWindow,
    homeWindow,
    uploadWindow,
    importWindow,
    updateWindow,
    adminWindow;

const db =
    process.env.NODE_ENV !== "development" ? config.mongoURI : config.localURI;

//----------------------------------
// AUTO UPDATE
//----------------------------------
autoUpdater.on("checking-for-update", () => {
    updateWindow.webContents.send("msg-update", "Checking for update...");
});
autoUpdater.on("update-available", (info) => {
    updateWindow.webContents.send("msg-update", "Update available");
});
autoUpdater.on("update-not-available", (info) => {
    updateWindow.webContents.send(
        "msg-update",
        "You are using the latest version"
    );
    setTimeout(() => {
        createWindow();
        updateWindow.close();
    }, 1000);
});
autoUpdater.on("error", (err) => {
    updateWindow.webContents.send(
        "msg-update",
        "Error in auto-updater. " + err
    );
});
autoUpdater.on("download-progress", (progressObj) => {
    updateWindow.webContents.send("msg-update", "Downloading update...");
    updateWindow.webContents.send(
        "download-progress",
        Math.round(progressObj.percent)
    );
});
autoUpdater.on("update-downloaded", (info) => {
    updateWindow.webContents.send(
        "msg-update",
        "Update downloaded...Install in 3s"
    );
    setTimeout(() => {
        autoUpdater.quitAndInstall();
    }, 3000);
});

//----------------------------------
// CREATE WINDOWS
//----------------------------------
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 500,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    });
    mainWindow.loadURL(
        path.join(__dirname, `./views/login.html#v${app.getVersion()}`)
    );
    mainWindow.on("closed", function () {
        mainWindow = null;
    });
    // Connect to MongoDB
    if (process.env.NODE_ENV !== "development") {
        connectDB(db);
    } else {
        setTimeout(() => {
            connectDB(db);
        }, 1000);
    }
    const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
    Menu.setApplicationMenu(mainMenu);
}

function createHomeWindow() {
    homeWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        resizable: false,
        darkTheme: true,
        title: "Zazzle Upload Tool",
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    });
    homeWindow.removeMenu();
    homeWindow.loadURL(path.join(__dirname, "./views/home.html"));
    homeWindow.on("close", function () {
        homeWindow = null;
    });
    const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
    Menu.setApplicationMenu(mainMenu);
}

function createHomeWindow() {
    homeWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        resizable: false,
        darkTheme: true,
        title: "Zazzle Upload Tool",
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    });
    homeWindow.removeMenu();
    homeWindow.loadURL(path.join(__dirname, "./views/home.html"));
    homeWindow.on("close", function () {
        homeWindow = null;
    });
    const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
    Menu.setApplicationMenu(mainMenu);
}

function createAdminWindow() {
    adminWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        resizable: false,
        darkTheme: true,
        title: "Zazzle Tools - Admin Panel",
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    });
    adminWindow.removeMenu();
    adminWindow.loadURL(path.join(__dirname, "./views/admin.html"));
    adminWindow.on("close", function () {
        adminWindow = null;
    });
    const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
    Menu.setApplicationMenu(mainMenu);
}

function createUpdateWindow() {
    updateWindow = new BrowserWindow({
        width: 400,
        height: 150,
        resizable: false,
        darkTheme: true,
        title: "Zazzle Upload Tool",
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    });
    updateWindow.removeMenu();
    updateWindow.loadURL(path.join(__dirname, "./views/checkUpdate.html"));
    updateWindow.on("close", function () {
        updateWindow = null;
    });
}

function createUploadWindow() {
    uploadWindow = new BrowserWindow({
        width: 1024,
        height: 900,
        resizable: false,
        darkTheme: true,
        title: "Zazzle Upload Tool",
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    });
    uploadWindow.removeMenu();
    uploadWindow.loadURL(path.join(__dirname, "./views/upload.html"));
    uploadWindow.on("close", function () {
        uploadWindow = null;
    });
    const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
    Menu.setApplicationMenu(mainMenu);
}

function createImportWindow() {
    importWindow = new BrowserWindow({
        width: 600,
        height: 400,
        resizable: false,
        darkTheme: true,
        title: "Society Upload Tool",
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    });
    importWindow.removeMenu();
    importWindow.loadURL(path.join(__dirname, "./views/import.html"));
    importWindow.on("close", function () {
        importWindow = null;
    });
}

function connectDB(db) {
    mongoose
        .connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => {
            mainWindow.webContents.send("db", "connected");
            console.log("MongoDB Connected");
        })
        .catch((err) => {
            log.error(err);
            mainWindow.webContents.send("db", "failed");
        });
}

//----------------------------------
// On ready
//----------------------------------
if (process.env.NODE_ENV === "development") {
    app.on("ready", createWindow);
} else {
    autoUpdater.checkForUpdatesAndNotify();
    app.on("ready", createUpdateWindow);
}

app.on("window-all-closed", function () {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", function () {
    if (mainWindow === null) {
        createWindow();
    }
});

//Auth user
ipcMain.on("auth-form", function (e, item) {
    username = item["username"];
    password = item["password"];
    User.findOne({
        username: username,
    }).then((user) => {
        if (!user) {
            mainWindow.webContents.send("msg-login", "user-failed");
            return;
        }
        // Match password
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) log.error(err);
            if (isMatch) {
                // session.defaultSession.cookies.set({
                //     url: "http://localhost",
                //     name: username,
                // });
                if (user.username === "admin") {
                    createAdminWindow();
                } else {
                    createHomeWindow();
                }
                mainWindow.close();
                // const publicIp = require("public-ip");
                // const ip_adds = (async () => {
                //     const ip = await publicIp.v4();
                //     var ipLogs = {
                //         user: user.name,
                //         ip_address: ip,
                //     };
                //     const newLogs = new Logs(ipLogs);
                //     await newLogs.save();
                // })();
            } else {
                mainWindow.webContents.send("msg-login", "pass-failed");
                return;
            }
        });
    });
});

var arrAcc = {};
// Handle select button click
ipcMain.on("select-clicked", function (e, arrItems) {
    createUploadWindow();
    arrAcc = arrItems;
});

ipcMain.on("import-clicked", function (e, item) {
    createImportWindow();
});

ipcMain.on("import-success", function (e, item) {
    importWindow.close();
    homeWindow.webContents.send("reload-acc-info", "reload");
});

// Handle upload button click
ipcMain.on("upload-clicked", function (e, arrItems) {
    try {
        mainProcess(arrAcc, arrItems);
    } catch (error) {
        log.error(error);
    }
    uploadWindow.close();
});
