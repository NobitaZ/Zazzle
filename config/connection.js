const mongoose = require("mongoose");
const config = require("./keys");
let _db;
// module.exports = {
//     connectToServer: () => {
//         let result = false;
//         let db = process.env.NODE_ENV !== "development" ? config.mongoURI : config.remoteDB;
//         mongoose
//             .connect(db, { keepAlive: true, useNewUrlParser: true, useUnifiedTopology: true })
//             .then((v) => {
//                 console.log("MongoDB Connected");
//                 _db = mongoose.connection;
//                 result = true;
//             })
//             .catch((err) => {
//                 log.error(err);
//                 console.log("MongoDB Error");
//             });
//         return result;
//     },
//     getDb: () => {

//         return mongoose.connection;
//     },
// };

module.exports = {
  connectToServer: () => {
    let db = process.env.NODE_ENV !== "development" ? process.env.PRODUCTION_DB2 : process.env.REMOTE_DB;
    mongoose
      .connect(db, { keepAlive: true, useNewUrlParser: true, useUnifiedTopology: true })
      .then(() => {
        console.log("MongoDB Connected");
      })
      .catch((err) => {
        console.log("MongoDB Error");
      });

    global.db = global.db ? global.db : mongoose.connection;
    // mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true });
    // _db = mongoose.connection;
  },
  getDb: () => {
    return global.db;
  },
};
