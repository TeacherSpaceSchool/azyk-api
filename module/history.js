const HistoryAzyk = require('../models/historyAzyk');
const {isNotEmpty} = require('./const');

module.exports.historyTypes = {
    'create': 0,
    'set': 1,
    'delete': 2,
}

module.exports.addHistory = async ({user, type, model, name, data, object}) => {
    if(data) {
        const keys = Object.keys(data)
        for (const key of keys) {
            if (!isNotEmpty(data[key])) {
                delete data[key]
           }
       }
        data = JSON.stringify(data)
   }
    await HistoryAzyk.create({
        employment: user.employment, client: user.client, user: user._id,
        type, model, name, data, object
   })
}