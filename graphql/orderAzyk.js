const OrderAzyk = require('../models/orderAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const DistrictAzyk = require('../models/districtAzyk');
///const BasketAzyk = require('../models/basketAzyk');
const ItemAzyk = require('../models/itemAzyk');
const ClientAzyk = require('../models/clientAzyk');
const mongoose = require('mongoose');
const DiscountClient = require('../models/discountClientAzyk');
const {setSingleOutXMLAzykLogic} = require('../module/singleOutXMLAzyk');
const {pubsub} = require('./index');
const {withFilter} = require('graphql-subscriptions');
const RELOAD_ORDER = 'RELOAD_ORDER';
const HistoryOrderAzyk = require('../models/historyOrderAzyk');
const {
    checkFloat, reductionSearch, unawaited, isNotEmpty, generateUniqueNumber, checkDate, dayStartDefault, defaultLimit, reductionSearchText,
    sendPushToAdmin,
    pdDDMMHHMM,
    pdHHMM
} = require('../module/const');
const {checkAdss} = require('../graphql/adsAzyk');
const SpecialPriceClientAzyk = require('../models/specialPriceClientAzyk');
const { v1: uuidv1 } = require('uuid');
const {calculateStock} = require('../module/stockAzyk');
const SpecialPriceCategory = require('../models/specialPriceCategoryAzyk');
const {calculateConsig} = require('../module/consigFlow');
const SingleOutXMLAzyk = require('../models/singleOutXMLAzyk');
const ModelsErrorAzyk = require('../models/errorAzyk');

const type = `
  type Order {
    _id: ID
    createdAt: Date
    updatedAt: Date
    item: Item
    client: Client
    count: Int
    allPrice: Float
    status: String
    allTonnage: Float
    rejected: Int

    returned: Int
    consignmentPrice: Float
    consignment: Int
    allSize: Float
}
  type Invoice {
    _id: ID
     discount: Int
     inv: Int
    createdAt: Date
    updatedAt: Date
    orders: [Order]
    client: Client
    allPrice: Float 
    rejectedPrice: Float
    info: String
    address: [String]
    paymentMethod: String
    district: String
    number: String
    confirmationForwarder: Boolean
    confirmationClient: Boolean
    sync: Int
    cancelClient: Date
    cancelForwarder: Date
    taken: Boolean
    dateDelivery: Date
    agent: Employment
    allTonnage: Float
    editor: String
    organization: Organization
    del: String
    city: String
    adss: [Ads]
    track: Int
    forwarder: Employment
    returned: Float
    consig: Float
     
    returnedPrice: Float
    priority: Int
    paymentConsignation: Boolean
    consignmentPrice: Float
    provider: Organization
    sale: Organization
    allSize: Float
 }
  type HistoryOrder {
    createdAt: Date
    invoice: ID
    orders: [HistoryOrderElement]
    editor: String
    status: String
 }
  type HistoryOrderElement {
    item: String
    count: Int
    rejected: Int
    
    returned: Int
    consignment: Int
 }
  type ReloadOrder {
    who: ID
    client: ID
    agent: ID
    superagent: ID
    manager: ID
    organization: ID
    invoice: Invoice
    type: String
 }
  input OrderInput {
    _id: ID
    count: Int
    allPrice: Float
    allTonnage: Float
    name: String
    status: String
    rejected: Int
    
    returned: Int
    consignment: Int
    consignmentPrice: Float
 }
`;

const query = `
    invoices(search: String!, sort: String!, filter: String!, date: String!, skip: Int, organization: ID, city: String, track: Int, forwarder: ID, dateDelivery: Date, agent: ID, district: ID): [Invoice]
    invoicesSimpleStatistic(search: String!, filter: String!, date: String, organization: ID, city: String, forwarder: ID, track: Int, dateDelivery: Date, agent: ID, district: ID): [String]
    orderHistorys(invoice: ID!): [HistoryOrder]
    invoice(_id: ID!): Invoice
`;

const mutation = `
    acceptOrders: String
    addOrders(stamp: String, baskets: [OrderInput], dateDelivery: Date!, info: String, inv: Boolean, unite: Boolean, paymentMethod: String, organization: ID!, client: ID!): String
    setOrder(orders: [OrderInput], invoice: ID): Invoice
    setInvoice(adss: [ID], taken: Boolean, invoice: ID!, confirmationClient: Boolean, confirmationForwarder: Boolean, cancelClient: Boolean, cancelForwarder: Boolean): String
    setInvoicesLogic(dateDelivery: Date!, track: Int, forwarder: ID, paymentMethod: String, invoices: [ID]!): String
    setInvoicesDateDelivery(dateDelivery: Date!, invoices: [ID]!): String
    deleteOrders(ids: [ID]!): String
`;

const subscription  = `
    reloadOrder: ReloadOrder
`;

const resolvers = {
    invoicesSimpleStatistic: async(parent, {search, filter, date, organization, city, agent, track, district, forwarder, dateDelivery}, {user}) => {
        if(['суперорганизация', 'организация', 'client', 'admin', 'менеджер', 'агент', 'экспедитор', 'суперэкспедитор', 'суперагент'].includes(user.role)) {
            //дата доставки
            let dateStart;
            let dateEnd;
            if (date !== '') {
                dateStart = checkDate(date)
                dateStart.setHours(dayStartDefault, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
                if (['экспедитор', 'агент', 'суперэкспедитор', 'суперагент'].includes(user.role)) {
                    let now = new Date()
                    now.setDate(now.getDate() + 1)
                    now.setHours(dayStartDefault, 0, 0, 0)
                    let differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
                    if (differenceDates > user.agentHistory) {
                        dateStart = new Date()
                        dateStart.setHours(dayStartDefault, 0, 0, 0)
                        dateEnd = new Date(dateStart)
                        dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - user.agentHistory))
                    }
                }
            }
            else {
                dateStart = new Date()
                dateEnd = new Date(dateStart)
                if (dateStart.getHours()>=dayStartDefault)
                    dateEnd.setDate(dateEnd.getDate() + 1)
                else
                    dateStart.setDate(dateStart.getDate() - 1)
                dateStart.setHours(dayStartDefault, 0, 0, 0)
                dateEnd.setHours(dayStartDefault, 0, 0, 0)
            }
            //dateDelivery
            if(dateDelivery) dateDelivery.setHours(dayStartDefault, 0, 0, 0)
            //если пользователь экспедитор
            if(user.role==='экспедитор') forwarder = user.employment
            //поиск
            // eslint-disable-next-line no-undef
            const [districtClients, superagentOrganizations, integrationOrganizations, forwarderClients] = await Promise.all([
                district?DistrictAzyk.findById(district).distinct('client'):['агент', 'менеджер', 'суперагент'].includes(user.role)?DistrictAzyk.find({$or: [{manager: user.employment}, {agent: user.employment}]}).distinct('client'):null,
                user.role==='суперагент'?OrganizationAzyk.find({superagent: true}).distinct('_id'):null,
                filter==='Не синхронизированные'?OrganizationAzyk.find({pass: {$nin: ['', null]}}).distinct('_id'):null,
                forwarder?DistrictAzyk.find({forwarder}).distinct('client'):null,
            ]);
            //return
            const invoices = await InvoiceAzyk.find(
                {
                    //не удален
                    del: {$ne: 'deleted'},
                    //в период
                    createdAt: {$gte: dateStart, $lt: dateEnd},
                    //только в районах
                    ...districtClients? {client: {$in: districtClients}} : {},
                    //только в своей организации
                    ...user.organization?{organization: user.organization}:organization?{organization: new mongoose.Types.ObjectId(organization)}:{},
                    //город
                    ...city ? {city} : {},
                    //экспедитор
                    ...forwarder? {$or: [{client: {$in: forwarderClients}}, {forwarder}]} : {},
                    //рейс
                    ...track ? {track} : {},
                    //dateDelivery
                    ...dateDelivery ? {dateDelivery} : {},
                    //агент
                    ...agent ? {agent: new mongoose.Types.ObjectId(agent)} : {},
                    //клиент только свои
                    ...user.client ? {client: user.client} : {},
                    //суперагент только в доступных организациях
                    ...['суперагент', 'суперэкспедитор'].includes(user.role) ? {organization: {$in: superagentOrganizations}} : {},
                    //фильтр
                    ...filter === 'акция' ? {adss: {$ne: []}} : {},
                    ...filter==='обработка'?{taken: false, cancelClient: null, cancelForwarder: null}:{taken: true},
                    ...filter === 'Без геолокации' ? {address: {$elemMatch: {$eq: ''}}} : {},
                    ...(filter === 'Не синхронизированные' ? {organization: {$in: integrationOrganizations}, sync: {$nin: [1, 2]}, taken: true} : {}),
                    //поиск
                    ...search?{$or: [
                            {number: {$regex: reductionSearch(search), $options: 'i'}},
                            {info: {$regex: reductionSearchText(search), $options: 'i'}},
                            {address: {$regex: reductionSearchText(search), $options: 'i'}}
                        ]}:{},
                }
            )
                .select('rejectedPrice allPrice orders allTonnage')
                .lean()
            //перебор товаров
            let tonnage = 0;
            let price = 0;
            let lengthList = invoices.length;
            for(let i = 0; i < invoices.length; i++) {
                if (invoices[i].allPrice) {
                    price += invoices[i].allPrice - invoices[i].rejectedPrice
                }
                if (invoices[i].allTonnage)
                    tonnage += invoices[i].allTonnage
            }
            return [lengthList.toString(), checkFloat(price).toString(), checkFloat(tonnage).toString()]
        }
    },
    invoices: async(parent, {search, sort, filter, date, skip, organization, city, agent, district, forwarder, dateDelivery, track}, {user}) =>  {
        if(['суперорганизация', 'организация', 'client', 'admin', 'менеджер', 'агент', 'экспедитор', 'суперагент', 'суперэкспедитор'].includes(user.role)) {
            let dateStart;
            let dateEnd;
            if (date) {
                dateStart = checkDate(date)
                dateStart.setHours(dayStartDefault, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
                if (['суперагент', 'агент', 'суперэкспедитор', 'экспедитор'].includes(user.role)) {
                    let now = new Date()
                    now.setHours(dayStartDefault, 0, 0, 0)
                    now.setDate(now.getDate() + 1)
                    let differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
                    if (differenceDates > user.agentHistory) {
                        dateStart = new Date()
                        dateStart.setHours(dayStartDefault, 0, 0, 0)
                        dateEnd = new Date(dateStart)
                        dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - user.agentHistory))
                    }
                }
            }
            else if (['суперагент', 'агент', 'суперэкспедитор', 'экспедитор'].includes(user.role)) {
                dateEnd = new Date()
                dateEnd.setHours(dayStartDefault, 0, 0, 0)
                dateEnd.setDate(dateEnd.getDate() + 1)
                dateStart = new Date(dateEnd)
                dateStart = new Date(dateStart.setDate(dateStart.getDate() - user.agentHistory))
            }
            //заказы только за год
            else {
                dateEnd = new Date()
                dateStart = new Date()
                dateStart.setYear(dateStart.getFullYear()-1)
                dateStart.setHours(dayStartDefault, 0, 0, 0)
            }
            //dateDelivery
            if(dateDelivery) dateDelivery.setHours(dayStartDefault, 0, 0, 0)
            //сортировка
            let _sort = {}
            _sort[sort[0] === '-' ? sort.substring(1) : sort] = sort[0] === '-' ? -1 : 1
            //если пользователь экспедитор
            if(user.role==='экспедитор') forwarder = user.employment
            // eslint-disable-next-line no-undef
            const [districtClients, superagentOrganizations, integrationOrganizations, forwarderClients] = await Promise.all([
                district?DistrictAzyk.findById(district).distinct('client'):['агент', 'менеджер', 'суперагент'].includes(user.role)?DistrictAzyk.find({$or: [{manager: user.employment}, {agent: user.employment}]}).distinct('client'):null,
                user.role==='суперагент'?OrganizationAzyk.find({superagent: true}).distinct('_id'):null,
                filter==='Не синхронизированные'?OrganizationAzyk.find({pass: {$nin: ['', null]}}).distinct('_id'):null,
                forwarder?DistrictAzyk.find({forwarder}).distinct('client'):null,
            ]);
            const res = await InvoiceAzyk.find({
                //не удален
                del: {$ne: 'deleted'},
                //агент
                ...agent ? {agent: new mongoose.Types.ObjectId(agent)} : {},
                //город
                ...city ? {city} : {},
                //экспедитор
                ...forwarder? {$or: [{forwarder}, {forwarder: null, client: {$in: forwarderClients}}]} : {},
                //рейс
                ...track ? {track} : {},
                //dateDelivery
                ...dateDelivery ? {dateDelivery} : {},
                //только в своей организации
                ...user.organization?{organization: user.organization}:organization?{organization: new mongoose.Types.ObjectId(organization)}:{},
                //клиент только свои
                ...user.client ? {client: user.client} : {},
                //только в районах
                ...districtClients? {client: {$in: districtClients}} : {},
                //суперагент только в доступных организациях
                ...['суперагент', 'суперэкспедитор'].includes(user.role) ? {organization: {$in: superagentOrganizations}} : {},
                //в период
                ...(dateStart ? {createdAt: {$gte: dateStart, $lt: dateEnd}} : {}),
                //фильтр
                ...(filter === 'акция' ? {adss: {$ne: []}} : {}),
                ...(filter === 'Без геолокации' ? {address: {$elemMatch: {$eq: ''}}} : {}),
                ...(filter === 'принят' ? {taken: true} : {}),
                ...(filter === 'обработка' ? {taken: false, cancelClient: null, cancelForwarder: null} : {}),
                ...(filter === 'Не синхронизированные' ? {organization: {$in: integrationOrganizations}, sync: {$nin: [1, 2]}, taken: true} : {}),
                //поиск
                ...search?{$or: [
                        {number: {$regex: reductionSearch(search), $options: 'i'}},
                        {info: {$regex: reductionSearchText(search), $options: 'i'}},
                        {address: {$regex: reductionSearchText(search), $options: 'i'}}
                    ]}:{},
            })
                .sort(_sort)
                .skip(isNotEmpty(skip) ? skip : 0)
                .limit(isNotEmpty(skip) ? defaultLimit : 10000000000)
                .populate({
                    path: 'client',
                    select: '_id name'
                })
                .populate({
                    path: 'agent',
                    select: '_id user name',
                    populate: [{path: 'user', select: 'role'}]
                })
                .populate({
                    path: 'forwarder',
                    select: '_id role name'
                })
                .populate({
                    path: 'organization',
                    select: '_id name'
                })
                .populate({
                    path: 'adss',
                    select: '_id title'
                })
                .lean()
            return res
        }
    },
    orderHistorys: async(parent, {invoice}, {user}) => {
        if(['admin', 'менеджер', 'суперорганизация', 'организация'].includes(user.role)) {
            return HistoryOrderAzyk.find({invoice}).sort('-createdAt').lean()
        }
    },
    invoice: async(parent, {_id}, {user}) => {
        if(['агент', 'менеджер', 'суперорганизация', 'организация', 'экспедитор', 'суперагент', 'admin', 'суперэкспедитор', 'client'].includes(user.role)) {
            return InvoiceAzyk.findOne({
                _id,
                ...user.client ? {client: user.client} : {},
                ...user.organization ?
                    {
                        $or: [
                            {organization: user.organization},
                        ],
                    } : {},
            })
                .populate({
                    path: 'orders',
                    populate: {
                        path: 'item'
                    }
                })
                .populate({
                    path: 'client',
                    populate: [
                        {path: 'user'}
                    ]
                })
                .populate({
                    path: 'agent',
                    populate: [{path: 'user', select: 'role'}]
                })
                .populate({
                    path: 'forwarder',
                })
                .populate({
                    path: 'organization',
                })
                .populate({
                    path: 'adss',
                })
                .lean()
        }
    },
};

