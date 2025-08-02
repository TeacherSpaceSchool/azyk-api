let mongoose = require('mongoose');
let connect = function() {
        mongoose.connect('mongodb://localhost:27017/admin', {
                keepAlive: 1,
                useCreateIndex: true,
                useNewUrlParser: true,
                reconnectTries: Number.MAX_VALUE,
                reconnectInterval: 1000,
                //socketTimeoutMS: 45000,
                //connectTimeoutMS: 30000,
           },
        function (err) {
            if (err) {
                console.log('error');
                throw err;
           }
            //console.log('Successfully connected');
       });
};
module.exports.connect = connect;