const {isMainThread} = require('worker_threads');
const connectDB = require('../models/index');
const cron = require('node-cron');
const app = require('../app');
const fs = require('fs');
const path = require('path');
const {unawaited, sendPushToAdmin} = require('../module/const');
const ModelsErrorAzyk = require('../models/errorAzyk');
connectDB.connect();
if(!isMainThread) {
    cron.schedule('1 3 * * *', async() => {
        try {
            fs.readdir(path.join(app.dirname, 'public', 'xlsx'), async (err, files) => {
                for(const file of files) {
                    fs.unlink(path.join(app.dirname, 'public', 'xlsx', file))
               }
           });
       } catch (err) {
            unawaited(() => ModelsErrorAzyk.create({err: err.message, path: 'resetUnloading.js'}))
            unawaited(() =>  sendPushToAdmin({message: 'Ошибка resetUnloading.js'}))
       }
   });
}