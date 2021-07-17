const { isMainThread } = require('worker_threads');
const connectDB = require('../models/index');
const { reductionOutAdsXMLAzyk, setSingleOutXMLAzyk } = require('../module/singleOutXMLAzyk');
const { checkAdss } = require('../graphql/adsAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const AdsAzyk = require('../models/adsAzyk');
const OrderAzyk = require('../models/orderAzyk');
const cron = require('node-cron');
const ModelsErrorAzyk = require('../models/errorAzyk');
const SingleOutXMLAzyk = require('../models/singleOutXMLAzyk');
const SingleOutXMLReturnedAzyk = require('../models/singleOutXMLReturnedAzyk');
const OutXMLShoroAzyk = require('../models/integrate/shoro/outXMLShoroAzyk');
const OutXMLReturnedShoroAzyk = require('../models/integrate/shoro/outXMLReturnedShoroAzyk');
const { pubsub } = require('../graphql/index');
const RELOAD_ORDER = 'RELOAD_ORDER';

connectDB.connect()
if(!isMainThread) {
    cron.schedule('1 3 * * *', async() => {
        try{
            let dateStart = new Date()
            dateStart.setHours(3, 0, 0, 0)
            dateStart.setDate(dateStart.getDate() - 1)
            let dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            let organizations = await OrganizationAzyk.find({
                autoAccept: true
            }).distinct('_id').lean()
            let orders = await InvoiceAzyk.find({
                del: {$ne: 'deleted'},
                taken: {$ne: true},
                cancelClient: null,
                cancelForwarder: null,
                $and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}],
                organization: {$in: organizations}
            })
            //.select('client organization orders dateDelivery paymentMethod number _id inv')
                .populate({
                    path: 'client',
                    //  select: '_id'
                })
                .populate({
                    path: 'organization',
                    //   select: '_id pass'
                })
                .populate({
                    path: 'orders',
                    //  select: '_id item count returned allPrice ',
                    populate: {
                        path: 'item',
                        //    select: '_id priotiry packaging'
                    }
                })
                .populate({path: 'agent'})
                .populate({path: 'provider'})
                .populate({path: 'sale'})
                .populate({path: 'forwarder'})

            for(let i = 0; i<orders.length;i++) {
                orders[i].taken = true
                await OrderAzyk.updateMany({_id: {$in: orders[i].orders.map(element=>element._id)}}, {status: 'принят'})
                orders[i].adss = await checkAdss(orders[i])
                if(orders[i].organization.pass&&orders[i].organization.pass.length){
                    orders[i].sync = await setSingleOutXMLAzyk(orders[i])
                }
                await orders[i].save()
                orders[i].adss = await AdsAzyk.find({_id: {$in: orders[i].adss}})
                pubsub.publish(RELOAD_ORDER, { reloadOrder: {
                    who: null,
                    client: orders[i].client._id,
                    agent: orders[i].agent?orders[i].agent._id:undefined,
                    superagent: undefined,
                    organization: orders[i].organization._id,
                    distributer: undefined,
                    invoice: orders[i],
                    manager: undefined,
                    type: 'SET'
                } });
            }
            organizations = await OrganizationAzyk.find({
                $and: [
                    {pass: {$ne: null}},
                    {pass: {$ne: ''}},
                ]
            }).distinct('pass').lean()
            for(let i = 0; i<organizations.length;i++) {
                await reductionOutAdsXMLAzyk(organizations[i])
            }
            let date = new Date()
            if(date.getDay()===1) {
                date.setDate(date.getDate() - 7)
                await SingleOutXMLAzyk.deleteMany({date: {$lte: date}})
                await OutXMLShoroAzyk.deleteMany({date: {$lte: date}})
                await SingleOutXMLReturnedAzyk.deleteMany({date: {$lte: date}})
                await OutXMLReturnedShoroAzyk.deleteMany({date: {$lte: date}})
            }
        } catch (err) {
            let _object = new ModelsErrorAzyk({
                err: err.message,
                path: 'singleOutXMLAzyk thread'
            });
            ModelsErrorAzyk.create(_object)
            console.error(err)
        }
    });
}