dbPassword =
    "mongodb+srv://quydv:" +
    encodeURIComponent("123Vietnam") +
    "@cluster0.zcspb.mongodb.net/zazzle?retryWrites=true&w=majority";
csvFilePath = "./info.csv";
localDB = "mongodb://127.0.0.1:27017/zazzle";
remoteDB = "mongodb://noobz:$VYHRnc$wFcb*27S@35.220.228.32/zazzle?retryWrites=true&w=majority";
module.exports = {
    mongoURI: dbPassword,
    localURI: localDB,
    csvFilePath: csvFilePath,
    remoteDB: remoteDB,
};
