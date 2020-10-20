const puppeteer = require("puppeteer-extra");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require(path.join(__dirname, "models/User"));
const Logs = require(path.join(__dirname, "models/Logs"));
const { app, BrowserWindow, Menu, ipcMain, remote, dialog, session } = require("electron");
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

let mainWindow, homeWindow, uploadWindow, importWindow, updateWindow, adminWindow;

const db = process.env.NODE_ENV !== "development" ? config.mongoURI : config.localURI;

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
    updateWindow.webContents.send("msg-update", "Downloading update...");
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
    if (process.env.NODE_ENV !== "development") {
        connectDB(db);
    } else {
        setTimeout(() => {
            connectDB(db);
        }, 500);
    }
    const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
    Menu.setApplicationMenu(mainMenu);
}

function createHomeWindow() {
    homeWindow = new BrowserWindow({
        width: 1000,
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
        parent: homeWindow,
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
        parent: homeWindow,
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
    importWindow.hide();
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
            }
            parse(data, { columns: false, trim: true }, function (err, rows) {
                let elements = rows[0];
                elements.forEach((element) => {
                    categoryList.push(element.trim());
                });
            });
        });

        // Read product
        let productList = [];
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
                    productList.push(element);
                });
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
                    if (element[0] != "" && index > nicheIndex && nicheIndex != 0) {
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
            }
            parse(data, { columns: false, trim: true }, function (err, rows) {
                if (err) {
                    log.error(err);
                }
                linkList = rows;
            });
        });
        setTimeout(() => {
            for (let index = 0; index < productList.length; index++) {
                let product = {};
                let productEle = productList[index];
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
                    typeof splitProduct[2] !== "undefined"
                        ? splitProduct[2].includes("$")
                            ? ""
                            : splitProduct[2]
                        : "";
                console.log(`splitProduct: ${splitProduct}`);
                let filterProduct = linkList.find((row) => {
                    return row[1].trim() == splitProduct[0].trim();
                })[0];
                if (filterProduct != null && typeof filterProduct != "undefined") {
                    product.firstLink = "https://www.zazzle.com/custom/" + filterProduct;
                }
                productArr.push(product);
            }
            console.log(productArr);
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
            await Promise.all([page.waitForNavigation()]).catch((error) => {
                log.error(error);
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
            await Promise.all([page.click("#page_signin"), page.waitForNavigation()]).catch((error) => {
                log.error(error);
            });
        } else {
            await page.type("#page_username-input", accUsername);
            await myFunc.timeOutFunc(1000);
            await page.type("#page_password-input", accPassword);
            await myFunc.timeOutFunc(1000);
            await Promise.all([page.click("#page_signin"), page.waitForNavigation()]).catch((error) => {
                log.error(error);
            });
        }
        await homeWindow.webContents.send("logs", `Login success: ${accUsername}`);

        // Upload images
        await page.goto("https://www.zazzle.com/lgn/signin?mlru=images");
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
        ]).catch((error) => {
            log.error(error);
        });
        await fileChooser.accept(arrImgPath);
        await homeWindow.webContents.send("logs", `Uploading ${arrImgPath.length} images...`);
        console.log(`Uploading ${arrImgPath.length} images...`);
        await myFunc.timeOutFunc(5000);
        await page.waitForFunction(
            (imgCout) => {
                // get image cout after upload to compare
                let counter = document.querySelectorAll(".MediaBrowserExplorer-subViews button");
                let result = false;
                if (counter != null) {
                    if (parseInt(counter[0].textContent.match(/\d+/g)[0]) == imgCout) {
                        result = true;
                    }
                }
                return result;
            },
            { timeout: 0 },
            arrImgPath.length + originCounter
        );
        await homeWindow.webContents.send("logs", `Successfully Uploaded`);
        console.log(`Successfully Uploaded`);
        await myFunc.timeOutFunc(1000);

        // Get all link to get second link
        async function getSecondLink(element, page, secondLinkArr) {
            let ele = await page.evaluate((element) => {
                let productLinkEle = [
                    ...document.querySelectorAll(
                        'a[id^="page_cmsContent_zWidget"].ZazzleCollectionItemCellProduct-titleLink'
                    ),
                ];
                let result = [];
                let links = productLinkEle.filter((v) => {
                    return (
                        v.text == element.secondProduct && v.parentNode.nextElementSibling.textContent == element.price
                    );
                });

                if (links != "") {
                    links.forEach((v) => {
                        result.push(v.href);
                    });
                }
                return result;
            }, element);
            secondLinkArr.push(...ele);
        }

        // Add product
        for (let index = 0; index < productArr.length; index++) {
            let secondLinkArr = [];
            const element = productArr[index];
            await page.goto(element.firstLink);
            await myFunc.timeOutFunc(500);
            const numberOfPage = await page.evaluate(() => {
                return parseInt(
                    document.querySelector(".ZazzlePagination-pageDisplay").textContent.match(/(\d+)(?!.*\d)/gm)
                );
            });
            //get link page 1
            await getSecondLink(element, page, secondLinkArr);
            //get link other pages
            for (let i = 2; i <= numberOfPage; i++) {
                console.log(`Goto page ${i}`);
                await page.goto(element.firstLink + `?pg=${i}`);
                await getSecondLink(element, page, secondLinkArr);
            }
            if (secondLinkArr == "") {
                throw new Error("Can not find second link");
            }
            for (let i = 0; i < secondLinkArr.length; i++) {
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
                    console.log(`imgPath: ${imgPath}`);
                    console.log(`imgName: ${imgName}`);
                    console.log(`imgDirname: ${imgDirname}`);
                    console.log(`imgNameInChars: ${imgNameInChars}`);
                    console.log(`imgNameInCharsSplit: ${imgNameInCharsSplit}`);
                    console.log(`tagListArr: ${tagListArr}`);
                    await page.goto(secondLinkArr[i], {
                        waitUntil: "networkidle2",
                    });
                    //Click Add Image
                    await myFunc.timeOutFunc(2000);
                    await page.waitForSelector(".DesignPod-customizeControls");
                    await page.evaluate(() => {
                        const AddImagesBtn = document.querySelector(".DesignPod-customizeControls");
                        AddImagesBtn.children[0].click();
                    });
                    // await page.$eval(".DesignPod-customizeControls", (ele) => {
                    //     ele.children[0].click();
                    // });
                    await page.waitForSelector(".Z4DSContentPanelBase-bigBlueButton");
                    //Click Open full image browser
                    await page.click(".Z4DSContentPanelBase-bigBlueButton");
                    //Choose image
                    await page.waitForSelector(`img.JustifiedGridItem-image[alt="${imgName}"]`);
                    await page.click(`img.JustifiedGridItem-image[alt="${imgName}"]`);
                    await myFunc.timeOutFunc(2000);
                    let dialogSize = await page.evaluate(() => {
                        const dialogBody = document.querySelector(".Dialog-body");
                        let result = false;
                        if (dialogBody != null) {
                            //Select size dialog
                            let dialogOption = [
                                ...document.querySelector(".Dialog-body>div>div>fieldset>div").children,
                            ];
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

                    // if (dialogSize) {
                    //     await page.waitForSelector(".Dialog-buttonBar");
                    //     await page.evaluate(() => {
                    //         let continueButton = document.querySelector(".Dialog-buttonBar");
                    //         continueButton.firstElementChild.click();
                    //     });
                    //     // await page.click(".Dialog-buttonBar>button");
                    // }
                    await myFunc.timeOutFunc(500);
                    await page.waitForSelector(".Z4DSPropertiesPanelBase-duplexRow");
                    await page.evaluate((imgType) => {
                        //Choose image type: Fill or Fit
                        const fillFitButton = document.querySelector(".Z4DSPropertiesPanelBase-duplexRow");
                        if (fillFitButton.children[0].children[1].textContent == imgType) {
                            fillFitButton.children[0].click();
                        } else {
                            fillFitButton.children[1].click();
                        }
                        return true;
                    }, imgType);
                    await myFunc.timeOutFunc(500);
                    // Click button Done
                    await page.waitForSelector(".Z4ColorButton--blue");
                    await page.click(".Z4ColorButton--blue");
                    await myFunc.timeOutFunc(500);
                    await page.waitForSelector("button.Button_root__HighVisibility");
                    await Promise.all([
                        // Click Sell It
                        page.click("button.Button_root__HighVisibility"),
                        page.waitForNavigation(),
                    ]).catch((error) => {
                        log.error(error);
                    });
                    // Type title
                    await page.waitForSelector("#page_postForSaleForm_elements_productTitle-input");
                    await page.type("#page_postForSaleForm_elements_productTitle-input", imgNameInChars);
                    // choose Marketplace Department
                    let fillDep = await page.evaluate((departmentName) => {
                        const suggestedDepartment = document.querySelectorAll(
                            '[id^="page_postForSaleForm_elements_department_suggestedDepartments_value"].ZazzleSelectorValueDisplay-displayName'
                        );
                        suggestedDepartment.forEach((v) => {
                            if (v.textContent == departmentName) {
                                v.click();
                                return true;
                            }
                        });
                        return false;
                    }, departmentName);
                    if (!fillDep) {
                        homeWindow.webContents.send("logs", `Can not find department to choose`);
                    }
                    //select Store Category
                    await page.waitForSelector("#page_postForSaleForm_elements_cnProductLine-folderPath");
                    let isValidCategory = await page.evaluate((categoryList) => {
                        let categoryName = document.querySelector(
                            "#page_postForSaleForm_elements_cnProductLine-folderPath"
                        );
                        let result = false;
                        //check exist category
                        if (categoryName.textContent.trim() == categoryList[0] + " > " + categoryList[1]) {
                            result = true;
                        } else {
                            //open select category dialog
                            document
                                .querySelector("#page_postForSaleForm_elements_cnProductLine-selectCategory")
                                .click();
                            result = false;
                        }
                        return result;
                    }, categoryList);
                    await myFunc.timeOutFunc(2000);
                    if (!isValidCategory) {
                        await myFunc.timeOutFunc(1000);
                        //check first category
                        await page.waitForSelector(".ZazzleCollectionItemFolderNavigationPane-links");
                        await page.evaluate((categoryList) => {
                            let leftCategorySection = [
                                ...document.querySelector(".ZazzleCollectionItemFolderNavigationPane-links>div>div")
                                    .children,
                            ];
                            leftCategorySection.forEach((v) => {
                                if (v.firstElementChild.textContent.trim() == categoryList[0]) {
                                    v.firstElementChild.click();
                                    setTimeout(() => {
                                        let rightCategorySection = [
                                            ...document.querySelectorAll(
                                                ".ZazzleCollectionItemFolderNavigationPane-links>div>div"
                                            )[1].children,
                                        ];
                                        rightCategorySection.forEach((ele) => {
                                            if (ele.firstElementChild.children[0].textContent == categoryList[0]) {
                                                ele.firstElementChild.children[0].click();
                                                setTimeout(() => {
                                                    document.querySelector("#page_categoryBrowserDialog_ok").click();
                                                }, 1000);
                                            } else {
                                                return;
                                            }
                                        });
                                    }, 1000);
                                } else {
                                    return;
                                }
                            });
                        }, categoryList);
                        //TODOS
                    }
                }
            }
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

async function pollForRequestResults(key, id, retries = 30, interval = 5000, delay = 12000) {
    console.log(`Waiting for ${delay}ms`);
    await myFunc.timeOutFunc(delay);
    return poll({
        taskFn: requestCaptchaResults(key, id),
        interval,
        retries,
    });
}

function requestCaptchaResults(apiKey, requestId) {
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
