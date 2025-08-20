const {isMainThread} = require('worker_threads');
const connectDB = require('../models/index');
const {sendWebPush} = require('../module/webPush');
const cron = require('node-cron');
const ModelsErrorAzyk = require('../models/errorAzyk');
const {unawaited, sendPushToAdmin, formatErrorDetails} = require('../module/const');
const UserAzyk = require('../models/userAzyk');
const {roleList} = require('../module/enum');
connectDB.connect()
if(!isMainThread) {
    cron.schedule('1 20 * * 1,3,5', async() => {
        try {
            const adminUser = await UserAzyk.findOne({role: roleList.admin}).select('_id').lean()
            unawaited(() => sendWebPush({title: 'AZYK.STORE', message: 'Не забудьте сделать свой заказ', excludedUsers: [adminUser._id]}))
        } catch (err) {
            console.error(err)
            unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'reminderClient.js'}))
            unawaited(() =>  sendPushToAdmin({message: 'Ошибка reminderClient.js'}))
        }
   });
}