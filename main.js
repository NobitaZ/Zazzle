require("dotenv").config({ path: __dirname + "/.env" });
const puppeteer = require("puppeteer-extra");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require(path.join(__dirname, "models/User"));
const { app, BrowserWindow, Menu, ipcMain, remote, dialog, session } = require("electron");
const fs = require("fs");
const parse = require("csv-parse");
const WindowsToaster = require("node-notifier").WindowsToaster;
const myFunc = require(path.join(__dirname, "./src/windowRenderer"));
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const getmac = require("getmac");
const publicIp = require("public-ip");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
const logger = require("./helpers/logger");

puppeteer.use(
  RecaptchaPlugin({
    provider: { id: "2captcha", token: process.env.CAPTCHA_KEY },
    visualFeedback: true,
  })
);
puppeteer.use(AdblockerPlugin());
puppeteer.use(StealthPlugin());

let mainWindow, homeWindow, uploadWindow, importWindow, updateWindow, adminWindow, editUserWindow;

let publicIPObj = {},
  loggerObj = {};

// const dbConnectionStr = process.env.NODE_ENV !== "development" ? config.mongoURI : config.remoteDB;
const dbConnectionStr = process.env.NODE_ENV !== "development" ? process.env.PRODUCTION_DB2 : process.env.REMOTE_DB;
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
  updateWindow.webContents.send("msg-update", "You are using the latest version");
  setTimeout(() => {
    createWindow();
    updateWindow.close();
  }, 1000);
});
autoUpdater.on("error", (err) => {
  updateWindow.webContents.send("msg-update", "Error in auto-updater. " + err);
});
autoUpdater.on("download-progress", (progressObj) => {
  updateWindow.webContents.send("download-progress", Math.round(progressObj.percent));
});
autoUpdater.on("update-downloaded", (info) => {
  updateWindow.webContents.send("msg-update", "Update downloaded...Install in 3s");
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
  mainWindow.loadURL(path.join(__dirname, `./views/login.html#v${app.getVersion()}`));
  mainWindow.on("closed", function () {
    mainWindow = null;
  });
  // Connect to MongoDB
  setTimeout(() => {
    connectDB(dbConnectionStr);
  }, 1000);

  (async () => {
    publicIPObj.ip = await publicIp.v4();
    let mac = getmac.default().toUpperCase();
    loggerObj = {
      ip_address: publicIPObj.ip,
      MAC: mac,
      app_name: "Zazzle",
    };
  })();
  const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
  Menu.setApplicationMenu(mainMenu);
}

function createHomeWindow() {
  homeWindow = new BrowserWindow({
    width: 1100,
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
  homeWindow.loadFile("./views/home.html");
  homeWindow.on("close", function () {
    homeWindow = null;
  });
  const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
  Menu.setApplicationMenu(mainMenu);
}

function createAdminWindow() {
  adminWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: false,
    darkTheme: true,
    title: "Zazzle Tools - Admin Panel",
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });
  // adminWindow.webContents.openDevTools();
  adminWindow.removeMenu();
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
    parent: homeWindow,
  });
  uploadWindow.removeMenu();
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
    height: 600,
    resizable: false,
    darkTheme: true,
    title: "Zazzle Upload Tool",
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    parent: homeWindow,
  });
  importWindow.removeMenu();
  importWindow.loadFile("./views/import.html");
  importWindow.on("close", function () {
    importWindow = null;
  });
}

function createEditUserWindow() {
  editUserWindow = new BrowserWindow({
    width: 500,
    height: 580,
    resizable: false,
    darkTheme: true,
    title: "Zazzle Upload Tool",
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    parent: adminWindow,
  });
  editUserWindow.removeMenu();
  editUserWindow.loadFile("./views/edituser.html");
  editUserWindow.on("close", function () {
    editUserWindow = null;
  });
}

function connectDB(dbConnectionStr) {
  mongoose
    .connect(dbConnectionStr, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      mainWindow.webContents.send("db", "connected");
      console.log("MongoDB Connected");
    })
    .catch((err) => {
      log.error(err);
      logger.error(err.stack, loggerObj);
      mainWindow.webContents.send("db", "failed");
    });
}

