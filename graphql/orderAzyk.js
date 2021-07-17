const OrderAzyk = require('../models/orderAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const DistributerAzyk = require('../models/distributerAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const RouteAzyk = require('../models/routeAzyk');
const BasketAzyk = require('../models/basketAzyk');
const ClientAzyk = require('../models/clientAzyk');
const AdsAzyk = require('../models/adsAzyk');
const mongoose = require('mongoose');
const DiscountClient = require('../models/discountClientAzyk');
const { setSingleOutXMLAzyk, cancelSingleOutXMLAzyk, setSingleOutXMLAzykLogic } = require('../module/singleOutXMLAzyk');
const randomstring = require('randomstring');
const EmploymentAzyk = require('../models/employmentAzyk');
const { pubsub } = require('./index');
const { withFilter } = require('graphql-subscriptions');
const RELOAD_ORDER = 'RELOAD_ORDER';
const HistoryOrderAzyk = require('../models/historyOrderAzyk');
const { checkFloat } = require('../module/const');
const maxDates = 5
const { checkAdss } = require('../graphql/adsAzyk');

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
    allSize: Float
    consignment: Int
    returned: Int
    consignmentPrice: Float
 }
  type Invoice {
    _id: ID
     discount: Int
    createdAt: Date
    updatedAt: Date
    orders: [Order]
    client: Client
    allPrice: Float 
    consignmentPrice: Float
    returnedPrice: Float
    info: String
    address: [String]
    paymentMethod: String
    district: String
    number: String
    confirmationForwarder: Boolean
    confirmationClient: Boolean
    paymentConsignation: Boolean
    sync: Int
    cancelClient: Date
    cancelForwarder: Date
    taken: Boolean
    dateDelivery: Date
    agent: Employment
    allTonnage: Float
    allSize: Float
    editor: String
    provider: Organization
    sale: Organization
    organization: Organization
    del: String
    city: String
    adss: [Ads]
    priority: Int
    track: Int
    forwarder: Employment
  }
  type HistoryOrder {
    createdAt: Date
    invoice: ID
    orders: [HistoryOrderElement]
    editor: String
  }
  type HistoryOrderElement {
    item: String
    count: Int
    consignment: Int
    returned: Int
  }
  type ReloadOrder {
    who: ID
    client: ID
    agent: ID
    superagent: ID
    manager: ID
    organization: ID
    distributer: ID
    invoice: Invoice
    type: String
  }
  input OrderInput {
    _id: ID
    count: Int
    allPrice: Float
    allTonnage: Float
    allSize: Float
    name: String
    status: String
    consignment: Int
    returned: Int
    consignmentPrice: Float
  }
`;

const query = `
    invoices(search: String!, sort: String!, filter: String!, date: String!, skip: Int, organization: ID, city: String): [Invoice]
    invoicesFromDistrict(organization: ID!, district: ID!, date: String!): [Invoice]
   invoicesSimpleStatistic(search: String!, filter: String!, date: String, organization: ID, city: String): [String]
    invoicesTrash(search: String!, skip: Int): [Invoice]
   invoicesTrashSimpleStatistic(search: String!): [String]
    orderHistorys(invoice: ID!): [HistoryOrder]
    invoicesForRouting(produsers: [ID]!, clients: [ID]!, dateStart: Date, dateEnd: Date, dateDelivery: Date): [Invoice]
    invoice(_id: ID!): Invoice
    sortInvoice: [Sort]
    filterInvoice: [Filter]
    isOrderToday(organization: ID!, clients: ID!, dateDelivery: Date!): Boolean
`;

const mutation = `
    acceptOrders: Data
    addOrders(priority: Int!, dateDelivery: Date!, info: String, inv: Boolean, unite: Boolean, paymentMethod: String, organization: ID!, client: ID!): Data
    setOrder(orders: [OrderInput], invoice: ID): Invoice
    setInvoice(adss: [ID], taken: Boolean, invoice: ID!, confirmationClient: Boolean, confirmationForwarder: Boolean, cancelClient: Boolean, cancelForwarder: Boolean, paymentConsignation: Boolean): Data
    setInvoicesLogic(track: Int, forwarder: ID, invoices: [ID]!): Data
    deleteOrders(_id: [ID]!): Data
    restoreOrders(_id: [ID]!): Data
    approveOrders(invoices: [ID]!, route: ID): Data
`;

const subscription  = `
    reloadOrder: ReloadOrder