const setInvoice = async ({needCheckAdss, adss, taken, invoice, confirmationClient, confirmationForwarder, cancelClient, cancelForwarder, user}) => {
    const OrderAzyk = require('../models/orderAzyk');
    const InvoiceAzyk = require('../models/invoiceAzyk');
    const {checkFloat, isNotEmpty} = require('../module/const');
    const {checkAdss} = require('../graphql/adsAzyk');
    //накладная
    let object = await InvoiceAzyk.findById(invoice).populate('client')
    //проверка роли
    let isAdmin = ['admin', 'суперагент', 'суперэкспедитор'].includes(user.role)
    let isClient = 'client'===user.role&&user.client.toString()===object.client._id.toString()
    let isEmployment = ['менеджер', 'суперорганизация', 'организация', 'агент', 'экспедитор'].includes(user.role)&&object.organization.toString()===user.organization.toString();
    let isUndefinedClient = ['менеджер', 'суперорганизация', 'организация', 'экспедитор', 'агент'].includes(user.role)&&!object.client.user
    //optionUpdateOrder
    let optionUpdateOrder
    //ручное задание акций
    if(isNotEmpty(adss)&&(isAdmin||isUndefinedClient||isEmployment)) {
        object.adss = adss
    }
    //принятие либо снятие принятия заказ
    if(isNotEmpty(taken)&&(isAdmin||isEmployment)) {
        object.taken = taken
        if(taken) {
            optionUpdateOrder = {status: 'принят'}
        }
        else {
            optionUpdateOrder =  {status: 'обработка', rejected: 0}
            object.confirmationForwarder = false
            object.confirmationClient = false
            object.rejectedPrice = 0
            object.sync = object.sync!==0?1:0
        }
        if(needCheckAdss)
            await checkAdss(invoice, !taken)
    }
    //заказ доставлен подтверждение клиентом
    if(object.taken&&isNotEmpty(confirmationClient)&&(isAdmin||isUndefinedClient||isClient)) {
        object.confirmationClient = confirmationClient
        if(!confirmationClient) {
            optionUpdateOrder = {status: 'принят'}
        }
    }
    //заказ доставлен подтверждение поставщиком
    if(object.taken&&isNotEmpty(confirmationForwarder)&&(isAdmin||isEmployment)) {
        object.confirmationForwarder = confirmationForwarder
        if(!confirmationForwarder) {
            optionUpdateOrder = {status: 'принят'}
        }
    }
    //заказ доставлен подтвержден клиентом и поставщиком
    if(object.taken&&object.confirmationForwarder&&object.confirmationClient) {
        optionUpdateOrder = {status: 'выполнен'}
    }
    //отмена/возврат клиентом
    if(isNotEmpty(cancelClient)&&(cancelClient||isNotEmpty(object.cancelClient))&&!object.cancelForwarder&&(isAdmin||isClient)) {
        //отмена клиентом
        if(cancelClient) {
            object.cancelClient = new Date()
            optionUpdateOrder = {status: 'отмена'}
        }
        //возврат поставщиком
        else if(!cancelClient) {
            //расчет времени
            let difference = (new Date()).getTime() - (object.cancelClient).getTime();
            let differenceMinutes = checkFloat(difference / 60000);
            if (differenceMinutes < 10||user.role==='admin') {
                object.cancelClient = null
                optionUpdateOrder = {status: 'обработка'}
                object.taken = null
                object.confirmationClient = null
                object.confirmationForwarder = null
            }
        }
    }
    //отмена/возврат поставщиком
    if(isNotEmpty(cancelForwarder)&&(cancelForwarder||isNotEmpty(object.cancelForwarder))&&!object.cancelClient&&(isAdmin||isEmployment)) {
        //отмена поставщиком
        if(cancelForwarder) {
            object.cancelForwarder = new Date()
            optionUpdateOrder = {status: 'отмена'}
        }
        //возврат поставщиком
        else if(!cancelForwarder) {
            let difference = (new Date()).getTime() - (object.cancelForwarder).getTime();
            let differenceMinutes = checkFloat(difference / 60000);
            if (differenceMinutes < 10||user.role==='admin') {
                object.cancelForwarder = null
                object.cancelClient = null
                optionUpdateOrder = {status: 'обработка'}
                object.taken = null
                object.confirmationClient = null
                object.confirmationForwarder = null
            }
        }
    }
    if(optionUpdateOrder) await OrderAzyk.updateMany({_id: {$in: object.orders}}, optionUpdateOrder)
    await object.save();
}

