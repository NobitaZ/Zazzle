const puppeteer = require("puppeteer-extra");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
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
const parse = require("csv-parse");
const WindowsToaster = require("node-notifier").WindowsToaster;
const myFunc = require(path.join(__dirname, "./src/windowRenderer"));
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const userAgent = require("user-agents");

const apiKey = "13792eb6fd79ce2901a11c0958dcd7f6";

const siteDetails = {
    sitekey: "6Lc64wwTAAAAAN_VadOkTL4pNo2PgWk008qpz1jp",
    // sitekey: "6Lcj-R8TAAAAABs3FrRPuQhLMbp5QrHsHufzLf7b",
    pageurl: "https://www.zazzle.com/lgn/signin",
};

puppeteer.use(
    RecaptchaPlugin({
        provider: { id: "2captcha", token: apiKey },
        visualFeedback: true, // colorize reCAPTCHAs (violet = detected, green = solved)
    })
);
puppeteer.use(StealthPlugin());
//Enviroment
process.env.NODE_ENV = "development";
// process.env.NODE_ENV = "production";

let mainWindow,
    homeWindow,
    uploadWindow,
    importWindow,
    updateWindow,
    adminWindow;

const db =
    process.env.NODE_ENV !== "development" ? config.mongoURI : config.localURI;

//--------------------------------------------------------------------
// AUTO UPDATE
//--------------------------------------------------------------------
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

//--------------------------------------------------------------------
// CREATE WINDOWS
//--------------------------------------------------------------------
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
    // homeWindow.loadURL(path.join(__dirname, "./views/home.html"));
    homeWindow.loadFile("./views/home.html");
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
    adminWindow.webContents.openDevTools();
    adminWindow.removeMenu();
    // adminWindow.loadURL(path.join(__dirname, "./views/admin.html"));
    adminWindow.loadFile("./views/admin.html");
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
    // updateWindow.loadURL(path.join(__dirname, "./views/checkUpdate.html"));
    updateWindow.loadFile("./views/checkupdate.html");
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
    // uploadWindow.loadURL(path.join(__dirname, "./views/upload.html"));
    uploadWindow.loadFile("./views/upload.html");
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
    // importWindow.loadURL(path.join(__dirname, "./views/import.html"));
    importWindow.loadFile("./views/import.html");
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

//--------------------------------------------------------------------
// On ready
//--------------------------------------------------------------------
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

//----------------------------------
// MAIN PROCESS
//----------------------------------
async function mainProcess(arrAcc, arrItems) {
    try {
        // Variables
        const accUsername = arrAcc[0];
        const accPassword = arrAcc[1];
        const proxyIP = arrAcc[2];
        const proxyUser = arrAcc[3];
        const proxyPass = arrAcc[4];
        const arrImgPath = arrItems[0];
        const imgType = arrItems[2];
        const departmentName = arrItems[3];

        // Read category
        let categoryList = [];
        const categoryPath =
            process.env.NODE_ENV === "development"
                ? "./data/category.csv"
                : path.join(process.resourcesPath, "data/category.csv");
        fs.readFile(categoryPath, function (err, data) {
            if (err) {
                log.error(err);
            }
            parse(data, { columns: false, trim: true }, function (err, rows) {
                let elements = rows[0];
                elements.forEach((element) => {
                    categoryList.push(element);
                });
            });
        });

        // Read product
        let wallArtList = [];
        const productPath =
            process.env.NODE_ENV === "development"
                ? "./data/product.csv"
                : path.join(process.resourcesPath, "data/product.csv");
        fs.readFile(productPath, function (err, data) {
            if (err) {
                log.error(err);
            }
            parse(data, { columns: false, trim: true }, function (err, rows) {
                let elements = rows[0];
                elements.forEach((element) => {
                    wallArtList.push(element);
                });
            });
        });

        // Read tag
        var tagListArr = [];
        var arrTags = [];
        var tagNameVal = arrItems[1].split(",");
        var nicheVal = tagNameVal[0].trim();
        var subNicheVal = tagNameVal[1].trim();
        var nicheIndex = 0;
        var nextNicheIndex = 0;
        const tagsPath =
            process.env.NODE_ENV === "development"
                ? "./data/tags.csv"
                : path.join(process.resourcesPath, "data/tags.csv");
        fs.readFile(tagsPath, function (err, data) {
            if (err) {
                log.error(err);
            }
            parse(data, { columns: false, trim: true }, function (err, rows) {
                if (err) {
                    log.error(err);
                }
                for (let index = 1; index < rows.length; index++) {
                    const element = rows[index];
                    if (element[0].trim() == nicheVal) {
                        nicheIndex = index;
                        continue;
                    }
                    if (
                        element[0] != "" &&
                        index > nicheIndex &&
                        nicheIndex != 0
                    ) {
                        nextNicheIndex = index;
                        break;
                    }
                }
                if (nextNicheIndex == 0 && nicheIndex != 0) {
                    for (let index = 1; index < rows.length; index++) {
                        const element = rows[index];
                        if (element[1].trim() == subNicheVal) {
                            arrTags.push(element[2].trim());
                            break;
                        }
                    }
                } else {
                    for (let i = nicheIndex; i < nextNicheIndex; i++) {
                        const element = rows[i];
                        if (element[1].trim() == subNicheVal) {
                            arrTags.push(element[2].trim());
                            break;
                        }
                    }
                }
            });
        });

        setTimeout(() => {
            if (typeof arrTags[0] != "undefined") {
                tagListArr = arrTags[0].split(" ");
            } else {
                tagListArr = [];
            }
        }, 12000);

        //Browser handlers
        const { browser, page } = await openBrowser(proxyIP);
        if (proxyUser.trim() != "" && proxyPass.trim() != "") {
            await page.authenticate({
                username: proxyUser,
                password: proxyPass,
            });
        }

        // await page.setUserAgent(userAgent.toString());
        await page.setDefaultNavigationTimeout(0);
        await page.goto(`https://www.zazzle.com/lgn/signin`, {
            waitUntil: "networkidle2",
        });
        await myFunc.timeOutFunc(1000);
        const humanCapt = await page.evaluate(() => {
            let pageTitle = document.querySelector(".page-title");
            let result = false;
            if (pageTitle != null) {
                result = true;
            }
            return result;
        });
        if (humanCapt) {
            console.log("resolving humanCapt");
            await page.solveRecaptchas();
            console.log("resolved humanCapt");
            await Promise.all([
                page.waitForNavigation({ waitUntil: "networkidle2" }),
            ]).catch((error) => {
                log.error(error);
            });
        }
        await myFunc.timeOutFunc(5000);
        await page.evaluate(() => {
            let btnLogin = document.getElementById("page_signin");
            if (btnLogin != null) {
                if (btnLogin.disabled) {
                    btnLogin.disabled = false;
                }
            }
        });
        const siteCapt = await page.evaluate(() => {
            let grecaptcha = document.getElementById("g-recaptcha-response");
            let result = false;
            if (grecaptcha != null) {
                result = true;
            }
            return result;
        });
        if (siteCapt) {
            await page.type("#page_username-input", accUsername);
            await myFunc.timeOutFunc(1000);
            await page.type("#page_password-input", accPassword);
            console.log("resolving siteCapt");
            await page.solveRecaptchas();
            console.log("resolved siteCapt");
            await myFunc.timeOutFunc(1000);
            await Promise.all([
                page.click("#page_signin"),
                page.waitForNavigation({ waitUntil: "networkidle2" }),
            ]).catch((error) => {
                log.error(error);
            });
        } else {
            await page.type("#page_username-input", accUsername);
            await myFunc.timeOutFunc(1000);
            await page.type("#page_password-input", accPassword);
            await myFunc.timeOutFunc(1000);
            await Promise.all([
                page.click("#page_signin"),
                page.waitForNavigation({ waitUntil: "networkidle2" }),
            ]).catch((error) => {
                log.error(error);
            });
        }
    } catch (error) {
        log.error(error);
    }
}

