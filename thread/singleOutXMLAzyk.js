const {isMainThread} = require('worker_threads');
const connectDB = require('../models/index');
const {reductionOutAdsXMLAzyk} = require('../module/singleOutXMLAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const OrderAzyk = require('../models/orderAzyk');
const cron = require('node-cron');
const ModelsErrorAzyk = require('../models/errorAzyk');
const SingleOutXMLAzyk = require('../models/singleOutXMLAzyk');
const SingleOutXMLReturnedAzyk = require('../models/singleOutXMLReturnedAzyk');
const {acceptOrders} = require('../graphql/orderAzyk');
const {unawaited, sendPushToAdmin} = require('../module/const');

connectDB.connect()
if(!isMainThread) {
    cron.schedule('1 3 * * *', async() => {
        try {
            //только за сегодня
            const dateEnd = new Date()
            dateEnd.setHours(3, 0, 0, 0)
            const dateStart = new Date(dateEnd)
            dateStart.setDate(dateStart.getDate() - 1)
            //организации для интеграции
            const organizations = await OrganizationAzyk.find({pass: {$nin: ['', null]}}).distinct('_id')
            //несинхронизованные заказы
            const unsynces = await InvoiceAzyk.find({
                createdAt: {$gte: dateStart, $lt: dateEnd},
                sync: {$nin: [1, 2]},
                cancelClient: null,
                cancelForwarder: null,
                del: {$ne: 'deleted'},
                taken: true,
                organization: {$in: organizations},
           }).select('_id orders').lean()
            let unsyncorders = [], unsyncinvoices = []
            for(let i = 0; i<unsynces.length;i++) {
                unsyncorders = [...unsyncorders, ...unsynces[i].orders]
                unsyncinvoices = [...unsyncinvoices, unsynces[i]._id]
           }
            // eslint-disable-next-line no-undef
            await Promise.all([
                OrderAzyk.updateMany({_id: {$in: unsyncorders}}, {status: 'обработка'}),
                InvoiceAzyk.updateMany({_id: {$in: unsyncinvoices}}, {taken: false, cancelClient: null, cancelForwarder: null})
            ])
            //автоприем заказов
            await acceptOrders()
            //генерация акционых заказов
            // eslint-disable-next-line no-undef
            await Promise.all(organizations.map(organization => reductionOutAdsXMLAzyk(organization)));
            //очистка выгрузок
            let date = new Date()
            date.setDate(date.getDate() - 7)
            // eslint-disable-next-line no-undef
            await Promise.all([
                SingleOutXMLAzyk.deleteMany({date: {$lte: date}}),
                SingleOutXMLReturnedAzyk.deleteMany({date: {$lte: date}}),
            ])
       }
        catch (err) {
            unawaited(() => ModelsErrorAzyk.create({err: err.message, path: 'singleOutXMLAzyk.js'}))
            unawaited(() =>  sendPushToAdmin({message: 'Ошибка singleOutXMLAzyk.js'}))
       }
   });
}