const setOrder = async ({orders, invoice, user}) => {
    const OrderAzyk = require('../models/orderAzyk');
    const InvoiceAzyk = require('../models/invoiceAzyk');
    const DistrictAzyk = require('../models/districtAzyk');
    const RELOAD_ORDER = 'RELOAD_ORDER';
    const HistoryOrderAzyk = require('../models/historyOrderAzyk');
    const {checkFloat, dayStartDefault} = require('../module/const');
    const ModelsErrorAzyk = require('../models/errorAzyk');
    const {calculateStock} = require('../module/stockAzyk');
    const {calculateConsig} = require('../module/consigFlow');
    const {setSingleOutXMLAzyk} = require('../module/singleOutXMLAzyk');
    const {cancelSingleOutXMLAzyk} = require('../module/singleOutXMLAzyk');
    const {unawaited} = require('../module/const');
    const {pubsub} = require('./index');
    const {parallelBulkWrite} = require('../module/parallel');
    //накладная
    invoice = await InvoiceAzyk.findById(invoice)
        .populate({path: 'orders', populate: {path: 'item'}})
        .populate({path: 'client'})
        .populate({path: 'agent'})
        .populate({path: 'adss'})
        .populate({path: 'forwarder'})
        .populate({path: 'organization'})
        .lean()
    //удаляемые orders
    let ordersForDelete = []
    //проверка доступа
    if(orders&&orders.length) {
        //общие данные
        let allPrice = 0
        let allTonnage = 0
        let rejectedPrice = 0
        const bulkOperations = [];
        //удаляемые orders
        const ordersIds = orders.map(order => order._id.toString())
        ordersForDelete = invoice.orders.filter(invoiceOrder => !ordersIds.includes(invoiceOrder._id.toString()))
        ordersForDelete = ordersForDelete.map(orderForDelete => orderForDelete._id)
        await OrderAzyk.updateMany({_id: {$in: ordersForDelete}}, {count: 0, rejected: 0, allPrice: 0, allTonnage: 0, status: 'отмена', ads: null})
        //order по id
        const orderById = {}
        for(const invoiceOrder of invoice.orders) {
            const orderId = invoiceOrder._id.toString()
            orderById[orderId] = invoiceOrder
        }
        //обнуление для обновления
        invoice.orders = []
        //перебор
        for(let i = 0; i < orders.length; i++) {
            //обновление
            const updatedOrder = {
                count: orders[i].count,
                allPrice: orders[i].allPrice,
                rejected: orders[i].rejected,
                allTonnage: checkFloat(orders[i].allTonnage)
            }
            //подсчет накладной
            rejectedPrice += orders[i].rejected * (orders[i].allPrice / orders[i].count)
            allPrice += orders[i].allPrice
            allTonnage += orders[i].allTonnage
            //обновление в монго
            bulkOperations.push({updateOne: {filter: {_id: orders[i]._id}, update: {$set: updatedOrder}}});
            //обновление для интеграции
            const orderId = orders[i]._id.toString()
            invoice.orders.push({...orderById[orderId], ...updatedOrder})
        }
        //массовое обновление
        unawaited(() => parallelBulkWrite(OrderAzyk, bulkOperations));
        //обновление накладной
        invoice.allPrice = checkFloat(allPrice)
        invoice.allTonnage = checkFloat(allTonnage)
        invoice.rejectedPrice = checkFloat(rejectedPrice)
    }
    //редактор
    invoice.editor = `${user.role}${user.name?` ${user.name}`:''}`
    //дата доставки не менее сегодня
    let today = new Date()
    if(today.getHours() < dayStartDefault)
        today.setDate(today.getDate() - 1)
    today.setHours(dayStartDefault, 0, 0, 0)
    //проходит
    if(invoice.dateDelivery>=today) {
        //организация с интеграцией
        if(invoice.organization.pass) {
            //принятие
            if (invoice.taken) {
                invoice.sync = await setSingleOutXMLAzyk(invoice)
            }
            //отмена
            else if (invoice.cancelClient||invoice.cancelForwarder) {
                invoice.sync = await cancelSingleOutXMLAzyk(invoice)
            }
        }
        ///заглушка
        else {
            unawaited(() => ModelsErrorAzyk.create({
                err: `${invoice.number} Отсутствует organization.pass ${invoice.organization.pass}`,
                path: 'setOrder'
            }))
        }
    }
    ///заглушка
    else {
        unawaited(() => ModelsErrorAzyk.create({
            err: `${invoice.number} Дата доставки просрочена`,
            path: 'setOrder'
        }))
    }
    //сохранить накладную
    await InvoiceAzyk.updateOne({_id: invoice._id}, {
        allPrice: invoice.allPrice, allTonnage: invoice.allTonnage, rejectedPrice: invoice.rejectedPrice,
        editor: invoice.editor, sync: invoice.sync, orders: invoice.orders.map(order => order._id)
    });
    //подсчет остатков
    if(invoice.organization.calculateStock)
        unawaited(() => calculateStock([...ordersForDelete, ...invoice.orders.map(order => order._id)], invoice.organization._id, invoice.client._id))
    //подсчет консигнации
    if (invoice.organization.calculateConsig)
        unawaited(() => calculateConsig(invoice))
    //удаление выбывших позиций
    if(ordersForDelete.length)
        unawaited(() => OrderAzyk.deleteMany({_id: {$in: ordersForDelete}}))
    //история изменения
    unawaited(() => HistoryOrderAzyk.create({
        invoice: invoice._id, editor: invoice.editor,
        status: invoice.orders[0].status,
        ...orders&&orders.length?{
            orders: orders.map(order => {
                return {item: order.name, count: order.count, rejected: order.rejected}
            })
        }:{}
    }))
    //ws
    unawaited(async () => {
        // eslint-disable-next-line no-undef
        let [superDistrict, district] = await Promise.all([
            DistrictAzyk.findOne({organization: null, client: invoice.client._id}).select('agent').lean(),
            DistrictAzyk.findOne({client: invoice.client._id, organization: invoice.organization._id, ...invoice.agent?{agent: invoice.agent._id}:{}}).select('organization manager agent').lean()
        ]);
        pubsub.publish(RELOAD_ORDER, {reloadOrder: {
                who: user.role==='admin'?null:user._id,
                client: invoice.client._id,
                agent: district?district.agent:null,
                superagent: superDistrict?superDistrict.agent:null,
                organization: invoice.organization._id,
                invoice: invoice,
                manager: district?district.manager:null,
                type: 'SET'
            }})
    })
    return invoice
}