//--------------------------------------------------------------------
// BROWSER
//--------------------------------------------------------------------
async function openBrowser(proxy) {
    ip = proxy.split(":")[0];
    var port = "";
    typeof proxy.split(":")[1] == "undefined"
        ? (port = "4444")
        : (port = proxy.split(":")[1]);

    const chromePath =
        process.env.NODE_ENV === "development"
            ? puppeteer.executablePath()
            : path.join(
                  process.resourcesPath,
                  "app.asar.unpacked/node_modules/puppeteer/.local-chromium/win64-800071/chrome-win/chrome.exe"
              );
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        defaultViewport: null,
        ignoreHTTPSErrors: true,
        slowMo: 20,
        args: [`--proxy-server=http://${ip}:${port}`],
        //--disable-web-security "--window-size=1500,900"
    });
    console.log("Browser opened");
    await homeWindow.webContents.send("logs", "Browser openned");
    const page = await browser.newPage();
    let item = { browser: browser, page: page };
    return item;
}

async function closeBrowser(browser) {
    await browser.close();
    await homeWindow.webContents.send("logs", "Browser closed");
    await homeWindow.webContents.send("logs", "Upload Completed !!!");
    console.log(`Browser closed!`);
}

//----------------------------------------------------------------
// CAPTCHA BYPASS
//----------------------------------------------------------------
async function initiateCaptchaRequest(apiKey, sitekey) {
    const formData = {
        method: "userrecaptcha",
        googlekey: sitekey,
        key: apiKey,
        pageurl: siteDetails.pageurl,
        json: 1,
    };
    console.log(`Submitting to 2captcha...`);
    const response = await request.post("http://2captcha.com/in.php", {
        form: formData,
    });
    console.log(`requestID: ${JSON.parse(response).request}`);
    return JSON.parse(response).request;
}

async function pollForRequestResults(
    key,
    id,
    retries = 30,
    interval = 5000,
    delay = 12000
) {
    console.log(`Waiting for ${delay}ms`);
    await myFunc.timeOutFunc(delay);
    return poll({
        taskFn: requestCaptchaResults(key, id),
        interval,
        retries,
    });
}

function requestCaptchaResults(apiKey, requestId) {
    // const url = `http://2captcha.com/res.php?key=${apiKey}&action=get&id=64965318307&json=1`;
    const url = `http://2captcha.com/res.php?key=${apiKey}&action=get&id=${requestId}&json=1`;
    return async function () {
        return new Promise(async function (resolve, reject) {
            console.log(`Polling for response...`);
            const rawResponse = await request.get(url);
            const resp = JSON.parse(rawResponse);
            console.log(resp);
            if (resp.status === 0) return reject(resp.request);
            console.log(`Response received...`);
            resolve(resp.request);
        });
    };
}
