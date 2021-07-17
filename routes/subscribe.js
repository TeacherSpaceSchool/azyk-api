const express = require('express');
const router = express.Router();
const randomstring = require('randomstring');
const SubscriberAzyk = require('../models/subscriberAzyk');
const ClientAzyk = require('../models/clientAzyk');
const passportEngine = require('../module/passport');
const ModelsErrorAzyk = require('../models/errorAzyk');

router.post('/register', async (req, res) => {
    await passportEngine.getuser(req, res, async (user)=> {
        try {
            let subscriptionModel;
            let number = req.body.number
            subscriptionModel = await SubscriberAzyk.findOne({$or: [{number: number}, {endpoint: req.body.endpoint}]})
            if (subscriptionModel) {
                if (user) subscriptionModel.user = user._id
                subscriptionModel.endpoint = req.body.endpoint
                subscriptionModel.keys = req.body.keys
            }
            else {
                number = randomstring.generate({length: 20, charset: 'numeric'});
                while (await SubscriberAzyk.findOne({number: number}).select('_id').lean())
                    number = randomstring.generate({length: 20, charset: 'numeric'});
                subscriptionModel = new SubscriberAzyk({
                    endpoint: req.body.endpoint,
                    keys: req.body.keys,
                    number: number,
                });
                if (user) subscriptionModel.user = user._id
            }
            if (user.role === 'client') {
                let client = await ClientAzyk.findOne({user: user._id})
                client.notification = true
                await client.save()
            }
            subscriptionModel.save((err) => {
                if (err) {
                    console.error(`Error occurred while saving subscription. Err: ${err}`);
                    res.status(500).json({
                        error: 'Technical error occurred'
                    });
                } else {
                    console.log('Subscription saved');
                    res.send(subscriptionModel.number)
                }
            });
        } catch (err) {
            let _object = new ModelsErrorAzyk({
                err: err.message,
                path: 'register subscribe'
            });
            ModelsErrorAzyk.create(_object)
            console.error(err)
            res.status(501);
            res.end('error')
        }
    })
});

router.post('/unregister', async (req, res) => {
    try{
        let subscriptionModel = await SubscriberAzyk.findOne({number: req.body.number}).populate({ path: 'user'})
        if(subscriptionModel.user&&subscriptionModel.user.role==='client'&&(await SubscriberAzyk.find({user: subscriptionModel.user._id})).length===1){
            let client = await ClientAzyk.findOne({user: subscriptionModel.user._id})
            if(client) {
                client.notification = false
                await client.save()
            }
        }
        subscriptionModel.user = null
        await subscriptionModel.save()
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'unregister subscribe'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

router.post('/delete', async (req, res) => {
    try{
        let subscriptionModel = await SubscriberAzyk.findOne({number: req.body.number}).populate({ path: 'user'})
        if(subscriptionModel.user&&subscriptionModel.user.role==='client'&&(await SubscriberAzyk.find({user: subscriptionModel.user._id})).length===1){
            let client = await ClientAzyk.findOne({user: subscriptionModel.user._id})
            client.notification = false
            await client.save()
        }
        await SubscriberAzyk.deleteMany({number: req.body.number})
    } catch (err) {
        let _object = new ModelsErrorAzyk({
            err: err.message,
            path: 'delete subscribe'
        });
        ModelsErrorAzyk.create(_object)
        console.error(err)
        res.status(501);
        res.end('error')
    }
});

module.exports = router;