const acceptOrders = async (dateEnd) => {
    const InvoiceAzyk = require('../models/invoiceAzyk');
    const OrganizationAzyk = require('../models/organizationAzyk');
    const DistrictAzyk = require('../models/districtAzyk');
    const RELOAD_ORDER = 'RELOAD_ORDER';
    const {dayStartDefault} = require('../module/const');
    const {checkAdss} = require('../graphql/adsAzyk');
    const ModelsErrorAzyk = require('../models/errorAzyk');
    const {parallelPromise, parallelBulkWrite} = require('../module/parallel');
    const {setSingleOutXMLAzyk} = require('../module/singleOutXMLAzyk');
    const {unawaited} = require('../module/const');
    const {pubsub} = require('./index');
    //организации с автоприемом
    let organizations = await OrganizationAzyk.find({autoAcceptNight: true}).distinct('_id')
    //накладные
    let invoices = await InvoiceAzyk.find({
        del: {$ne: 'deleted'},
        taken: {$ne: true},
        cancelClient: null,
        cancelForwarder: null,
        organization: {$in: organizations},
        ...dateEnd?{createdAt: {$lt: dateEnd}}:{}
    })
        .populate({path: 'client'})
        .populate({path: 'organization'})
        .populate({path: 'orders', populate: {path: 'item'}})
        .populate({path: 'agent'})
        .populate({path: 'forwarder'})
        .sort('createdAt')
        .lean()
    //если есть
    if(invoices.length) {
        //ordersForAccept
        const ordersForAccept = []
        // подготовим массив операций
        const bulkOperations = [];
        //invoicesForCheckAdss
        let invoicesForCheckAdss = {}
        //перебор
        // eslint-disable-next-line no-undef
        await parallelPromise(invoices, async (invoice) => {
            try {
                //заказы для подбора акций
            invoicesForCheckAdss[invoice.client._id] = invoice._id
            //дата доставки не менее сегодня
            let today = new Date()
            if(today.getHours() < dayStartDefault)
                today.setDate(today.getDate() - 1)
            today.setHours(dayStartDefault, 0, 0, 0)
            //проходит
            if(invoice.dateDelivery>=today) {
                //организация с интеграцией
                if (invoice.organization.pass)
                    invoice.sync = await setSingleOutXMLAzyk(invoice)
                ///заглушка
                else
                    unawaited(() => ModelsErrorAzyk.create({
                        err: `${invoice.number} Отсутствует organization.pass ${invoice.organization.pass}`,
                        path: 'acceptOrders'
                    }))
            }
            ///заглушка
            else
                unawaited(() => ModelsErrorAzyk.create({
                    err: `${invoice.number} Дата доставки просрочена`,
                    path: 'acceptOrders'
                }))
                //принятие order
            for(const order of invoice.orders) {
                order.status = 'принят'
                ordersForAccept.push(order._id)
            }
            //прием
            invoice.taken = true
            //редактор
            invoice.editor = 'acceptOrders'
            //массив обновлений
            bulkOperations.push({updateOne: {
                filter: {_id: invoice._id}, update: {$set: {editor: invoice.editor, sync: invoice.sync, taken: invoice.taken}}
            }});
            //ws
            unawaited(async () => {
                // eslint-disable-next-line no-undef
                const [superDistrict, district] = await Promise.all([
                    DistrictAzyk.findOne({organization: null, client: invoice.client._id}).select('agent').lean(),
                    DistrictAzyk.findOne({client: invoice.client._id, organization: invoice.organization._id, ...invoice.agent?{agent: invoice.agent._id}:{}}).select('organization manager agent').lean()
                ]);
                pubsub.publish(RELOAD_ORDER, {reloadOrder: {
                    who: null,
                    client: invoice.client._id,
                    agent: district?district.agent:null,
                    superagent: superDistrict?superDistrict.agent:null,
                    organization: invoice.organization._id,
                    invoice: invoice,
                    manager: district?district.manager:null,
                    type: 'SET'
                }})
            })
            }
            catch (err) {
                console.error(err)
            }
        })
        //обновление
        await parallelBulkWrite(InvoiceAzyk, bulkOperations);
        await OrderAzyk.updateMany({_id: {$in: ordersForAccept}}, {status: 'принят'})
        //подбор акций
        await parallelPromise(Object.values(invoicesForCheckAdss), async invoice => await checkAdss(invoice, false))
    }
}