//--------------------------------------------------------------------
// On ready
//--------------------------------------------------------------------
if (process.env.NODE_ENV === "development") {
  app.on("ready", createWindow);
} else {
  app.on("ready", createUpdateWindow);
}
app.on("ready", function () {
  autoUpdater.checkForUpdatesAndNotify();
});
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
      if (err) {
        log.error(err);
        logger.error(err.stack, loggerObj);
      }
      if (isMatch) {
        if (user.username == "hadeptrai") {
          createAdminWindow();
          mainWindow.close();
        } else {
          if (typeof user.mac != "undefined") {
            let userMac = user.mac.toUpperCase().replaceAll("-", ":");
            if (getmac.default().toUpperCase() == userMac) {
              if (typeof user.ip1 != "undefined" || typeof user.ip2 != "undefined") {
                if (publicIPObj.ip == user.ip1 || publicIPObj.ip == user.ip2) {
                  session.defaultSession.cookies.set({
                    url: "http://localhost",
                    name: user.name,
                  });
                  createHomeWindow();
                  mainWindow.close();
                } else {
                  mainWindow.webContents.send("msg-login", "wrong-ip");
                  return;
                }
              }
            } else {
              mainWindow.webContents.send("msg-login", "wrong-mac");
              return;
            }
          } else {
            mainWindow.webContents.send("msg-login", "wrong-mac");
            return;
          }
        }

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
  importWindow.hide();
  homeWindow.webContents.send("reload-acc-info", "reload");
});

// Handle upload button click
ipcMain.on("upload-clicked", function (e, arrItems) {
  try {
    mainProcess(arrAcc, arrItems);
  } catch (err) {
    log.error(err);
    logger.error(err.stack, loggerObj);
  }
  uploadWindow.close();
});

ipcMain.on("edit-user", function (e, userInfo) {
  createEditUserWindow();
  setTimeout(() => {
    editUserWindow.webContents.send("data", userInfo);
  }, 1000);
});

ipcMain.on("delete-user", function (e, username) {
  User.findOneAndDelete({
    username: username,
  }).then((user) => {
    if (!user) {
      return;
    }
    adminWindow.webContents.send("user-modified", "true");
  });
});

ipcMain.on("data-modified", function (e, data) {
  User.findOneAndUpdate(
    {
      username: data.username,
    },
    { $set: data },
    {
      useFindAndModify: false,
    }
  ).then((user) => {
    if (!user) {
      return;
    }
    adminWindow.webContents.send("user-modified", "true");
  });
});

ipcMain.on("logout", function (e, item) {
  createWindow();
  if (item == "logoutAdmin") {
    adminWindow.close();
  } else if (item == "logout") {
    homeWindow.close();
  }
});

