const SubscriberAzyk = require('../models/subscriberAzyk');
const NotificationStatisticAzyk = require('../models/notificationStatisticAzyk');
const q = require('q');
const webPush = require('web-push');
const keys = require((process.env.URL).trim()==='https://azyk.store'?'./../config/keys_prod':'./../config/keys_dev');

module.exports.sendWebPush = async({title, message, tag, url, icon, user}) => {
    const payload = {
        title: title?title:title,
        message: message?message:message,
        url: url?url:'https://azyk.store',
        icon: icon?icon:'https://azyk.store/static/192x192.png',
        tag: tag?tag:'AZYK.STORE'
    };
    let _object = new NotificationStatisticAzyk({
        tag: payload.tag,
        url: payload.url,
        icon: payload.icon,
        title: payload.title,
        text: payload.message,
        delivered: 0,
        failed: 0,
    });
    _object = await NotificationStatisticAzyk.create(_object)
    payload._id = _object._id
    if(user==='all'){
        SubscriberAzyk.find({}, (err, subscriptions) => {
            if (err) {
                console.error('Error occurred while getting subscriptions');
            } else {
                let parallelSubscriberAzykCalls = subscriptions.map((subscription) => {
                    return new Promise((resolve, reject) => {
                        const pushSubscriberAzyk = {
                            endpoint: subscription.endpoint,
                            keys: {
                                p256dh: subscription.keys.p256dh,
                                auth: subscription.keys.auth
                            }
                        };

                        const pushPayload = JSON.stringify(payload);
                        const pushOptions = {
                            vapidDetails: {
                                subject: 'https://azyk.store',
                                privateKey: keys.privateKey,
                                publicKey: keys.publicKey
                            },
                            headers: {}
                        };
                        webPush.sendNotification(
                            pushSubscriberAzyk,
                            pushPayload,
                            pushOptions
                        ).then((value) => {
                            resolve({
                                status: true,
                                endpoint: subscription.endpoint,
                                data: value
                            });
                        }).catch((err) => {
                            reject({
                                status: false,
                                endpoint: subscription.endpoint,
                                data: err
                            });
                        });
                    });
                });
                q.allSettled(parallelSubscriberAzykCalls).then(async(pushResults) => {
                    try{
                        let delivered = 0;
                        let failed = 0;
                        for(let i=0; i<pushResults.length; i++){
                            if(pushResults[i].state === 'rejected'||pushResults[i].reason)
                                failed+=1
                            else
                                delivered += 1
                        }
                        _object.delivered = delivered
                        _object.failed = failed
                        await _object.save()
                    } catch (err) {
                        console.error(err)
                    }
                });
            }
        }).lean();
    }
    else {
        SubscriberAzyk.find({user: user}, (err, subscriptions) => {
            if (err) {
                console.error('Error occurred while getting subscriptions');
            } else {
                let parallelSubscriberAzykCalls = subscriptions.map((subscription) => {
                    return new Promise((resolve, reject) => {
                        const pushSubscriberAzyk = {
                            endpoint: subscription.endpoint,
                            keys: {
                                p256dh: subscription.keys.p256dh,
                                auth: subscription.keys.auth
                            }
                        };

                        const pushPayload = JSON.stringify(payload);
                        const pushOptions = {
                            vapidDetails: {
                                subject: 'https://azyk.store',
                                privateKey: keys.privateKey,
                                publicKey: keys.publicKey
                            },
                            headers: {}
                        };
                        webPush.sendNotification(
                            pushSubscriberAzyk,
                            pushPayload,
                            pushOptions
                        ).then((value) => {
                            resolve({
                                status: true,
                                endpoint: subscription.endpoint,
                                data: value
                            });
                        }).catch((err) => {
                            reject({
                                status: false,
                                endpoint: subscription.endpoint,
                                data: err
                            });
                        });
                    });
                });
                q.allSettled(parallelSubscriberAzykCalls).then(async (pushResults) => {
                    try{
                        let delivered = 0;
                        let failed = 0;
                        const subscriptionsForDelete = []
                        for(let i=0; i<pushResults.length; i++){
                            if(pushResults[i].state === 'rejected'||pushResults[i].reason) {
                                failed += 1
                                try{
                                    if([410, 404].includes(pushResults[i].reason.data.statusCode)) {
                                        subscriptionsForDelete.push(pushResults[i].reason.endpoint)
                                    }
                                } catch (err) {/**/}
                            }
                            else
                                delivered += 1
                        }
                        _object.delivered = delivered
                        _object.failed = failed
                        await _object.save()
                        await SubscriberAzyk.deleteMany({endpoint: {$in: subscriptionsForDelete}})
                    } catch (err) {
                        console.error(err)
                    }
                });
            }
        }).lean();
    }

 }
