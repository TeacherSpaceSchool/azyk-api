const { isMainThread } = require('worker_threads');
const connectDB = require('../models/index');
const {sendWebPush} = require('../module/webPush');
const cron = require('node-cron');
const ModelsErrorAzyk = require('../models/errorAzyk');
connectDB.connect()
if(!isMainThread) {
    cron.schedule('1 20 * * 1,3,5', async() => {
        try{
            sendWebPush({title: 'AZYK.STORE', message: 'Не забудьте сделать свой заказ', user: 'all'})
        } catch (err) {
            let _object = new ModelsErrorAzyk({
                err: err.message,
                path: 'reminderClient thread'
            });
            ModelsErrorAzyk.create(_object)
            console.error(err)
        }
    });
}