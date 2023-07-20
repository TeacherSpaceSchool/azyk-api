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
const HistoryOrderAzyk = require('../models/historyOrderAzyk');
const { pubsub } = require('../graphql/index');
const RELOAD_ORDER = 'RELOAD_ORDER';

connectDB.connect()
if(!isMainThread) {
    cron.schedule('1 3 * * *', async() => {
        try {
            //автоприемом только за сегодня
            const dateEnd = new Date()
            dateEnd.setHours(3, 0, 0, 0)
            const dateStart = new Date(dateEnd)
            dateStart.setDate(dateStart.getDate() - 1)
            //несинхронизованные заказы
            let organizations = await OrganizationAzyk.find({pass: {$nin: ['', null]}}).distinct('_id').lean()
            const unsynces = await InvoiceAzyk.find({
                $and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}],
                sync: {$nin: [1, 2]},
                cancelClient: null,
                cancelForwarder: null,
                del: {$ne: 'deleted'},
                taken: true,
                organization: {$in: organizations},
            })
                .select('_id orders')
                .lean()
            let unsyncorders = [], unsyncinvoices = []
            for(let i = 0; i<unsynces.length;i++) {
                unsyncorders = [...unsyncorders, ...unsynces[i].orders]
                unsyncinvoices = [...unsyncinvoices, unsynces[i]._id]
            }
            await OrderAzyk.updateMany({_id: {$in: unsyncorders}}, {status: 'обработка'})
            await InvoiceAzyk.updateMany({_id: {$in: unsyncinvoices}}, {
                taken: false,
                cancelClient: null,
                cancelForwarder: null,
            })
            //автоприем заказов
            organizations = await OrganizationAzyk.find({autoAcceptNight: true}).distinct('_id').lean()
            let invoices = await InvoiceAzyk.find({
                del: {$ne: 'deleted'},
                taken: {$ne: true},
                cancelClient: null,
                cancelForwarder: null,
                $and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}],
                organization: {$in: organizations},
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
            for(let i = 0; i<invoices.length;i++) {
                invoices[i].taken = true
                await OrderAzyk.updateMany({_id: {$in: invoices[i].orders.map(element=>element._id)}}, {status: 'принят'})
                invoices[i].adss = await checkAdss(invoices[i])
                if (invoices[i].organization.pass && invoices[i].organization.pass.length) {
                    invoices[i].sync = await setSingleOutXMLAzyk(invoices[i])
                }
                ///заглушка
                else {
                    let _object = new ModelsErrorAzyk({
                        err: `${invoices[i].number} Отсутствует organization.pass ${invoices[i].organization.pass}`,
                        path: 'автоприем'
                    });
                    await ModelsErrorAzyk.create(_object)
                }
                invoices[i].editor = 'автоприем'
                let objectHistoryOrder = new HistoryOrderAzyk({
                    invoice: invoices[i]._id,
                    orders: invoices[i].orders.map(order=>{
                        return {
                            item: order.name,
                            count: order.count,
                            consignment: order.consignment,
                            returned: order.returned
                        }
                    }),
                    editor: 'автоприем',
                });
                await HistoryOrderAzyk.create(objectHistoryOrder);
                await invoices[i].save()
                invoices[i].adss = await AdsAzyk.find({_id: {$in: invoices[i].adss}})
                pubsub.publish(RELOAD_ORDER, { reloadOrder: {
                    who: null,
                    client: invoices[i].client._id,
                    agent: invoices[i].agent?invoices[i].agent._id:undefined,
                    superagent: undefined,
                    organization: invoices[i].organization._id,
                    distributer: undefined,
                    invoice: invoices[i],
                    manager: undefined,
                    type: 'SET'
                } });
            }
            //генерация акционых заказов
            organizations = await OrganizationAzyk.find({
                $and: [
                    {pass: {$ne: null}},
                    {pass: {$ne: ''}},
                ]
            }).distinct('pass').lean()
            for(let i = 0; i<organizations.length;i++) {
                await reductionOutAdsXMLAzyk(organizations[i])
            }
            //очистка выгрузок
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