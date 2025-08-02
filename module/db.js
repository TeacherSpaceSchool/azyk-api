const OrderAzyk = require('../models/orderAzyk');
const ReturnedAzyk = require('../models/returnedAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const HistoryOrderAzyk = require('../models/historyOrderAzyk');
const RouteAzyk = require('../models/routeAzyk');
const SingleOutXMLAzyk = require('../models/singleOutXMLAzyk');
const SingleOutXMLReturnedAzyk = require('../models/singleOutXMLReturnedAzyk');
const AgentHistoryGeoAzyk = require('../models/agentHistoryGeoAzyk');
const BasketAzyk = require('../models/basketAzyk');
const ConnectionApplicationAzyk = require('../models/connectionApplicationAzyk');
const HistoryReturnedAzyk = require('../models/historyReturnedAzyk');
const MerchandisingAzyk = require('../models/merchandisingAzyk');

const dates = [
    new Date('2020-01-01T03:00:00.000Z'),
    new Date('2021-01-01T03:00:00.000Z'),
    new Date('2022-01-01T03:00:00.000Z'),
    new Date('2023-01-01T03:00:00.000Z'),
    new Date('2024-01-01T03:00:00.000Z'),
]

const models = [
    OrderAzyk, InvoiceAzyk, RouteAzyk, HistoryOrderAzyk, ReturnedAzyk, SingleOutXMLReturnedAzyk, SingleOutXMLAzyk, AgentHistoryGeoAzyk, BasketAzyk,
    ConnectionApplicationAzyk, HistoryReturnedAzyk, MerchandisingAzyk
]

module.exports.reductionOldestDB = async() => {
    console.log('reductionOldestDB start')
    // eslint-disable-next-line no-undef
    for(let idx=0; idx<dates.length; idx++) {
        const date = dates[idx]
        console.log(`start ${idx+1}/${dates.length}`)
        for(const model of models) {
            await model.deleteMany({createdAt: {$lte: date}})
       }
        console.log(`end ${idx+1}/${dates.length}`)
   }
    console.log('reductionOldestDB end')
}

module.exports.compactOldestDB = async() => {
    console.log('compactDB start')
    for(let idx=0; idx<models.length; idx++) {
        console.log(`start ${idx+1}/${models.length}`)
        const model = models[idx]
        await model.db.db.command({compact: model.collection.name});
        console.log(`end ${idx+1}/${models.length}`)
   }
    console.log('compactDB end')
}