`;

const resolvers = {
    invoicesTrashSimpleStatistic: async(parent, {search}, {user}) => {
        let _organizations;
        let _clients;
        let _agents;
        if(search.length>0){
            _organizations = await OrganizationAzyk.find({
                name: {'$regex': search, '$options': 'i'}
            }).distinct('_id').lean()
            _clients = await ClientAzyk.find({
                $or: [
                    {name: {'$regex': search, '$options': 'i'}},
                    {address: {$elemMatch: {$elemMatch: {'$regex': search, '$options': 'i'}}}}
                ]
            }).distinct('_id').lean()
            _agents = await EmploymentAzyk.find({
                name: {'$regex': search, '$options': 'i'}
            }).distinct('_id').lean()
        }
        let invoices = [];
        if(user.role==='admin') {
            invoices =  await InvoiceAzyk.find(
                {
                    del: 'deleted',
                    ...(search.length>0?{
                            $or: [
                                {number: {'$regex': search, '$options': 'i'}},
                                {info: {'$regex': search, '$options': 'i'}},
                                {address: {'$regex': search, '$options': 'i'}},
                                {paymentMethod: {'$regex': search, '$options': 'i'}},
                                {client: {$in: _clients}},
                                {forwarder: {$in: _agents}},
                                {agent: {$in: _agents}},
                                {organization: {$in: _organizations}},
                                {provider: {$in: _organizations}},
                                {sale: {$in: _organizations}},
                            ]
                        }
                        :{})
                }
            )
                .lean()
        }
        return [invoices.length.toString()]
    },
    invoicesSimpleStatistic: async(parent, {search, filter, date, organization, city}, {user}) => {
        if(['суперорганизация', 'организация', 'client', 'admin', 'менеджер', 'агент', 'экспедитор', 'суперэкспедитор', 'суперагент'].includes(user.role)) {
            let dateStart;
            let dateEnd;
            if (date !== '') {
                let differenceDates = maxDates
                dateStart = new Date(date)
                dateStart.setHours(3, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
                if (['экспедитор', 'агент', 'суперэкспедитор', 'суперагент'].includes(user.role)) {
                    let now = new Date()
                    now.setDate(now.getDate() + 1)
                    now.setHours(3, 0, 0, 0)
                    differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
                }
                if (differenceDates > maxDates) {
                    dateStart = new Date()
                    dateEnd = new Date(dateStart)
                    dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - maxDates))
                }
            }
            else {
                dateStart = new Date()
                dateEnd = new Date(dateStart)
                if (dateStart.getHours()>=3)
                    dateEnd.setDate(dateEnd.getDate() + 1)
                else
                    dateStart.setDate(dateStart.getDate() - 1)
                dateStart.setHours(3, 0, 0, 0)
                dateEnd.setHours(3, 0, 0, 0)
            }
            let _organizations;
            let _clients;
            let _agents;
            if (search.length > 0) {
                _organizations = await OrganizationAzyk.find({
                    name: {'$regex': search, '$options': 'i'}
                }).distinct('_id').lean()
                _clients = await ClientAzyk.find({
                    $or: [
                        {name: {'$regex': search, '$options': 'i'}},
                        {address: {$elemMatch: {$elemMatch: {'$regex': search, '$options': 'i'}}}}
                    ]
                }).distinct('_id').lean()
                _agents = await EmploymentAzyk.find({
                    name: {'$regex': search, '$options': 'i'}
                }).distinct('_id').lean()
            }
            let clients
            if (['агент', 'менеджер', 'суперагент'].includes(user.role)) {
                clients = await DistrictAzyk
                    .find({$or: [{manager: user.employment}, {agent: user.employment}]})
                    .distinct('client').lean()
            }
            let organizations
            if (user.role==='суперагент'){
                organizations = await OrganizationAzyk.find({
                    superagent: true
                })
                    .distinct('_id')
                    .lean()
            }
            let invoices = [];
            invoices = await InvoiceAzyk.find(
                {
                    del: {$ne: 'deleted'},
                    ...filter==='обработка'?{taken: false, cancelClient: null, cancelForwarder: null}:{taken: true},
                    $and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}],
                    ...['суперагент', 'агент'].includes(user.role)&&clients.length||'менеджер' === user.role ? {client: {$in: clients}} : ['суперагент', 'экспедитор', 'агент', 'суперэкспедитор'].includes(user.role) ? {agent: user.employment} : {},
                    ...user.organization ? {
                        $or: [
                            {organization: user.organization},
                            {provider: user.organization},
                            {sale: user.organization},
                        ],
                    } : {},
                    ...(filter === 'консигнации' ? {consignmentPrice: {$gt: 0}} : {}),
                    ...(filter === 'акция' ? {adss: {$ne: []}} : {}),
                    ...organization ? {organization: new mongoose.Types.ObjectId(organization)} : {},
                    ...city ? {city: city} : {},
                    ...user.client ? {client: user.client} : {},
                    ...user.role === 'суперагент' ? {organization: {$in: organizations}} : {},
                    ...(search.length > 0 ? {
                            $or: [
                                {number: {'$regex': search, '$options': 'i'}},
                                {info: {'$regex': search, '$options': 'i'}},
                                {address: {'$regex': search, '$options': 'i'}},
                                {paymentMethod: {'$regex': search, '$options': 'i'}},
                                {client: {$in: _clients}},
                                {forwarder: {$in: _agents}},
                                {agent: {$in: _agents}},
                                {organization: {$in: _organizations}},
                                {provider: {$in: _organizations}},
                                {sale: {$in: _organizations}},
                            ]
                        }
                        : {})
                }
            )
                .select('returnedPrice allPrice orders allSize allTonnage consignmentPrice paymentConsignation')
                .lean()
            let tonnage = 0;
            let size = 0;
            let price = 0;
            let consignment = 0;
            let consignmentPayment = 0;
            let lengthList = 0;
            for (let i = 0; i < invoices.length; i++) {
                if (invoices[i].allPrice) {
                    price += invoices[i].allPrice - invoices[i].returnedPrice
                }
                if (invoices[i].allSize)
                    size += invoices[i].allSize
                lengthList += 1
                if (invoices[i].allTonnage)
                    tonnage += invoices[i].allTonnage
                if (invoices[i].consignmentPrice)
                    consignment += invoices[i].consignmentPrice
                if (invoices[i].paymentConsignation)
                    consignmentPayment += invoices[i].consignmentPrice
            }
            return [lengthList.toString(), checkFloat(price).toString(), checkFloat(consignment).toString(), checkFloat(consignmentPayment).toString(), checkFloat(tonnage).toString(), checkFloat(size).toString()]
        }
    },
    invoices: async(parent, {search, sort, filter, date, skip, organization, city}, {user}) =>  {
        if(['суперорганизация', 'организация', 'client', 'admin', 'менеджер', 'агент', 'экспедитор', 'суперагент', 'суперэкспедитор'].includes(user.role)) {
            //console.time('get BD')
            let dateStart;
            let dateEnd;
            let clients
            if (date !== '') {
                let differenceDates = maxDates
                dateStart = new Date(date)
                dateStart.setHours(3, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
                if (['суперагент', 'агент', 'суперэкспедитор', 'экспедитор'].includes(user.role)) {
                    let now = new Date()
                    now.setHours(3, 0, 0, 0)
                    now.setDate(now.getDate() + 1)
                    differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
                    if (differenceDates > maxDates) {
                        dateStart = new Date()
                        dateEnd = new Date(dateStart)
                        dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - maxDates))
                    }
                }
            }
            else if (['суперагент', 'агент', 'суперэкспедитор', 'экспедитор'].includes(user.role)) {
                dateEnd = new Date()
                dateEnd.setHours(3, 0, 0, 0)
                dateEnd.setDate(dateEnd.getDate() + 1)
                dateStart = new Date(dateEnd)
                dateStart = new Date(dateStart.setDate(dateStart.getDate() - maxDates))
            }
            if (['суперагент', 'агент', 'менеджер'].includes(user.role)) {
                clients = await DistrictAzyk
                    .find({$or: [{manager: user.employment}, {agent: user.employment}]})
                    .distinct('client')
                    .lean()
            }
            let _sort = {}
            _sort[sort[0] === '-' ? sort.substring(1) : sort] = sort[0] === '-' ? -1 : 1
            let _organizations;
            let _clients;
            let _agents;
            if (search.length > 0) {
                _organizations = await OrganizationAzyk.find({
                    name: {'$regex': search, '$options': 'i'}
                }).distinct('_id').lean()
                _clients = await ClientAzyk.find({
                    $or: [
                        {name: {'$regex': search, '$options': 'i'}},
                        {address: {$elemMatch: {$elemMatch: {'$regex': search, '$options': 'i'}}}}
                    ]
                }).distinct('_id').lean()
                _agents = await EmploymentAzyk.find({
                    name: {'$regex': search, '$options': 'i'}
                }).distinct('_id').lean()
            }
            let organizations
            if (['суперагент', 'суперэкспедитор'].includes(user.role)) {
                organizations = await OrganizationAzyk.find({
                    superagent: true
                })
                    .distinct('_id')
                    .lean()
            }
            let invoices = await InvoiceAzyk.aggregate(
                [
                    {
                        $match: {
                            del: {$ne: 'deleted'},
                            ...city ? {city: city} : {},
                            ...organization ? {organization: new mongoose.Types.ObjectId(organization)} : {},
                            ...user.client ? {client: user.client} : {},
                            ...['суперагент', 'агент'].includes(user.role) && clients.length || 'менеджер' === user.role ? {client: {$in: clients}} : ['суперагент', 'экспедитор', 'суперэкспедитор', 'агент'].includes(user.role) ? {agent: user.employment} : {},
                            ...['суперагент', 'суперэкспедитор'].includes(user.role) ? {organization: {$in: organizations}} : {},
                            ...(dateStart ? {$and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}]} : {}),
                            ...(filter === 'консигнации' ? {consignmentPrice: {$gt: 0}} : {}),
                            ...(filter === 'акция' ? {adss: {$ne: []}} : {}),
                            ...(filter === 'обработка' ? {
                                taken: false,
                                cancelClient: null,
                                cancelForwarder: null
                            } : {}),
                            ...user.organization ?
                                {
                                    $or: [
                                        {organization: user.organization},
                                        {sale: user.organization},
                                        {provider: user.organization},
                                    ],
                                } : {},
                            ...(search.length > 0 ? {
                                    $or: [
                                        {number: {'$regex': search, '$options': 'i'}},
                                        {info: {'$regex': search, '$options': 'i'}},
                                        {address: {'$regex': search, '$options': 'i'}},
                                        {paymentMethod: {'$regex': search, '$options': 'i'}},
                                        {client: {$in: _clients}},
                                        {forwarder: {$in: _agents}},
                                        {agent: {$in: _agents}},
                                        {forwarder: {$in: _agents}},
                                        {organization: {$in: _organizations}},
                                        {provider: {$in: _organizations}},
                                        {sale: {$in: _organizations}},
                                    ]
                                }
                                : {})
                        }
                    },
                    {$sort: _sort},
                    {$skip: skip != undefined ? skip : 0},
                    {$limit: skip != undefined ? 15 : 10000000000},
                    {
                        $lookup:
                            {
                                from: ClientAzyk.collection.collectionName,
                                let: {client: '$client'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$client', '$_id']}}},
                                ],
                                as: 'client'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: false,
                            path: '$client'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: EmploymentAzyk.collection.collectionName,
                                let: {agent: '$agent'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$agent', '$_id']}}},
                                ],
                                as: 'agent'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$agent'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: EmploymentAzyk.collection.collectionName,
                                let: {forwarder: '$forwarder'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$forwarder', '$_id']}}},
                                ],
                                as: 'forwarder'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$forwarder'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {provider: '$provider'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$provider', '$_id']}}},
                                ],
                                as: 'provider'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$provider'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {sale: '$sale'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$sale', '$_id']}}},
                                ],
                                as: 'sale'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$sale'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {organization: '$organization'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$organization', '$_id']}}},
                                ],
                                as: 'organization'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$organization'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: AdsAzyk.collection.collectionName,
                                let: {adss: '$adss'},
                                pipeline: [
                                    {$match: {$expr: {$in: ['$_id', '$$adss']}}},
                                ],
                                as: 'adss'
                            }
                    }
                ])
            //console.timeEnd('get BD')
            return invoices
        }
    },
    invoicesTrash: async(parent, {search, skip}, {user}) => {
        let _organizations;
        let _clients;
        let _agents;
        if(search.length>0){
            _organizations = await OrganizationAzyk.find({
                name: {'$regex': search, '$options': 'i'}
            }).distinct('_id').lean()
            _clients = await ClientAzyk.find({
                $or: [
                    {name: {'$regex': search, '$options': 'i'}},
                    {address: {$elemMatch: {$elemMatch: {'$regex': search, '$options': 'i'}}}}
                    ]
            }).distinct('_id').lean()
            _agents = await EmploymentAzyk.find({
                name: {'$regex': search, '$options': 'i'}
            }).distinct('_id').lean()
        }
        if(user.role==='admin') {
            return await InvoiceAzyk.aggregate(
                [
                    {
                        $match: {
                            del: 'deleted',
                        }
                    },
                    {
                        $match: {
                            ...(search.length > 0 ? {
                                    $or: [
                                        {number: {'$regex': search, '$options': 'i'}},
                                        {info: {'$regex': search, '$options': 'i'}},
                                        {address: {'$regex': search, '$options': 'i'}},
                                        {paymentMethod: {'$regex': search, '$options': 'i'}},
                                        {client: {$in: _clients}},
                                        {forwarder: {$in: _agents}},
                                        {agent: {$in: _agents}},
                                        {organization: {$in: _organizations}},
                                        {provider: {$in: _organizations}},
                                        {sale: {$in: _organizations}},
                                    ]
                                }
                                : {})
                        }
                    },
                    {$sort: {'createdAt': -1}},
                    {$skip: skip != undefined ? skip : 0},
                    {$limit: skip != undefined ? 15 : 10000000000},
                    {
                        $lookup:
                            {
                                from: ClientAzyk.collection.collectionName,
                                let: {client: '$client'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$client', '$_id']}}},
                                ],
                                as: 'client'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: false,
                            path: '$client'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: EmploymentAzyk.collection.collectionName,
                                let: {agent: '$agent'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$agent', '$_id']}}},
                                ],
                                as: 'agent'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$agent'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: EmploymentAzyk.collection.collectionName,
                                let: {forwarder: '$forwarder'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$forwarder', '$_id']}}},
                                ],
                                as: 'forwarder'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$forwarder'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {provider: '$provider'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$provider', '$_id']}}},
                                ],
                                as: 'provider'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$provider'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {sale: '$sale'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$sale', '$_id']}}},
                                ],
                                as: 'sale'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$sale'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: AdsAzyk.collection.collectionName,
                                let: {adss: '$adss'},
                                pipeline: [
                                    {$match: {$expr: {$in: ['$_id', '$$adss']}}},
                                ],
                                as: 'adss'
                            }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {organization: '$organization'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$organization', '$_id']}}},
                                ],
                                as: 'organization'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$organization'
                        }
                    },
                ])
        }
    },
    orderHistorys: async(parent, {invoice}, {user}) => {
        if(['admin', 'менеджер', 'суперорганизация', 'организация'].includes(user.role)){
            let historyOrders =  await HistoryOrderAzyk.find({invoice: invoice}).sort('-createdAt').lean()
            return historyOrders
        }
    },
    isOrderToday: async(parent, {organization}, {user}) => {
        if('client'===user.role){
            let dateStart = new Date()
            if(dateStart.getHours()<3)
                dateStart.setDate(dateStart.getDate() - 1)
            dateStart.setHours(3, 0, 0, 0)
            let dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            let objectInvoice = await InvoiceAzyk.findOne({
                organization: organization,
                client: user.client,
                $and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt:dateEnd}}],
                del: {$ne: 'deleted'},
                cancelClient: null,
                cancelForwarder: null
            }).sort('-createdAt').select('_id').lean()
            return !!objectInvoice
        }
    },
    invoicesForRouting: async(parent, { produsers, clients, dateStart, dateEnd, dateDelivery }, {user}) => {
        if(['admin', 'агент', 'суперорганизация', 'организация', 'менеджер'].includes(user.role)) {
            if(dateDelivery) {
                dateStart = new Date(dateDelivery)
                dateStart.setHours(3, 0, 0, 0)
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
            }
            else {
                dateStart = new Date(dateStart)
                dateStart.setHours(3, 0, 0, 0)
                if(dateEnd&&dateEnd.toString()!=='Invalid Date'){
                    dateEnd = new Date(dateEnd)
                    dateEnd.setDate(dateEnd.getDate() + 1)
                    dateEnd.setHours(3, 0, 0, 0)
                }
                else {
                    dateEnd = new Date(dateStart)
                    dateEnd.setDate(dateEnd.getDate() + 1)
                }
            }
            let invoices =  await InvoiceAzyk.find({
                del: {$ne: 'deleted'},
                taken: true,
                distributed: {$ne: true},
                organization: {$in: produsers},
                    ...clients.length>0?{client: {$in: clients}}:{},
                ...dateDelivery?{$and: [{dateDelivery: {$gte: dateStart}}, {dateDelivery: {$lt: dateEnd}}]}:{$and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}]}
            })
                .select('_id agent createdAt updatedAt allTonnage allSize client allPrice consignmentPrice returnedPrice address adss editor number confirmationForwarder confirmationClient cancelClient district track forwarder  sale provider organization cancelForwarder paymentConsignation taken sync dateDelivery')
                .populate({path: 'client', select: '_id name'})
                .populate({path: 'agent', select: '_id name'})
                .populate({path: 'forwarder', select: '_id name'})
                .populate({path: 'provider', select: '_id name'})
                .populate({path: 'sale', select: '_id name'})
                .populate({path: 'adss', select: '_id title'})
                .populate({path: 'organization', select: '_id name'})
                .sort('createdAt')
                .lean()
            return invoices
        }
        else  return []
    },
    invoice: async(parent, {_id}, {user}) => {
        if(['агент', 'менеджер', 'суперорганизация', 'организация', 'экспедитор', 'суперагент', 'admin', 'суперэкспедитор', 'client'].includes(user.role)) {
            return await InvoiceAzyk.findOne({
                _id: _id,
                ...user.client ? {client: user.client} : {},
                ...user.organization ?
                    {
                        $or: [
                            {organization: user.organization},
                            {sale: user.organization},
                            {provider: user.organization},
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
                })
                .populate({
                    path: 'forwarder',
                })
                .populate({
                    path: 'provider',
                })
                .populate({
                    path: 'sale',
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
    sortInvoice: async() => {
        let sort = [
            {
                name: 'Дата заказа',
                field: 'createdAt'
            },
            {
                name: 'Дата доставки',
                field: 'dateDelivery'
            },
            {
                name: 'Статус',
                field: 'status'
            },
            {
                name: 'Сумма',
                field: 'allPrice'
            },
            {
                name: 'Кубатура',
                field: 'allSize'
            },
            {
                name: 'Тоннаж',
                field: 'allTonnage'
            },
            {
                name: 'Консигнации',
                field: 'consignmentPrice'
            }
        ]
        return sort
    },
    filterInvoice: async() => {
        let filter = [
            {
                name: 'Все',
                value: ''
            },
            {
                name: 'Обработка',
                value: 'обработка'
            },
            /*{
                name: 'Отмена',
                value: 'отмена'
            },
            {
                name: 'Принят',
                value: 'принят'
            },
            {
                name: 'Выполнен',
                value: 'выполнен'
            },*/
            {
                name: 'Консигнации',
                value: 'консигнации'
            },
            {
                name: 'Акции',
                value: 'акция'
            }
        ]
        return filter
    },
    invoicesFromDistrict: async(parent, {organization, district, date}, {user}) =>  {
        if(['admin', 'агент', 'менеджер','суперорганизация', 'организация'].includes(user.role)) {
            let dateStart;
            let dateEnd;
            dateStart = new Date(date)
            dateStart.setHours(3, 0, 0, 0)
            dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            if (['суперагент', 'агент', 'менеджер'].includes(user.role)) {
                let maxDates = 5
                let now = new Date()
                now.setDate(now.getDate() + 1)
                now.setHours(3, 0, 0, 0)
                let differenceDates = (now - dateStart) / (1000 * 60 * 60 * 24)
                if (differenceDates > maxDates) {
                    dateStart = new Date()
                    dateEnd = new Date(dateStart)
                    dateEnd = new Date(dateEnd.setDate(dateEnd.getDate() - maxDates))
                }
            }
            let _clients = await DistrictAzyk.findOne({
                _id: district
            }).distinct('client').lean();
            if (['агент', 'менеджер'].includes(user.role)) {
                _clients = await DistrictAzyk
                    .find({$or: [{manager: user.employment}, {agent: user.employment}]})
                    .distinct('client').lean()
            }
            return await InvoiceAzyk.aggregate(
                [
                    {
                        $match: {
                            $and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}],
                            taken: true,
                            del: {$ne: 'deleted'},
                            client: {$in: _clients},
                            $or: [
                                {organization: user.organization ? user.organization : new mongoose.Types.ObjectId(organization)},
                                {provider: user.organization ? user.organization : new mongoose.Types.ObjectId(organization)},
                                {sale: user.organization ? user.organization : new mongoose.Types.ObjectId(organization)},
                            ]
                        }
                    },
                    {$sort: {createdAt: -1}},
                    {
                        $lookup:
                            {
                                from: ClientAzyk.collection.collectionName,
                                let: {client: '$client'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$client', '$_id']}}},
                                ],
                                as: 'client'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: false,
                            path: '$client'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: EmploymentAzyk.collection.collectionName,
                                let: {agent: '$agent'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$agent', '$_id']}}},
                                ],
                                as: 'agent'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$agent'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: EmploymentAzyk.collection.collectionName,
                                let: {forwarder: '$forwarder'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$forwarder', '$_id']}}},
                                ],
                                as: 'forwarder'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$forwarder'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {sale: '$sale'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$sale', '$_id']}}},
                                ],
                                as: 'sale'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$sale'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {provider: '$provider'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$provider', '$_id']}}},
                                ],
                                as: 'provider'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$provider'
                        }
                    },
                    {
                        $lookup:
                            {
                                from: AdsAzyk.collection.collectionName,
                                let: {adss: '$adss'},
                                pipeline: [
                                    {$match: {$expr: {$in: ['$_id', '$$adss']}}},
                                ],
                                as: 'adss'
                            }
                    },
                    {
                        $lookup:
                            {
                                from: OrganizationAzyk.collection.collectionName,
                                let: {organization: '$organization'},
                                pipeline: [
                                    {$match: {$expr: {$eq: ['$$organization', '$_id']}}},
                                ],
                                as: 'organization'
                            }
                    },
                    {
                        $unwind: {
                            preserveNullAndEmptyArrays: true,
                            path: '$organization'
                        }
                    },
                ])
        }
    },
};

const resolversMutation = {
    acceptOrders: async(parent, ctx, {user}) => {
        if(user.role==='admin'){
            let date = new Date()
            date.setMinutes(date.getMinutes()-10)
            let orders = await InvoiceAzyk.find({
                del: {$ne: 'deleted'},
                taken: {$ne: true},
                cancelClient: null,
                cancelForwarder: null,
                createdAt: {$lte: date}
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
                orders[i].adss = await checkAdss(orders[i]._id)
                if(orders[i].organization.pass&&orders[i].organization.pass.length){
                    orders[i].sync = await setSingleOutXMLAzyk(orders[i])
                }
                orders[i].editor = 'админ'
                let objectHistoryOrder = new HistoryOrderAzyk({
                    invoice: orders[i]._id,
                    orders: orders[i].orders.map(order=>{
                        return {
                            item: order.name,
                            count: order.count,
                            consignment: order.consignment,
                            returned: order.returned
                        }
                    }),
                    editor: 'админ',
                });
                await HistoryOrderAzyk.create(objectHistoryOrder);
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
        }
        return {data: 'OK'};
    },
    addOrders: async(parent, {priority, dateDelivery, info, paymentMethod, organization, client, inv, unite}, {user}) => {
        if(user.client)
            client = user.client
        client = await ClientAzyk.findOne({_id: client}).select('address id city').lean()
        if(!(await OrganizationAzyk.findOne({_id: organization}).select('_id').lean()))
            organization = (await SubBrandAzyk.findOne({_id: organization}).select('organization').lean()).organization
        let baskets = await BasketAzyk.find(
            user.client?
                {client: user.client}:
                {agent: user.employment}
        )
            .select('item count consignment _id')
            .populate({
                path: 'item',
                select: 'price _id weight size costPrice ',
                match: {organization: organization}
            })
            .lean();
        baskets = baskets.filter(basket => (basket.item))
        if(baskets.length>0){
            let dateStart = new Date()
            if(dateStart.getHours()<3)
                dateStart.setDate(dateStart.getDate() - 1)
            dateStart.setHours(3, 0, 0, 0)
            let dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            let superDistrict = await DistrictAzyk.findOne({
                organization: null,
                client: client._id
            }).select('agent').lean()
            let distributers = await DistributerAzyk.find({
                $or: [
                    {sales: organization},
                    {provider: organization}
                ]
            }).select('distributer sales provider').lean()
            let districtSales = null;
            let districtProvider = null;
            if(distributers.length>0){
                for(let i=0; i<distributers.length; i++){
                    let findDistrict = await DistrictAzyk.findOne({
                        organization: distributers[i].distributer,
                        client: client._id
                    })
                        .select('agent manager organization')
                        .lean()
                    if(findDistrict&&distributers[i].sales.toString().includes(organization))
                        districtSales = findDistrict
                    if(findDistrict&&distributers[i].provider.toString().includes(organization))
                        districtProvider = findDistrict
                }
            }
            if(!districtSales||!districtProvider) {
                let findDistrict = await DistrictAzyk.findOne({
                    organization: organization,
                    client: client._id
                })
                    .select('agent manager organization')
                    .lean()
                if(!districtSales)
                    districtSales = findDistrict
                if(!districtProvider)
                    districtProvider = findDistrict
            }

            let objectInvoice;
            if(unite&&!inv)
                objectInvoice = await InvoiceAzyk.findOne({
                    organization: organization,
                    client: client._id,
                    dateDelivery: dateDelivery,
                    $and: [{createdAt: {$gte: dateStart}}, {createdAt: {$lt: dateEnd}}],
                    del: {$ne: 'deleted'},
                    cancelClient: null,
                    cancelForwarder: null
                })
                    .populate('client')
                    .sort('-createdAt')
            let discount = await DiscountClient.findOne({client: client._id, organization: organization}).lean()
            discount = discount?discount.discount:0
            if(!objectInvoice){
                let orders = [];
                for(let ii=0; ii<baskets.length;ii++){
                    let price = !discount?
                        baskets[ii].item.price
                        :
                        checkFloat(baskets[ii].item.price-baskets[ii].item.price/100*discount)
                    let objectOrder = new OrderAzyk({
                        item: baskets[ii].item._id,
                        client: client._id,
                        count: baskets[ii].count,
                        consignment: baskets[ii].consignment,
                        consignmentPrice: checkFloat(baskets[ii].consignment*price),
                        allTonnage: checkFloat(baskets[ii].count*(baskets[ii].item.weight?baskets[ii].item.weight:0)),
                        allSize: checkFloat(baskets[ii].count*(baskets[ii].item.size?baskets[ii].item.size:0)),
                        allPrice: checkFloat(price*baskets[ii].count),
                        costPrice: baskets[ii].item.costPrice?baskets[ii].item.costPrice:0,
                        status: 'обработка',
                        agent: user.employment,
                    });
                    objectOrder = await OrderAzyk.create(objectOrder);
                    orders.push(objectOrder);
                }
                let number = randomstring.generate({length: 12, charset: 'numeric'});
                while (await InvoiceAzyk.findOne({number: number}).select('_id').lean())
                    number = randomstring.generate({length: 12, charset: 'numeric'});
                let allPrice = 0
                let allTonnage = 0
                let allSize = 0
                let consignmentPrice = 0
                for(let iii=0; iii<orders.length;iii++) {
                    allPrice += orders[iii].allPrice
                    consignmentPrice += orders[iii].consignmentPrice
                    allTonnage += orders[iii].allTonnage
                    allSize += orders[iii].allSize
                    orders[iii] = orders[iii]._id
                }
                objectInvoice = new InvoiceAzyk({
                    city: client.city,
                    priority: priority,
                    discount: discount,
                    orders: orders,
                    client: client._id,
                    allPrice: checkFloat(allPrice),
                    consignmentPrice: checkFloat(consignmentPrice),
                    allTonnage: checkFloat(allTonnage),
                    allSize: checkFloat(allSize),
                    info: info,
                    address: client.address[0],
                    paymentMethod: paymentMethod,
                    number: number,
                    agent: user.employment,
                    organization: organization,
                    adss: [],
                    track: 1,
                    dateDelivery: dateDelivery,
                    forwarder: districtProvider?districtProvider.ecspeditor:null,
                    district:  districtSales?districtSales.name:null,
                    sale: districtSales&&districtSales.organization.toString()!==organization.toString()?districtSales.organization:null,
                    provider: districtProvider?districtProvider.organization:null,
                    who: user._id
                });
                if(inv)
                    objectInvoice.inv = 1
                objectInvoice = await InvoiceAzyk.create(objectInvoice);
            }
            else {
                for(let ii=0; ii<baskets.length;ii++){
                    let price
                    let objectOrder = await OrderAzyk.findOne({
                        item: baskets[ii].item._id,
                        _id: {$in: objectInvoice.orders},
                    })
                    if(objectOrder){
                        price = checkFloat(objectOrder.allPrice/objectOrder.count)
                        objectOrder.count+=baskets[ii].count
                        objectOrder.consignment+=baskets[ii].consignment
                        objectOrder.consignmentPrice+=checkFloat(baskets[ii].consignment*price)
                        objectOrder.allTonnage+=checkFloat(baskets[ii].count*(baskets[ii].item.weight?baskets[ii].item.weight:0))
                        objectOrder.allSize+=checkFloat(baskets[ii].count*(baskets[ii].item.size?baskets[ii].item.size:0))
                        objectOrder.allPrice+=checkFloat(price*baskets[ii].count)
                        await objectOrder.save()
                    }
                    else {
                        price = !discount?
                            baskets[ii].item.price
                            :
                            checkFloat(baskets[ii].item.price-baskets[ii].item.price/100*discount)
                        objectOrder = new OrderAzyk({
                            item: baskets[ii].item._id,
                            client: client._id,
                            count: baskets[ii].count,
                            consignment: baskets[ii].consignment,
                            consignmentPrice: checkFloat(baskets[ii].consignment*price),
                            allTonnage: checkFloat(baskets[ii].count*(baskets[ii].item.weight?baskets[ii].item.weight:0)),
                            allSize: checkFloat(baskets[ii].count*(baskets[ii].item.size?baskets[ii].item.size:0)),
                            allPrice: checkFloat(price*baskets[ii].count),
                            costPrice: baskets[ii].item.costPrice?baskets[ii].item.costPrice:0,
                            status: 'обработка',
                            agent: user.employment,
                        });
                        objectOrder = await OrderAzyk.create(objectOrder);
                        objectInvoice.orders.push(objectOrder);
                    }
                    objectInvoice.allPrice+=price*baskets[ii].count
                    objectInvoice.allTonnage+=checkFloat(baskets[ii].count*(baskets[ii].item.weight?baskets[ii].item.weight:0))
                    objectInvoice.allSize+=checkFloat(baskets[ii].count*(baskets[ii].item.size?baskets[ii].item.size:0))
                    objectInvoice.consignmentPrice+=checkFloat(baskets[ii].consignment*price)
                }
                await OrderAzyk.updateMany({_id: {$in: objectInvoice.orders}}, {status: 'обработка', returned: 0})
                objectInvoice.returnedPrice = 0
                objectInvoice.confirmationForwarder = false
                objectInvoice.confirmationClient = false
                objectInvoice.taken = false
                objectInvoice.sync = 0
                for(let ii=0; ii<objectInvoice.orders.length;ii++) {
                    objectInvoice.orders[ii] = objectInvoice.orders[ii]._id
                }
                let editor
                if(user.role==='admin'){
                    editor = 'админ'
                }
                else if(user.role==='client'){
                    editor = `клиент ${objectInvoice.client.name}`
                }
                else{
                    let employment = await EmploymentAzyk.findOne({user: user._id}).lean()
                    editor = `${user.role} ${employment.name}`
                }
                objectInvoice.editor = editor
                await objectInvoice.save();
                let objectHistoryOrder = new HistoryOrderAzyk({
                    invoice: objectInvoice._id,
                    editor: editor,
                });
                await HistoryOrderAzyk.create(objectHistoryOrder);
            }
            let newInvoice = await InvoiceAzyk.findOne({_id: objectInvoice._id})
                .select(' _id agent createdAt updatedAt allTonnage allSize client allPrice consignmentPrice returnedPrice info address paymentMethod discount adss editor number confirmationForwarder confirmationClient cancelClient district track forwarder sale provider organization cancelForwarder paymentConsignation taken sync city dateDelivery')
                .populate({path: 'client', select: '_id name email phone user', populate: [{path: 'user', select: '_id'}]})
                .populate({path: 'agent', select: '_id name'})
                .populate({path: 'sale', select: '_id name'})
                .populate({path: 'provider', select: '_id name'})
                .populate({path: 'organization', select: '_id name'})
                .populate({path: 'forwarder', select: '_id name'})
                .lean()
            pubsub.publish(RELOAD_ORDER, { reloadOrder: {
                who: user.role==='admin'?null:user._id,
                agent: districtSales?districtSales.agent:undefined,
                superagent: superDistrict?superDistrict.agent:undefined,
                client: client._id,
                organization: organization,
                invoice: newInvoice,
                distributer: districtSales&&districtSales.organization.toString()!==organization.toString()?districtSales.organization:undefined,
                manager: districtSales?districtSales.manager:undefined,
                type: 'ADD'
            } });
            await BasketAzyk.deleteMany({_id: {$in: baskets.map(element=>element._id)}})
        }
        return {data: 'OK'};
    },
    deleteOrders: async(parent, {_id}, {user}) => {
        if(user.role==='admin'){
            let objects = await InvoiceAzyk.find({_id: {$in: _id}})
            for(let i=0; i<objects.length; i++){
                objects[i].del = 'deleted'
                await objects[i].save()
                let superDistrict = await DistrictAzyk.findOne({
                    organization: null,
                    client: objects[i].client
                })
                    .select('agent')
                    .lean();
                let district = null;
                let distributers = await DistributerAzyk.find({
                    sales: objects[i].organization
                })
                    .select('distributer')
                    .lean()
                if(distributers.length>0){
                    for(let i=0; i<distributers.length; i++){
                        if(distributers[i].distributer){
                            district = await DistrictAzyk.findOne({
                                organization: distributers[i].distributer,
                                client: objects[i].client
                            })
                                .select('organization manager agent')
                                .lean()
                        }
                    }
                }
                if(!district) {
                    district = await DistrictAzyk.findOne({
                        organization: objects[i].organization,
                        client: objects[i].client
                    })
                        .select('organization manager agent')
                        .lean()
                }
                pubsub.publish(RELOAD_ORDER, { reloadOrder: {
                    who: user.role==='admin'?null:user._id,
                    client: objects[i].client,
                    agent: district?district.agent:undefined,
                    superagent: superDistrict?superDistrict.agent:undefined,
                    organization: objects[i].organization,
                    invoice: {_id: objects[i]._id},
                    distributer: district&&district.organization.toString()!==objects[i].organization.toString()?district.organization:undefined,
                    manager: district?district.manager:undefined,
                    type: 'DELETE'
                } });
            }
        }
        return {data: 'OK'};
    },
    restoreOrders: async(parent, {_id}, {user}) => {
        if(user.role==='admin'){
            let objects = await InvoiceAzyk.find({_id: {$in: _id}})
            for(let i=0; i<objects.length; i++){
                objects[i].del = null
                await objects[i].save()
            }
        }
        return {data: 'OK'};
    },
    setInvoicesLogic: async(parent, {track, forwarder, invoices}, {user}) => {
        await setSingleOutXMLAzykLogic(invoices, forwarder, track)

        let resInvoices = await InvoiceAzyk.find({_id: {$in: invoices}})
            .select(' _id agent createdAt updatedAt allTonnage allSize client allPrice consignmentPrice returnedPrice info address paymentMethod discount adss editor number confirmationForwarder confirmationClient cancelClient district track forwarder sale provider organization cancelForwarder paymentConsignation taken sync city dateDelivery')
            .populate({path: 'client', select: '_id name email phone user', populate: [{path: 'user', select: '_id'}]})
            .populate({path: 'agent', select: '_id name'})
            .populate({path: 'sale', select: '_id name'})
            .populate({path: 'provider', select: '_id name'})
            .populate({path: 'organization', select: '_id name'})
            .populate({path: 'forwarder', select: '_id name'})
            .lean()
        if(resInvoices.length>0){
            let superDistrict = await DistrictAzyk.findOne({
                organization: null,
                client: resInvoices[0].client._id
            })
                .select('agent')
                .lean();
            let district = null;
            let distributers = await DistributerAzyk.find({
                sales: resInvoices[0].organization._id
            })
                .select('distributer')
                .lean()
            if(distributers.length>0){
                for(let i=0; i<distributers.length; i++){
                    if(distributers[i].distributer){
                        district = await DistrictAzyk.findOne({
                            organization: distributers[i].distributer,
                            client: resInvoices[0].client._id
                        })
                            .select('organization manager agent')
                            .lean()
                    }
                }
            }
            if(!district) {
                district = await DistrictAzyk.findOne({
                    organization: resInvoices[0].organization._id,
                    client: resInvoices[0].client._id
                })
                    .select('organization manager agent')
                    .lean()
            }
            for(let i=0; i<resInvoices.length; i++){
                pubsub.publish(RELOAD_ORDER, { reloadOrder: {
                    who: user.role==='admin'?null:user._id,
                    client: resInvoices[i].client._id,
                    agent: district?district.agent:undefined,
                    superagent: superDistrict?superDistrict.agent:undefined,
                    organization: resInvoices[i].organization._id,
                    distributer: district&&district.organization.toString()!==resInvoices[i].organization._id.toString()?district.organization:undefined,
                    invoice: resInvoices[i],
                    manager: district?district.manager:undefined,
                    type: 'SET'
                } });
            }
        }
        return {data: 'OK'};
    },
    setOrder: async(parent, {orders, invoice}, {user}) => {
        let object = await InvoiceAzyk.findOne({_id: invoice})
            .populate({
                path: 'client'
            })
        let editor;
        if(orders.length>0&&(['экспедитор', 'суперэкспедитор', 'менеджер', 'организация', 'суперорганизация', 'admin', 'client', 'агент', 'суперагент'].includes(user.role))){
            let allPrice = 0
            let allTonnage = 0
            let allSize = 0
           let returnedPrice = 0
            let consignmentPrice = 0
            for(let i=0; i<orders.length;i++){
                await OrderAzyk.updateMany(
                    {_id: orders[i]._id},
                    {
                        count: orders[i].count,
                        allPrice: orders[i].allPrice,
                        consignmentPrice: checkFloat(orders[i].consignmentPrice),
                        returned: orders[i].returned,
                        consignment: orders[i].consignment,
                        allSize: checkFloat(orders[i].allSize),
                        allTonnage: checkFloat(orders[i].allTonnage)
                    });
                returnedPrice += checkFloat(orders[i].returned * (orders[i].allPrice / orders[i].count))
                allPrice += orders[i].allPrice
                allTonnage += orders[i].allTonnage
                allSize += orders[i].allSize
                consignmentPrice += orders[i].consignmentPrice
            }
            object.allPrice = checkFloat(allPrice)
            object.allTonnage = checkFloat(allTonnage)
            object.consignmentPrice = checkFloat(consignmentPrice)
            object.allSize = checkFloat(allSize)
            object.orders = orders.map(order=>order._id)
            object.returnedPrice = checkFloat(returnedPrice)
            await object.save();
        }
        let resInvoice = await InvoiceAzyk.findOne({_id: invoice})
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
            .populate({path: 'agent'})
            .populate({path: 'provider'})
            .populate({path: 'sales'})
            .populate({path: 'adss'})
            .populate({path: 'forwarder'})
            .populate({path: 'organization'})
        if(user.role==='admin'){
            editor = 'админ'
        }
        else if(user.role==='client'){
            editor = `клиент ${resInvoice.client.name}`
        }
        else{
            let employment = await EmploymentAzyk.findOne({user: user._id}).select('name').lean()
            editor = `${user.role} ${employment.name}`
        }
        resInvoice.editor = editor
        await resInvoice.save();
        let objectHistoryOrder = new HistoryOrderAzyk({
            invoice: invoice,
            orders: orders.map(order=>{
                return {
                    item: order.name,
                    count: order.count,
                    consignment: order.consignment,
                    returned: order.returned
                }
            }),
            editor: editor,
        });
        await HistoryOrderAzyk.create(objectHistoryOrder);

        if(resInvoice.organization.pass&&resInvoice.organization.pass.length){
            if(resInvoice.orders[0].status==='принят') {
                resInvoice.sync = await setSingleOutXMLAzyk(resInvoice)
            }
            else if(resInvoice.orders[0].status==='отмена') {
                resInvoice.sync = await cancelSingleOutXMLAzyk(resInvoice)
            }
        }

        let superDistrict = await DistrictAzyk.findOne({
            organization: null,
            client: resInvoice.client._id
        })
            .select('agent')
            .lean();
        let district = null;
        let distributers = await DistributerAzyk.find({
            sales: resInvoice.organization._id
        })
            .select('distributer')
            .lean()
        if(distributers.length>0){
            for(let i=0; i<distributers.length; i++){
                if(distributers[i].distributer){
                    district = await DistrictAzyk.findOne({
                        organization: distributers[i].distributer,
                        client: resInvoice.client._id
                    })
                        .select('organization manager agent')
                        .lean()
                }
            }
        }
        if(!district) {
            district = await DistrictAzyk.findOne({
                organization: resInvoice.organization._id,
                client: resInvoice.client._id
            })
                .select('organization manager agent')
                .lean()
        }

        pubsub.publish(RELOAD_ORDER, { reloadOrder: {
            who: user.role==='admin'?null:user._id,
            client: resInvoice.client._id,
            agent: district?district.agent:undefined,
            superagent: superDistrict?superDistrict.agent:undefined,
            organization: resInvoice.organization._id,
            distributer: district&&district.organization.toString()!==resInvoice.organization._id.toString()?district.organization:undefined,
            invoice: resInvoice,
            manager: district?district.manager:undefined,
            type: 'SET'
        } });
        return resInvoice
    },
    setInvoice: async(parent, {adss, taken, invoice, confirmationClient, confirmationForwarder, cancelClient, cancelForwarder, paymentConsignation}, {user}) => {
        let object = await InvoiceAzyk.findOne({_id: invoice}).populate('client').populate('order')
        let admin = ['admin', 'суперагент', 'суперэкспедитор'].includes(user.role)
        let client = 'client'===user.role&&user.client.toString()===object.client._id.toString()
        let undefinedClient = ['менеджер', 'суперорганизация', 'организация', 'экспедитор', 'агент'].includes(user.role)&&!object.client.user
        let employment = ['менеджер', 'суперорганизация', 'организация', 'агент', 'экспедитор'].includes(user.role)&&[object.organization.toString(), object.sale?object.sale.toString():'lol', object.provider?object.provider.toString():'lol'].includes(user.organization.toString());
        if(adss!=undefined&&(admin||undefinedClient||employment)) {
            object.adss = adss
        }
        if(paymentConsignation!=undefined&&(admin||undefinedClient||employment)){
            object.paymentConsignation = paymentConsignation
        }
        if(taken!=undefined&&(admin||employment)){
            object.taken = taken
            if(taken) {
                await OrderAzyk.updateMany({_id: {$in: object.orders}}, {status: 'принят'})
            }
            else {
                await OrderAzyk.updateMany({_id: {$in: object.orders}}, {status: 'обработка', returned: 0})
                object.confirmationForwarder = false
                object.confirmationClient = false
                object.returnedPrice = 0
                object.sync = object.sync!==0?1:0
            }
        }
        if(object.taken&&confirmationClient!=undefined&&(admin||undefinedClient||client)){
            object.confirmationClient = confirmationClient
            if(!confirmationClient) {
                await OrderAzyk.updateMany({_id: {$in: object.orders}}, {status: 'принят'})
            }
        }
        if(object.taken&&confirmationForwarder!=undefined&&(admin||employment)){
            object.confirmationForwarder = confirmationForwarder
            if(!confirmationForwarder) {
                await OrderAzyk.updateMany({_id: {$in: object.orders}}, {status: 'принят'})
            }
        }
        if(object.taken&&object.confirmationForwarder&&object.confirmationClient){
            await OrderAzyk.updateMany({_id: {$in: object.orders}}, {status: 'выполнен'})
        }

        if(object.taken&&(object.confirmationForwarder||object.confirmationClient)){
            let route = await RouteAzyk.findOne({invoices: invoice}).populate({
                path: 'invoices',
                populate : {
                    path : 'orders',
                }
            });
            if(route){
                let completedRoute = true;
                for(let i = 0; i<route.invoices.length; i++) {
                    if(!route.invoices[i].cancelClient&&!route.invoices[i].cancelForwarder)
                        completedRoute = route.invoices[i].confirmationForwarder;
                }
                if(completedRoute)
                    route.status = 'выполнен';
                else
                    route.status = 'выполняется';
                await route.save();
            }
        }

        if(cancelClient!=undefined&&(cancelClient||object.cancelClient!=undefined)&&!object.cancelForwarder&&(admin||client)){
            if(cancelClient){
                object.cancelClient = new Date()
                await OrderAzyk.updateMany({_id: {$in: object.orders}}, {status: 'отмена'})
            }
            else if(!cancelClient) {
                let difference = (new Date()).getTime() - (object.cancelClient).getTime();
                let differenceMinutes = checkFloat(difference / 60000);
                if (differenceMinutes < 10||user.role==='admin') {
                    object.cancelClient = undefined
                    await OrderAzyk.updateMany({_id: {$in: object.orders}}, {status: 'обработка'})
                    object.taken = undefined
                    object.confirmationClient = undefined
                    object.confirmationForwarder = undefined
                }
            }
        }

        if(cancelForwarder!=undefined&&(cancelForwarder||object.cancelForwarder!=undefined)&&!object.cancelClient&&(admin||employment)){
            if(cancelForwarder){
                object.cancelForwarder = new Date()
                await OrderAzyk.updateMany({_id: {$in: object.orders}}, {status: 'отмена'})
            }
            else if(!cancelForwarder) {
                let difference = (new Date()).getTime() - (object.cancelForwarder).getTime();
                let differenceMinutes = checkFloat(difference / 60000);
                if (differenceMinutes < 10||user.role==='admin') {
                    object.cancelForwarder = undefined
                    object.cancelClient = undefined
                    await OrderAzyk.updateMany({_id: {$in: object.orders}}, {status: 'обработка'})
                    object.taken = undefined
                    object.confirmationClient = undefined
                    object.confirmationForwarder = undefined
                }
            }
        }

        await object.save();
        return {data: 'OK'};
    }
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
                        (user.organization&&payload.reloadOrder.distributer&&['суперорганизация', 'организация'].includes(user.role)&&payload.reloadOrder.distributer.toString()===user.organization.toString())||
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