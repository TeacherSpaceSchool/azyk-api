const express = require('express');
const router = express.Router();
const { sendWebPush } = require('../module/webPush');
const UserAzyk = require('../models/userAzyk');
const NotificationStatisticAzyk = require('../models/notificationStatisticAzyk');
const ModelsErrorAzyk = require('../models/errorAzyk');

router.get('/admin', async (req, res) => {
    try{
        let user = await UserAzyk.findOne({role: 'admin'}).select('_id').lean()
        if(user){
            sendWebPush({title: 'AZYK.STORE', message: 'Не забудьте сделать свой заказ', user: user._id})
            res.json('Push triggered');
        }
        else {
            res.json('Push error');
        }
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'push admin'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.get('/all', (req, res) => {
    try{
        sendWebPush({title: 'AZYK.STORE', message: 'Не забудьте сделать свой заказ', user: 'all'})
        res.json('Push triggered');
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'push all'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/clicknotification', async (req, res) => {
    try{
        //let ip = JSON.stringify(req.ip)
        let object = await NotificationStatisticAzyk.findOne({_id: req.body.notification})
        if(object/*&&!object.ips.includes(ip)*/){
            object.click+=1
            //object.ips.push(ip)
            await object.save()
        }
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'clicknotification'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

module.exports = router;