ipcMain.on("open-account", function (e, data) {
  try {
    openAccount(data);
  } catch (err) {
    log.error(err);
    logger.error(err.stack, loggerObj);
  }
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
    // const departmentName = arrItems[3];
    const regexStr = /([^\\]+)(?=\.\w+$)/;
    // Read category
    let categoryList = [];
    const categoryPath =
      process.env.NODE_ENV === "development"
        ? "./data/category.csv"
        : path.join(process.resourcesPath, "data/category.csv");
    fs.readFile(categoryPath, function (err, data) {
      if (err) {
        log.error(err);
        logger.error(err.stack, loggerObj);
      }
      parse(data, { columns: false, trim: true }, function (err, rows) {
        if (err) {
          log.error(err);
          logger.error(err.stack, loggerObj);
        }
        if (rows.length != 0) {
          let elements = rows[0];
          elements.forEach((element) => {
            categoryList.push(element.trim());
          });
        } else {
          return;
        }
      });
    });

    // Read product
    let productList = [];
    let departmentList = [];
    const productPath =
      process.env.NODE_ENV === "development"
        ? "./data/product.csv"
        : path.join(process.resourcesPath, "data/product.csv");
    fs.readFile(productPath, function (err, data) {
      if (err) {
        log.error(err);
        logger.error(err.stack, loggerObj);
      }
      parse(data, { relax_column_count: true, trim: true }, function (err, rows) {
        if (err) {
          log.error(err);
          logger.error(err.stack, loggerObj);
        }
        for (let i = 0; i < rows.length; i++) {
          const elements = rows[i];
          let productElement = [];
          elements.forEach((element, index) => {
            if (index == 0) {
              departmentList.push(element);
            } else {
              productElement.push(element);
            }
          });
          productList.push(productElement);
        }
      });
    });
    // Read tag
    let tagListArr = [];
    let arrTags = [];
    let tagNameVal = arrItems[1].split(",");
    let nicheVal = tagNameVal[0].trim();
    let subNicheVal = tagNameVal[1].trim();
    let nicheIndex = 0;
    let nextNicheIndex = 0;
    const tagsPath =
      process.env.NODE_ENV === "development" ? "./data/tags.csv" : path.join(process.resourcesPath, "data/tags.csv");
    fs.readFile(tagsPath, function (err, data) {
      if (err) {
        log.error(err);
        logger.error(err.stack, loggerObj);
      }
      parse(data, { columns: false, trim: true }, function (err, rows) {
        if (err) {
          log.error(err);
          logger.error(err.stack, loggerObj);
        }
        for (let index = 1; index < rows.length; index++) {
          const element = rows[index];
          if (element[0].toUpperCase().trim() == nicheVal.toUpperCase()) {
            nicheIndex = index;
            continue;
          }
          if (element[0] != "" && index > nicheIndex && nicheIndex != 0) {
            nextNicheIndex = index;
            break;
          }
        }
        if (nextNicheIndex == 0 && nicheIndex != 0) {
          for (let index = 1; index < rows.length; index++) {
            const element = rows[index];
            if (element[1].toUpperCase().trim() == subNicheVal.toUpperCase()) {
              arrTags.push(element[2].trim());
              break;
            }
          }
        } else {
          for (let i = nicheIndex; i < nextNicheIndex; i++) {
            const element = rows[i];
            if (element[1].toUpperCase().trim() == subNicheVal.toUpperCase()) {
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

    let linkList = [];
    let productArr = [];
    const link1stPath =
      process.env.NODE_ENV === "development"
        ? "./data/1stlink.csv"
        : path.join(process.resourcesPath, "data/1stlink.csv");
    // Read prodcut from file
    fs.readFile(link1stPath, function (err, data) {
      if (err) {
        log.error(err);
        logger.error(err.stack, loggerObj);
      }
      parse(data, { relax_column_count: true, columns: false, trim: true }, function (err, rows) {
        if (err) {
          log.error(err);
          logger.error(err.stack, loggerObj);
        }
        if (rows.length > 0) {
          linkList = rows;
        }
      });
    });
    setTimeout(() => {
      for (let index = 0; index < productList.length; index++) {
        let productArrChild = [];
        for (let i = 0; i < productList[index].length; i++) {
          let product = {};
          let productEle = productList[index][i];
          let splitProduct = productEle.split("->").map((v) => {
            return v.trim();
          });
          product.price =
            typeof splitProduct[3] !== "undefined"
              ? splitProduct[3]
              : typeof splitProduct[2] !== "undefined"
              ? splitProduct[2].includes("$")
                ? splitProduct[2]
                : ""
              : "";

          product.secondProduct = typeof splitProduct[1] !== "undefined" ? splitProduct[1] : "";
          product.thirdProduct =
            typeof splitProduct[2] !== "undefined" ? (splitProduct[2].includes("$") ? "" : splitProduct[2]) : "";
          let filterProduct = linkList.find((row) => {
            return row[1].trim() == splitProduct[0].trim();
          })[0];
          if (filterProduct != null && typeof filterProduct != "undefined") {
            product.firstLink = "https://www.zazzle.com/custom/" + filterProduct;
          }
          product.department = departmentList[index];
          productArrChild.push(product);
        }
        productArr.push(productArrChild);
      }
    }, 1000);

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
    let humanCapt = await page.evaluate(() => {
      let pageTitle = document.querySelector(".page-title");
      let result = false;
      pageTitle != null ? (result = true) : (result = false);
      return result;
    });
    if (humanCapt) {
      console.log("resolving humanCapt");
      await homeWindow.webContents.send("logs", "Resolving captcha...");
      await page.solveRecaptchas();
      await homeWindow.webContents.send("logs", "Resolved captcha");
      console.log("resolved humanCapt");
      await Promise.all([page.waitForNavigation()]).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
    }
    await myFunc.timeOutFunc(1000);
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
      grecaptcha != null ? (result = true) : (result = false);
      return result;
    });
    if (siteCapt) {
      await page.type("#page_username-input", accUsername);
      await myFunc.timeOutFunc(1000);
      await page.type("#page_password-input", accPassword);
      console.log("resolving siteCapt");
      await homeWindow.webContents.send("logs", "Resolving captcha...");
      await page.solveRecaptchas();
      await homeWindow.webContents.send("logs", "Resolved captcha");
      console.log("resolved siteCapt");
      await myFunc.timeOutFunc(1000);
      await Promise.all([page.click("#page_signin"), page.waitForNavigation()]).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
    } else {
      await page.type("#page_username-input", accUsername);
      await myFunc.timeOutFunc(1000);
      await page.type("#page_password-input", accPassword);
      await myFunc.timeOutFunc(1000);
      await Promise.all([page.click("#page_signin"), page.waitForNavigation()]).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
    }
    await myFunc.timeOutFunc(1000);
    humanCapt = await page.evaluate(() => {
      let pageTitle = document.querySelector(".page-title");
      let result = false;
      pageTitle != null ? (result = true) : (result = false);
      return result;
    });
    if (humanCapt) {
      console.log("resolving humanCapt");
      await homeWindow.webContents.send("logs", "Resolving captcha...");
      await page.solveRecaptchas();
      await homeWindow.webContents.send("logs", "Resolved captcha");
      console.log("resolved humanCapt");
      await Promise.all([page.waitForNavigation()]).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
    }
    try {
      await page.waitForSelector('a[title="My Account"]', { timeout: 5000 });
      await homeWindow.webContents.send("logs", `Login success: ${accUsername}`);
    } catch (error) {
      await homeWindow.webContents.send("logs", `Login Error: ${accUsername}`);
      await closeBrowser(browser).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
      return;
    }

    // Upload images
    await page.goto("https://www.zazzle.com/lgn/signin?mlru=images");
    await myFunc.timeOutFunc(3000);
    await page.waitForSelector(".FileInput-activeInput", { timeout: 15000 });
    // let uploadBtn = await page.$(".FileInput-activeInput");
    // await page.evaluate(() => {
    //   window.stop();
    // });
    // while (!uploadBtn) {
    //   await page.reload();
    //   await page.waitForSelector(".FileInput-activeInput", { timeout: 5000 }).catch((err) => {
    //     log.error(err);
    //     return;
    //   });
    //   await page.evaluate(() => {
    //     window.stop();
    //   });
    //   uploadBtn = await page.$(".FileInput-activeInput");
    // }
    //get image counter
    const originCounter = await page.evaluate(() => {
      return parseInt(
        document.querySelectorAll(".MediaBrowserExplorer-subViews button")[0].textContent.match(/\d+/g)[0]
      );
    });
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser(),
      page.evaluate(() => {
        //Input file chooser
        document.querySelector(".FileInput-activeInput").click();
      }),
    ]).catch((err) => {
      log.error(err);
      logger.error(err.stack, loggerObj);
    });
    await fileChooser.accept(arrImgPath);
    await homeWindow.webContents.send("logs", `Uploading ${arrImgPath.length} images...`);
    console.log(`Uploading ${arrImgPath.length} images...`);
    await myFunc.timeOutFunc(5000);
    let imgUploadDone = await page
      .waitForFunction(
        (imgCout) => {
          // get image cout after upload to compare
          let counter = document.querySelector(".MediaBrowserExplorer-subViews>button");
          let result = false;
          if (counter != null) {
            if (parseInt(counter.textContent.match(/\d+/g)[0]) == imgCout) {
              result = true;
            }
          }
          return result;
        },
        { timeout: 30000 },
        arrImgPath.length + originCounter
      )
      .catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
        return;
      });
    await myFunc.timeOutFunc(500);
    if (!imgUploadDone) {
      let imgCount = await page.evaluate(() => {
        return parseInt(document.querySelector(".MediaBrowserExplorer-subViews>button").textContent.match(/\d+/g)[0]);
      });
      let uploadedImgCount = imgCount - originCounter;
      await homeWindow.webContents.send("logs", `Uploaded ${uploadedImgCount} images`);
    } else {
      await homeWindow.webContents.send("logs", `Successfully Uploaded`);
      console.log(`Successfully Uploaded`);
    }
    await myFunc.timeOutFunc(1000);

    // Add product
    for (let index = 0; index < productArr.length; index++) {
      for (let i = 0; i < productArr[index].length; i++) {
        let linkArr = [];
        const element = productArr[index][i];
        await page.goto(element.firstLink);
        await myFunc.timeOutFunc(500);
        if (element.thirdProduct != "") {
          const secondProductLink = await getSecondLink(element, page);
          if (secondProductLink != "") {
            await page.goto(secondProductLink);
            await myFunc.timeOutFunc(500);
            const numberOfPage = await page.evaluate(() => {
              return parseInt(
                document.querySelector(".ZazzlePagination-pageDisplay").textContent.match(/(\d+)(?!.*\d)/gm)
              );
            });
            //get link page 1
            await getThirdLink(element, page, linkArr);
            //get link other pages
            for (let i = 2; i <= numberOfPage; i++) {
              console.log(`Goto page ${i}`);
              await page.goto(element.firstLink + `?pg=${i}`);
              await getThirdLink(element, page, linkArr);
            }
          }
          if (linkArr == "") {
            log.error("Can not find product link");
            logger.error("Can not find product link", loggerObj);
          }
        } else {
          const numberOfPage = await page.evaluate(() => {
            return parseInt(
              document.querySelector(".ZazzlePagination-pageDisplay").textContent.match(/(\d+)(?!.*\d)/gm)
            );
          });
          //get link page 1
          await getLink(element, page, linkArr);
          //get link other pages
          for (let i = 2; i <= numberOfPage; i++) {
            console.log(`Goto page ${i}`);
            await page.goto(element.firstLink + `?pg=${i}`);
            await getLink(element, page, linkArr);
          }
          if (linkArr == "") {
            log.error("Can not find product link");
            logger.error("Can not find product link", loggerObj);
          }
        }
        for (let i = 0; i < linkArr.length; i++) {
          for (let j = 0; j < arrImgPath.length; j++) {
            let imgPath = arrImgPath[j];
            let imgName = imgPath.replace(/^.*[\\\/]/, "");
            let imgDirname = path.dirname(imgPath);
            let imgNameInChars = imgPath
              .match(regexStr)[0]
              .replace(/-/g, " ")
              .replace(/[^a-zA-Z ]/g, "")
              .trim();
            let imgNameInCharsSplit = imgNameInChars.split(" ");
            imgNameInCharsSplit.forEach((element) => {
              if (tagListArr != "") {
                tagListArr.splice(0, 0, element);
              } else {
                tagListArr.push(element);
              }
            });
            let desciptionStr = "";
            for (let k = 0; k < tagListArr.length; k++) {
              desciptionStr += `${tagListArr[k]} `;
            }

            await page.goto(linkArr[i], {
              waitUntil: "networkidle2",
            });
            //Click Add Image
            await myFunc.timeOutFunc(3000);
            const soldOutErr = await page.$(".ErrorList");
            if (soldOutErr != null) {
              await homeWindow.webContents.send("logs", `${linkArr[i]} is sold out`);
              continue;
            }
            await page.waitForSelector(".DesignPod-customizeControls", { timeout: 10000 });
            // let addImgBtn = await page.$(".DesignPod-customizeControls");
            // while (!addImgBtn) {
            //   await page.reload();
            //   await myFunc.timeOutFunc(5000);
            //   addImgBtn = await page.$(".DesignPod-customizeControls");
            // }

            await page.$eval(".DesignPod-customizeControls", (ele) => {
              ele.firstElementChild.click();
            });
            await myFunc.timeOutFunc(2000);
            try {
              await page.waitForSelector(".Z4DSContentPanelBase-bigBlueButton", { timeout: 10000 });
            } catch (err) {
              await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
              //Click Add Image
              await myFunc.timeOutFunc(3000);
              let addImageSelector = ".DesignPod-customizeControls";
              await page.waitForSelector(addImageSelector);
              await page.$eval(addImageSelector, (ele) => {
                ele.firstElementChild.click();
              });
              await page.waitForSelector(".Z4DSContentPanelBase-bigBlueButton", { timeout: 0 });
              continue;
            }
            //Click Open full image browser
            await myFunc.timeOutFunc(500);
            await page.click(".Z4DSContentPanelBase-bigBlueButton");
            //Choose image
            await myFunc.timeOutFunc(3000);
            await page.waitForSelector(`img.JustifiedGridItem-image[alt="${imgName}"]`);
            await page.click(`img.JustifiedGridItem-image[alt="${imgName}"]`);
            await myFunc.timeOutFunc(5000);
            let dialogSize = await page.evaluate(() => {
              const dialogBody = document.querySelector(".Dialog-body");
              let result = false;
              if (dialogBody != null) {
                //Select size dialog
                let dialogOption = [...document.querySelector(".Dialog-body>div>div>fieldset>div").children];
                for (let i = 0; i < dialogOption.length; i++) {
                  if (dialogOption[i].textContent.includes("Use my image to resize to the nearest")) {
                    dialogOption[i].children[0].click();
                    result = true;
                    break;
                  }
                }
              } else {
                result = false;
              }
              if (result) {
                setTimeout(() => {
                  let continueBtn = document.querySelector(".Dialog-buttonBar");
                  continueBtn.firstElementChild.click();
                }, 1000);
              }
              //Click button continue after select size if size dialog exist
            });

            await myFunc.timeOutFunc(500);
            await page.waitForSelector(".Z4DSPropertiesPanelBase-duplexRow");
            await myFunc.timeOutFunc(3000);
            // await page.evaluate((imgType) => {
            //   //Choose image type: Fill or Fit
            //   const fillFitButton = document.querySelector(".Z4DSPropertiesPanelBase-duplexRow");
            //   if (fillFitButton.children[0].children[1].textContent == imgType) {
            //     fillFitButton.children[0].click();
            //   } else {
            //     fillFitButton.children[1].click();
            //   }
            //   return true;
            // }, imgType);
            await page.waitForSelector(`span[data-icon="${imgType}"]`);
            await page.click(`span[data-icon="${imgType}"]`);
            await myFunc.timeOutFunc(3000);
            // Click button Done
            await page.waitForSelector(".Z4ColorButton--blue");
            await page.click(".Z4ColorButton--blue");
            await myFunc.timeOutFunc(3000);
            await page.waitForSelector("button.Button_root__HighVisibility");
            await Promise.all([
              // Click Sell It
              page.click("button.Button_root__HighVisibility"),
              page.waitForNavigation(),
            ]).catch((err) => {
              log.error(err);
              logger.error(err.stack, loggerObj);
            });
            // Type title
            await page.waitForSelector("#page_postForSaleForm_elements_productTitle-input");
            await page.type("#page_postForSaleForm_elements_productTitle-input", imgNameInChars);
            // choose Marketplace Department
            let fillDep = await page.evaluate((departmentName) => {
              const suggestedDepartment = document.querySelectorAll(
                '[id^="page_postForSaleForm_elements_department_suggestedDepartments_value"].ZazzleSelectorValueDisplay-displayName'
              );
              let result = false;
              for (let k = 0; k < suggestedDepartment.length; k++) {
                if (suggestedDepartment[k].textContent == departmentName) {
                  suggestedDepartment[k].click();
                  result = true;
                  break;
                }
              }
              return result;
            }, element.department);
            await page.click("#page_postForSaleForm_elements_productDescription-input");
            await myFunc.timeOutFunc(4000);
            // await page.waitForSelector("#page_confirmDialog", { timeout: 5000 });
            await page.evaluate(() => {
              const confirmDialog = document.querySelector("#page_confirmDialog");
              if (confirmDialog != null) {
                document.querySelector("#page_confirmDialog_cancel").click();
              }
            });

            if (!fillDep) {
              homeWindow.webContents.send("logs", `Can not find department to choose`);
            }
            // fill desciption
            await page.type("#page_postForSaleForm_elements_productDescription-input", desciptionStr);
            await myFunc.timeOutFunc(500);
            //select Store Category
            await page.waitForSelector("#page_postForSaleForm_elements_cnProductLine-folderPath");
            let isValidCategory = await page.evaluate((categoryList) => {
              let categoryName = document.querySelector("#page_postForSaleForm_elements_cnProductLine-folderPath");
              let result = false;
              //check exist category
              categoryName.textContent.trim() == categoryList[0] + " > " + categoryList[1]
                ? (result = true)
                : (result = false);
              return result;
            }, categoryList);
            await myFunc.timeOutFunc(2000);
            if (!isValidCategory) {
              // await myFunc.timeOutFunc(1000);
              //open select category dialog
              await page.waitForSelector("#page_postForSaleForm_elements_cnProductLine-selectCategory");
              await page.click("#page_postForSaleForm_elements_cnProductLine-selectCategory");
              await page.waitForSelector(".ZazzleCollectionItemFolderNavigationPane-links");
              //check first category
              let is2ndCategoryExists = false;
              let is1stCategoryExists = await page.evaluate((categoryList) => {
                let result = false;
                //Get all categories from 1st section (left)
                let leftCategorySection = [
                  ...document.querySelectorAll('a[id^="page_categoryBrowserDialog_navigationPanes_item0_zWidget0_"]'),
                ];
                for (let k = 0; k < leftCategorySection.length; k++) {
                  if (leftCategorySection[k].textContent.trim() == categoryList[0]) {
                    leftCategorySection[k].click();
                    result = true;
                    break;
                  }
                }
                return result;
              }, categoryList);

              await myFunc.timeOutFunc(2000);
              if (is1stCategoryExists) {
                is2ndCategoryExists = await page.evaluate((categoryList) => {
                  let result = false;
                  //Get all categories from 2nd section (right)
                  let rightCategorySection = [
                    ...document.querySelectorAll('a[id^="page_categoryBrowserDialog_navigationPanes_item1_zWidget0_"]'),
                  ];
                  for (let k = 0; k < rightCategorySection.length; k++) {
                    if (rightCategorySection[k].textContent.trim() == categoryList[1]) {
                      rightCategorySection[k].click();
                      result = true;
                      break;
                    }
                  }
                  return result;
                }, categoryList);
              }
              await myFunc.timeOutFunc(500);
              //click Done
              await page.waitForSelector("#page_categoryBrowserDialog_ok");
              await page.click("#page_categoryBrowserDialog_ok");

              await myFunc.timeOutFunc(2000);
              if (is1stCategoryExists == false || (is1stCategoryExists == true && is2ndCategoryExists == false)) {
                const btnClearNewSelector = "#page_postForSaleForm_elements_cnProductLine-clearCategory";
                let btnClear = await page.$(btnClearNewSelector);
                //Click Clear
                await btnClear.click();
                await myFunc.timeOutFunc(1000);
                //Click New
                let btnNew = await page.$(btnClearNewSelector);
                await btnNew.click();
                await myFunc.timeOutFunc(1000);
                if (is1stCategoryExists) {
                  await select1stCategory(page, categoryList);
                } else {
                  debugger;
                  await myFunc.timeOutFunc(500);
                  await page.waitForSelector("#page_newProductLine_form_elements_name-input");
                  await page.type("#page_newProductLine_form_elements_name-input", categoryList[0]);
                  await myFunc.timeOutFunc(500);
                  //Click Add New Product Line
                  await page.click("#page_newProductLine_ok-text");
                  await myFunc.timeOutFunc(1000);
                  //Click Clear
                  btnClear = await page.$(btnClearNewSelector);
                  await btnClear.click();
                  await myFunc.timeOutFunc(1000);
                  //Click New
                  btnNew = await page.$(btnClearNewSelector);
                  await btnNew.click();
                  await myFunc.timeOutFunc(1000);
                  await select1stCategory(page, categoryList);
                }
              }
            }

            await myFunc.timeOutFunc(1000);
            // Input tags (max 10 tags)
            const tagsSelector = "#page_postForSaleForm_elements_tagging_input-input";
            await page.waitForSelector(tagsSelector);
            if (tagListArr.length >= 10) {
              for (let i = 0; i < 10; i++) {
                if (i == 9) {
                  await page.type(tagsSelector, tagListArr[i]);
                } else {
                  await page.type(tagsSelector, `${tagListArr[i]} `);
                }
              }
            } else if (tagListArr.length > 0) {
              for (let i = 0; i < tagListArr.length; i++) {
                if (i == tagListArr.length - 1) {
                  await page.type(tagsSelector, tagListArr[i]);
                } else {
                  await page.type(tagsSelector, `${tagListArr[i]} `);
                }
              }
            }
            await myFunc.timeOutFunc(1000);
            //Click Add Tag(s)
            await page.click("#page_postForSaleForm_elements_tagging_add");
            await myFunc.timeOutFunc(1000);
            //Click Suitable Audience (PG-13)
            await page.click("#page_postForSaleForm_elements_maturity_value_option1-inputImage");
            await myFunc.timeOutFunc(1000);
            //Click User Agreement
            await page.click("#page_postForSaleForm_elements_acceptTerms_valueDisplay-inputImage");
            await myFunc.timeOutFunc(1000);
            //Click Post it!
            await myFunc.timeOutFunc(1500);
            // await page.evaluate(() => {
            //   const page_24HourNoticeDialog = document.querySelector("#page_24HourNoticeDialog");
            //   if (page_24HourNoticeDialog != null) {
            //     document.querySelector("#page_24HourNoticeDialog_checkbox_valueDisplay-inputImage").click();
            //     document.querySelector("#page_24HourNoticeDialog_ok").click();
            //   }
            // });
            await Promise.all([page.click("#page_postForSaleForm_submit"), page.waitForNavigation()]).catch((err) => {
              log.error(err);
              logger.error(err.stack, loggerObj);
            });
            imgNameInCharsSplit.forEach((element) => {
              tagListArr.splice(0, 1);
            });
            await homeWindow.webContents.send("logs", `Product Published !!!`);
          }
        }
      }
    }
    //Notification
    const notifier = new WindowsToaster({
      withFallback: false,
    });
    notifier.notify(
      {
        appName: "zazzle-upload-tool",
        title: "Zazzle Upload Tool",
        message: "Upload Completed!",
        sound: true,
      },
      function (err, response) {
        if (err) {
          log.error(err);
          logger.error(err.stack, loggerObj);
        }
        // Response is response from notification
        //console.log("responded...");
      }
    );
    await closeBrowser(browser).catch((err) => {
      log.error(err);
      logger.error(err.stack, loggerObj);
    });
  } catch (err) {
    log.error(err);
    logger.error(err.stack, loggerObj);
  }
}

//--------------------------------------------------------------------
// BROWSER
//--------------------------------------------------------------------
async function openBrowser(proxy) {
  ip = proxy.split(":")[0];
  let port = "";
  typeof proxy.split(":")[1] == "undefined" ? (port = "4444") : (port = proxy.split(":")[1]);

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
    args: [`--proxy-server=http://${ip}:${port}`, "--window-size=1366,768"],
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
  console.log(`Browser closed!`);
}

//Custom Functions
async function select1stCategory(page, categoryList) {
  //select 1st category if exist
  await page.waitForSelector("#page_newProductLine_form_elements_parentCategory-selectCategory");
  await page.click("#page_newProductLine_form_elements_parentCategory-selectCategory");
  await myFunc.timeOutFunc(1000);
  await page.evaluate((categoryList) => {
    let result = false;
    //Get all categories from 1st section (left)
    let leftCategorySection = [
      ...document.querySelectorAll('a[id^="page_categoryBrowserDialog_navigationPanes_item0_zWidget0_"]'),
    ];
    for (let k = 0; k < leftCategorySection.length; k++) {
      if (leftCategorySection[k].textContent.trim() == categoryList[0]) {
        leftCategorySection[k].click();
        result = true;
        break;
      }
    }
    //click Done
    document.querySelector("#page_categoryBrowserDialog_ok-text").click();
    return result;
  }, categoryList);
  await myFunc.timeOutFunc(500);
  //Input 2nd category
  await page.waitForSelector("#page_newProductLine_form_elements_name-input");
  await page.type("#page_newProductLine_form_elements_name-input", categoryList[1]);
  await myFunc.timeOutFunc(500);
  //Click Add New Product Line
  await page.click("#page_newProductLine_ok-text");
}
// Get all link to get second product
async function getLink(element, page, linkArr) {
  let ele = await page.evaluate((element) => {
    let productLinkEle = [
      ...document.querySelectorAll('a[id^="page_cmsContent_zWidget"].ZazzleCollectionItemCellProduct-titleLink'),
    ];
    let result = [];
    let links = productLinkEle.filter((v) => {
      return v.text == element.secondProduct && v.parentNode.nextElementSibling.textContent == element.price;
    });

    if (links != "") {
      links.forEach((v) => {
        result.push(v.href);
      });
    }
    return result;
  }, element);
  linkArr.push(...ele);
}
//if third product exist, get second product link
async function getSecondLink(element, page) {
  let ele = await page.evaluate((element) => {
    let secondLinkArr = [...document.querySelectorAll(".ZazzleCollectionItemCellMantleProduct-mantleTitle")];
    let result = "";
    let links = secondLinkArr.find((v) => {
      return v.textContent == element.secondProduct;
    });

    if (links != "") {
      result = links.closest("a").href;
    }
    return result;
  }, element);
  //secondLink.link = ele;
  return ele;
}
//get all third product link
async function getThirdLink(element, page, linkArr) {
  let ele = await page.evaluate((element) => {
    let productLinkEle = [
      ...document.querySelectorAll('a[id^="page_cmsContent_zWidget"].ZazzleCollectionItemCellProduct-titleLink'),
    ];
    let result = [];
    let links = productLinkEle.filter((v) => {
      return v.text == element.thirdProduct && v.parentNode.nextElementSibling.textContent == element.price;
    });

    if (links != "") {
      links.forEach((v) => {
        result.push(v.href);
      });
    }
    return result;
  }, element);
  linkArr.push(...ele);
}
//----------------------------------
// OPEN ACCOUNT PROCESS
//----------------------------------
async function openAccount(userInfo) {
  const accUsername = userInfo[0];
  const accPassword = userInfo[1];
  const proxyIP = userInfo[2];
  const proxyUser = userInfo[3];
  const proxyPass = userInfo[4];
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
    pageTitle != null ? (result = true) : (result = false);
    return result;
  });
  if (humanCapt) {
    console.log("resolving humanCapt");
    await homeWindow.webContents.send("logs", "Resolving captcha...");
    await page.solveRecaptchas();
    await homeWindow.webContents.send("logs", "Resolved captcha");
    console.log("resolved humanCapt");
    await Promise.all([page.waitForNavigation()]).catch((err) => {
      log.error(err);
      logger.error(err.stack, loggerObj);
    });
  }
  await myFunc.timeOutFunc(1000);
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
    grecaptcha != null ? (result = true) : (result = false);
    return result;
  });
  if (siteCapt) {
    await page.type("#page_username-input", accUsername);
    await myFunc.timeOutFunc(1000);
    await page.type("#page_password-input", accPassword);
    console.log("resolving siteCapt");
    await homeWindow.webContents.send("logs", "Resolving captcha...");
    await page.solveRecaptchas();
    await homeWindow.webContents.send("logs", "Resolved captcha");
    console.log("resolved siteCapt");
    await myFunc.timeOutFunc(1000);
    await Promise.all([page.click("#page_signin"), page.waitForNavigation()]).catch((err) => {
      log.error(err);
      logger.error(err.stack, loggerObj);
    });
  } else {
    await page.type("#page_username-input", accUsername);
    await myFunc.timeOutFunc(1000);
    await page.type("#page_password-input", accPassword);
    await myFunc.timeOutFunc(1000);
    await Promise.all([page.click("#page_signin"), page.waitForNavigation()]).catch((err) => {
      log.error(err);
      logger.error(err.stack, loggerObj);
    });
  }
  try {
    await page.waitForSelector('a[title="My Account"]', { timeout: 5000 });
    await homeWindow.webContents.send("logs", `Login success: ${accUsername}`);
  } catch (err) {
    await homeWindow.webContents.send("logs", `Login Error: ${accUsername}`);
    await closeBrowser(browser).catch((err) => {
      log.error(err);
      logger.error(err.stack, loggerObj);
    });
    return;
  }
}
