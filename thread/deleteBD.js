const {isMainThread} = require('worker_threads');
const connectDB = require('../models/index');
const cron = require('node-cron');
const MerchandisingAzyk = require('../models/merchandisingAzyk');
const NotificationStatistic = require('../models/notificationStatisticAzyk');
const {deleteFile, unawaited, sendPushToAdmin, formatErrorDetails} = require('../module/const');
const {parallelPromise} = require('../module/parallel');
const ModelsErrorAzyk = require('../models/errorAzyk');
const AgentHistoryGeoAzyk = require('../models/agentHistoryGeoAzyk');
const HistoryOrderAzyk = require('../models/historyOrderAzyk');
const HistoryAzyk = require('../models/historyAzyk');
const IntegrationLogAzyk = require('../models/integrationLogAzyk');
const NotificationStatisticAzyk = require('../models/notificationStatisticAzyk');

connectDB.connect();

if(!isMainThread) {
    cron.schedule('1 4 * * *', async() => {
        try {
            let date = new Date()
            date.setDate(date.getDate() - 60)
            // eslint-disable-next-line no-undef
            const [merchandisingImages, notificationStatisticIcons] = await Promise.all([
                MerchandisingAzyk.find({createdAt: {$lte: date}}).distinct('images'),
                NotificationStatistic.find({createdAt: {$lte: date}}).distinct('icon')
            ])
            const filesForDelete = [...merchandisingImages, ...notificationStatisticIcons]
            await parallelPromise(filesForDelete, async (fileForDelete) => await deleteFile(fileForDelete))
            // eslint-disable-next-line no-undef
            await Promise.all([
                NotificationStatistic.deleteMany({createdAt: {$lte: date}}),
                MerchandisingAzyk.deleteMany({createdAt: {$lte: date}}),
                AgentHistoryGeoAzyk.deleteMany({createdAt: {$lte: date}}),
                HistoryOrderAzyk.deleteMany({createdAt: {$lte: date}}),
                HistoryAzyk.deleteMany({createdAt: {$lte: date}}),
                IntegrationLogAzyk.deleteMany({createdAt: {$lte: date}}),
                NotificationStatisticAzyk.deleteMany({createdAt: {$lte: date}})
            ])

       }
        catch (err) {
            console.error(err)
            unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'deleteBD.js'}))
            unawaited(() =>  sendPushToAdmin({message: 'Ошибка deleteBD.js'}))
       }
   });
}