const resolversMutation = {
    acceptOrders: async(parent, ctx, {user}) => {
        if(user.role==='admin') {
            const dateEnd = new Date()
            dateEnd.setMinutes(dateEnd.getMinutes() - 10)
            await acceptOrders(dateEnd)
            return 'OK';
        }
    },
    addOrders: async(parent, {stamp, dateDelivery, info, paymentMethod, organization, client, inv, unite, baskets}, {user}) => {
        /*костыль*/
        if(dateDelivery.getHours()!==dayStartDefault) {
            unawaited(async () => {
                await ModelsErrorAzyk.create({
                    err: `доставка не верна dateDelivery ${pdDDMMHHMM(dateDelivery)} dateDelivery.getHours ${dateDelivery.getHours} dayStartDefault ${dayStartDefault} client ${client}`,
                    path: 'addOrders'
                })
                await sendPushToAdmin({message: 'доставка не верна'})
            })
            dateDelivery.setHours(dayStartDefault, 0, 0, 0)
        }
        //штамп
        if(stamp&&(await InvoiceAzyk.findOne({stamp}).select('_id').lean()))
            return
        // Привязка клиента, если заказ делает клиент
        if(user.client) client = user.client
        // Получаем организацию от SubBrand, если есть
        // eslint-disable-next-line no-undef
        const [subBrand, clientData] = await Promise.all([
            !user.organization?SubBrandAzyk.findById(organization).select('organization').lean():null,
            ClientAzyk.findById(client).select('address city category').lean()
        ])
        if(subBrand) organization = subBrand.organization
        client = clientData
        if(user.organization) organization = user.organization
        /*костыль*/
        if(!baskets) unawaited(async () => {
            await ModelsErrorAzyk.create({err: `baskets1=null ${JSON.stringify({stamp, dateDelivery, info, paymentMethod, organization, client, inv, unite, baskets})}`, path: 'addOrders'})
            await sendPushToAdmin({message: 'baskets1=null'})
        })
        // Проверка деления по суббрендам
        // Получаем корзины пользователя (агента или клиента)
        // eslint-disable-next-line no-undef
        let [organizationData, basketItems, discountData, specialPricesClient, specialPricesCategory, superDistrict, district] = await Promise.all([
            OrganizationAzyk.findById(organization).select('divideBySubBrand autoAcceptAgent calculateStock calculateConsig').lean(),
            ItemAzyk.find({_id: {$in: baskets.map(basket => basket._id)}}).select('price _id weight subBrand').lean(),
            DiscountClient.findOne({client: client._id, organization}).lean(),
            SpecialPriceClientAzyk.find({organization, client: client._id}).select('item price').lean(),
            SpecialPriceCategory.find({organization, category: client.category}).select('item price').lean(),
            DistrictAzyk.findOne({organization: null, client: client._id}).select('agent').lean(),
            DistrictAzyk.findOne({organization, client: client._id, ...user.role==='агент'?{agent: user.employment}:{}}).select('name agent manager forwarder organization').lean()
        ])
        //костыль
        if(!district)
            district = await DistrictAzyk.findOne({organization, client: client._id}).select('name agent manager forwarder organization').lean()
        //basketItems
        const basketItemById = {}
        for(const basketItem of basketItems) {
            const basketItemId = basketItem._id.toString()
            basketItemById[basketItemId] = basketItem
        }
        baskets = baskets.map(basket => {
            const basketItemId = basket._id.toString()
            basket.item = basketItemById[basketItemId]
            return basket
        })
        //проверка специальной цены клиента
        const specialPriceClientByItem = {}
        for(const specialPriceClient of specialPricesClient) {
            const itemId = specialPriceClient.item.toString()
            specialPriceClientByItem[itemId] = specialPriceClient.price
        }
        //проверка специальной цены категории
        const specialPriceCategoryByItem = {}
        for(const specialPriceCategory of specialPricesCategory) {
            const itemId = specialPriceCategory.item.toString()
            specialPriceCategoryByItem[itemId] = specialPriceCategory.price
        }
        //скидка клиента
        const discount = discountData?discountData.discount:0
        //автоприем
        const autoAcceptAgent = organizationData.autoAcceptAgent||user.role==='экспедитор';
        const divideBySubBrand = organizationData.divideBySubBrand;
        // Группируем корзины по суббрендам, если включено деление
        let basketsBySubBrand
        if (divideBySubBrand) {
            // Группируем baskets по subBrand
            // eslint-disable-next-line no-undef
            basketsBySubBrand = {};
            for(const basket of baskets) {
                const subBrandId = (basket.item.subBrand || 'all').toString();
                if (!basketsBySubBrand[subBrandId])
                    basketsBySubBrand[subBrandId] = [];
                basketsBySubBrand[subBrandId].push(basket);
            }
            basketsBySubBrand = Object.values(basketsBySubBrand);
        } else
            basketsBySubBrand = [baskets];
        //генерация номеров
        const numbers = []
        for(let i=0; i<basketsBySubBrand.length; i++)
            numbers[i] = await generateUniqueNumber(InvoiceAzyk, numbers)
        //надо ли checkAds
        let invoiceCheckAdss
        // Обрабатываем каждую группу корзин
        // eslint-disable-next-line no-undef
        await Promise.all(basketsBySubBrand.map(async (baskets, idx) => {
            //формируем корзины побренда
            if(baskets.length) {
                //guid
                let guid = await uuidv1()
                //сегодня
                let dateStart = new Date()
                if(dateStart.getHours()<dayStartDefault)
                    dateStart.setDate(dateStart.getDate() - 1)
                dateStart.setHours(dayStartDefault, 0, 0, 0)
                let dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
                //накладная
                let objectInvoice;
                //если объединяем заказы и не счет-фактура
                if(unite&&!inv) {
                    //накладные за сегодня и подбренд
                    // eslint-disable-next-line no-undef
                    const objectInvoices = await InvoiceAzyk.find({
                        organization,
                        client: client._id,
                        dateDelivery: dateDelivery,
                        createdAt: { $gte: dateStart, $lt: dateEnd },
                        del: {$ne: 'deleted'},
                        cancelClient: null,
                        cancelForwarder: null,
                        inv: {$ne: 1}
                    })
                        .populate({
                            path: 'orders',
                            select: '_id item',
                            populate: {
                                path: 'item',
                                select: 'subBrand'
                            }
                        })
                        .sort('-createdAt')
                        .lean()
                    //перебираем накладные
                    for(let i = 0; i < objectInvoices.length; i++) {
                        if(baskets[0].item.subBrand)
                            baskets[0].item.subBrand = baskets[0].item.subBrand.toString()
                        if(objectInvoices[i].orders[0].item.subBrand)
                            objectInvoices[i].orders[0].item.subBrand = objectInvoices[i].orders[0].item.subBrand.toString()
                        if (baskets[0].item.subBrand === objectInvoices[i].orders[0].item.subBrand) {
                            objectInvoice = objectInvoices[i];
                            objectInvoice.orders = objectInvoice.orders.map(order => order._id)
                            break;
                        }
                    }
                }
                //нету накладной
                if(!objectInvoice) {
                    // создаём заказы
                    // eslint-disable-next-line no-undef
                    let orders = await Promise.all(baskets.map(async basket => {
                        //проверка специальной цены клиента
                        const itemId = basket.item._id.toString()
                        let price = isNotEmpty(specialPriceClientByItem[itemId])?specialPriceClientByItem[itemId]:isNotEmpty(specialPriceCategoryByItem[itemId])?specialPriceCategoryByItem[itemId]:basket.item.price
                        //итоговая цена
                        price = !discount? price : checkFloat(price-price/100*discount)
                        //возвращаем заказа
                        return await OrderAzyk.create({
                            item: basket.item._id,
                            client: client._id,
                            count: basket.count,
                            allTonnage: checkFloat(basket.count*(basket.item.weight?basket.item.weight:0)),
                            allPrice: checkFloat(price*basket.count),
                            status: 'обработка',
                            agent: user.employment,
                        });
                    }));
                    //общая сумма накладной
                    let allPrice = 0
                    let allTonnage = 0
                    orders = orders.map(order => {
                        allPrice += order.allPrice
                        allTonnage += order.allTonnage
                        return order._id
                    })
                    //создаем накладную
                    objectInvoice = await InvoiceAzyk.create({
                        stamp,
                        guid,
                        city: client.city,
                        discount,
                        orders,
                        client: client._id,
                        allPrice: checkFloat(allPrice),
                        allTonnage: checkFloat(allTonnage),
                        info,
                        address: client.address[0],
                        paymentMethod: paymentMethod,
                        number: numbers[idx],
                        agent: user.employment,
                        organization,
                        adss: [],
                        track: 1,
                        dateDelivery,
                        district:  district?district.name:null,
                        who: user._id,
                        forwarder: district?district.forwarder:null,
                        ...inv?{inv: 1}:{}
                    });
                }
                // Счет найден — обновляем существующие заказы
                else {
                    //заказы счета по товарам
                    let objectOrders = await OrderAzyk.find({
                        _id: {$in: objectInvoice.orders}
                    }).select('_id item allPrice count allTonnage').lean()
                    const orderByItem = {}
                    for(const objectOrder of objectOrders) {
                        const itemId = objectOrder.item.toString()
                        orderByItem[itemId] = objectOrder
                    }
                    //перебор корзин
                    // eslint-disable-next-line no-undef
                    baskets = await Promise.all(baskets.map(async basket => {
                        //есть ли заказ на товар
                        const itemId = basket.item._id.toString()
                        let objectOrder = orderByItem[itemId]
                        //если есть
                        if(objectOrder) {
                            //подсчет и сохранение
                            basket.price = checkFloat(objectOrder.allPrice/objectOrder.count)
                            objectOrder.count += basket.count
                            objectOrder.allTonnage += basket.count*(basket.item.weight?basket.item.weight:0)
                            objectOrder.allPrice += basket.price*basket.count
                            await OrderAzyk.updateOne(
                                {_id: objectOrder._id}, {count: objectOrder.count, allTonnage: checkFloat(objectOrder.allTonnage), allPrice: checkFloat(objectOrder.allPrice)}
                            )
                        }
                        //если нету
                        else {
                            //проверка специальной цены клиента
                            basket.price = isNotEmpty(specialPriceClientByItem[itemId])?
                                specialPriceClientByItem[itemId]:isNotEmpty(specialPriceCategoryByItem[itemId])?
                                    specialPriceCategoryByItem[itemId]:basket.item.price
                            //итоговая цена
                            basket.price = !discount? basket.price : checkFloat(basket.price-basket.price/100*discount)
                            //создание заказа
                            objectOrder = await OrderAzyk.create({
                                item: basket.item._id,
                                client: client._id,
                                count: basket.count,
                                allTonnage: checkFloat(basket.count*(basket.item.weight?basket.item.weight:0)),
                                allPrice: checkFloat(basket.price*basket.count),
                                status: 'обработка',
                                agent: user.employment,
                            })
                            //_id для добавления нового заказа
                            basket.objectOrder = objectOrder._id
                        }
                        return basket
                    }))
                    //перебор корзин для подсчета сумм накладной
                    let allPrice = objectInvoice.allPrice;
                    let allTonnage = objectInvoice.allTonnage;
                    let orders = objectInvoice.orders;
                    for(const basket of baskets) {
                        allPrice += basket.price*basket.count
                        allTonnage += basket.count*(basket.item.weight?basket.item.weight:0)
                        //если новый заказ добавить к накладной
                        if(basket.objectOrder) objectInvoice.orders.push(basket.objectOrder);
                    }
                    //кто менял
                    const editor = `${user.role}${user.name?` ${user.name}`:''}`
                    // eslint-disable-next-line no-undef
                    await Promise.all([
                        //перевод всех заказов в обработку
                        OrderAzyk.updateMany({_id: {$in: objectInvoice.orders}}, {status: 'обработка', rejected: 0}),
                        //обновление накладной
                        InvoiceAzyk.updateOne({_id: objectInvoice._id}, {
                            rejectedPrice: 0, confirmationForwarder: false, confirmationClient: false, taken: false, sync: 0, editor,
                            allPrice: checkFloat(allPrice), allTonnage: checkFloat(allTonnage), orders
                        }),
                        //история
                        HistoryOrderAzyk.create({invoice: objectInvoice._id, editor,})
                    ])
                }
                // Автопринятие заказов агентом, если разрешено
                if(user.employment&&autoAcceptAgent) {
                    await setInvoice({taken: true, invoice: objectInvoice._id, user})
                    await setOrder({orders: [], invoice: objectInvoice._id, user})
                    invoiceCheckAdss = objectInvoice._id
                }
                //публикация и подсчет остатков
                unawaited(async() => {
                    // Удаляем использованные корзины
                    ///await BasketAzyk.deleteMany({_id: {$in: baskets.map(basket=>basket._id)}})
                    // Получаем финальный счёт для публикации
                    let newInvoice = await InvoiceAzyk.findById(objectInvoice._id)
                        .select(' _id agent createdAt updatedAt allTonnage client allPrice rejectedPrice info address paymentMethod discount adss editor number confirmationForwarder confirmationClient cancelClient district track forwarder organization cancelForwarder taken sync city dateDelivery')
                        .populate({path: 'client', select: '_id name email phone user', populate: [{path: 'user', select: '_id'}]})
                        .populate({path: 'agent', select: '_id name'})
                        .populate({path: 'organization', select: '_id name'})
                        .populate({path: 'forwarder', select: '_id name'})
                        .lean()
                    if (!(user.employment&&autoAcceptAgent)) {
                        //подсчет остатков
                        if (organizationData.calculateStock)
                            await calculateStock(objectInvoice.orders, newInvoice.organization._id, newInvoice.client._id)
                        //подсчет консигнации
                        if (organizationData.calculateConsig)
                            await calculateConsig(newInvoice)
                    }
                    //публикация
                    await pubsub.publish(RELOAD_ORDER, {reloadOrder: {
                            who: user.role==='admin'?null:user._id,
                            agent: district?district.agent:null,
                            superagent: superDistrict?superDistrict.agent:null,
                            client: client._id,
                            organization,
                            invoice: newInvoice,
                            manager: district?district.manager:null,
                            type: 'ADD'
                        }})
                });
            }
        }))
        if(invoiceCheckAdss)
            await checkAdss(invoiceCheckAdss, false)
        return 'OK';
    },
    deleteOrders: async(parent, {ids}, {user}) => {
        if(user.role==='admin') {
            let objects = await InvoiceAzyk.find({_id: {$in: ids}})
            // eslint-disable-next-line no-undef
            await Promise.all(objects.map(async object => {
                object.del = 'deleted'
                await object.save()
                // eslint-disable-next-line no-undef
                let [superDistrict, district] = await Promise.all([
                    DistrictAzyk.findOne({organization: null, client: object.client}).select('agent').lean(),
                    DistrictAzyk.findOne({
                        client: object.client,
                        organization: object.organization,
                        ...object.agent?{agent: object.agent}:{}}).select('agent manager organization').lean()
                ]);
                unawaited(() => pubsub.publish(RELOAD_ORDER, {reloadOrder: {
                        who: user.role==='admin'?null:user._id,
                        client: object.client,
                        agent: district?district.agent:null,
                        superagent: superDistrict?superDistrict.agent:null,
                        organization: object.organization,
                        invoice: {_id: object._id},
                        manager: district?district.manager:null,
                        type: 'DELETE'
                    }}));
            }))
            return 'OK';
        }
    },
    setInvoicesLogic: async(parent, args) => {
        await setSingleOutXMLAzykLogic(args)
        return 'OK';
    },
    setOrder: async(parent, {orders, invoice}, {user}) => {
        return await setOrder({orders, invoice, user})
    },
    setInvoice: async(parent, {adss, taken, invoice, confirmationClient, confirmationForwarder, cancelClient, cancelForwarder}, {user}) => {
        await setInvoice({adss, needCheckAdss: true, taken, invoice, confirmationClient, confirmationForwarder, cancelClient, cancelForwarder, user})
        return 'OK';
    },
    setInvoicesDateDelivery: async(parent, {dateDelivery, invoices}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            dateDelivery.setHours(dayStartDefault, 0, 0, 0)
            // eslint-disable-next-line no-undef
            await Promise.all([
                InvoiceAzyk.updateMany(
                    {_id: {$in: invoices}},
                    {sync: 1, dateDelivery}
                ),
                SingleOutXMLAzyk.updateMany(
                    {invoice: {$in: invoices}},
                    {status: 'update', date: dateDelivery}
                )
            ])
            return 'OK';
        }
    },
};

const resolversSubscription = {
    reloadOrder: {
        subscribe: withFilter(
            () => pubsub.asyncIterator(RELOAD_ORDER),
            (payload, variables, {user} ) => {
                return (
                    user&&user.role&&user._id&&user._id.toString()!==payload.reloadOrder.who&&
                    (
                        'admin'===user.role||
                        (user.client&&payload.reloadOrder.client&&payload.reloadOrder.client.toString()===user.client.toString())||
                        (user.employment&&payload.reloadOrder.superagent&&payload.reloadOrder.superagent.toString()===user.employment.toString())||
                        (user.employment&&payload.reloadOrder.agent&&payload.reloadOrder.agent.toString()===user.employment.toString())||
                        (user.employment&&payload.reloadOrder.manager&&payload.reloadOrder.manager.toString()===user.employment.toString())||
                        (user.organization&&payload.reloadOrder.organization&&['суперорганизация', 'организация'].includes(user.role)&&payload.reloadOrder.organization.toString()===user.organization.toString())
                    )
                )
            },
        )
    },

}

module.exports.RELOAD_ORDER = RELOAD_ORDER;
module.exports.resolversSubscription = resolversSubscription;
module.exports.subscription = subscription;
module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;
module.exports.acceptOrders = acceptOrders;