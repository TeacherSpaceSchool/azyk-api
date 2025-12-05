const SubscriberAzyk = require('../models/subscriberAzyk');
const NotificationStatisticAzyk = require('../models/notificationStatisticAzyk');
const q = require('q');
const webPush = require('web-push');
const keys = require((process.env.URL).trim()==='https://azyk.store'?'./../config/keys_prod':'./../config/keys_dev');

module.exports.sendWebPush = async({title, message, url, icon, users, excludedUsers, type}) => {
    const payload = {
        title: title?title:'AZYK.STORE',
        message,
        url: url?url:'https://azyk.store',
        icon: icon?icon:'https://azyk.store/static/192x192.png',
        tag: new Date().getTime(),
        type
   };
    let _object = await NotificationStatisticAzyk.create({...payload, delivered: 0, failed: 0})
    payload._id = _object._id
    SubscriberAzyk.find({
        ...users||excludedUsers?{$and: [...users?[{user: {$in: users}}]:[], ...excludedUsers?[{user: {$nin: excludedUsers}}]:[],]}:{}
    }, (err, subscriptions) => {
        if (err) {
            console.error('Error occurred while getting subscriptions');
       } else {
            let parallelSubscriberAzykCalls = subscriptions.map((subscription) => {
                // eslint-disable-next-line no-undef
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
                    const subscriptionsForDelete = [];
                    for(let i=0; i<pushResults.length; i++) {
                        if(pushResults[i].state === 'rejected'||pushResults[i].reason) {
                            failed += 1
                            try {
                                if ([410, 404, 403, 400].includes(pushResults[i].reason.data.statusCode)) {
                                    subscriptionsForDelete.push(pushResults[i].reason.endpoint);
                               }
                           } catch (err) {/**/}
                       }
                        else
                            delivered += 1
                    }
                    _object.delivered = delivered
                    _object.failed = failed
                    await _object.save()

                    if (subscriptionsForDelete.length) {
                        await SubscriberAzyk.deleteMany({endpoint: {$in: subscriptionsForDelete}});
                   }
               } catch (err) {
                    console.error(err)
               }
           });
       }
   }).lean();

}
