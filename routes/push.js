const express = require('express');
const router = express.Router();
const {sendWebPush} = require('../module/webPush');
const UserAzyk = require('../models/userAzyk');
const NotificationStatisticAzyk = require('../models/notificationStatisticAzyk');
const ModelsErrorAzyk = require('../models/errorAzyk');
const {unawaited, formatErrorDetails} = require('../module/const');

router.get('/admin', async (req, res) => {
    try{
        const adminUser = await UserAzyk.findOne({role: 'admin'}).select('_id').lean()
        if(adminUser) {
            unawaited(() => sendWebPush({title: 'AZYK.STORE', message: 'Не забудьте сделать свой заказ', users: [adminUser._id]}))
            res.json('Push triggered');
       }
        else {
            res.json('Push error');
       }
   } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'push admin'}))
        console.error(err)
        res.status(501);
        res.end('error')
   }
});

router.post('/clicknotification', async (req, res) => {
    try{
        //let ip = JSON.stringify(req.ip)
        let object = await NotificationStatisticAzyk.findById(req.body.notification)
        if(object/*&&!object.ips.includes(ip)*/) {
            object.click+=1
            //object.ips.push(ip)
            await object.save()
       }
   } catch (err) {
        unawaited(() => ModelsErrorAzyk.create({err: formatErrorDetails(err), path: 'clicknotification'}))
        console.error(err)
        res.status(501);
        res.end('error')
   }
});

module.exports = router;