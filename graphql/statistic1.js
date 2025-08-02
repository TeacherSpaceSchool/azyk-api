const InvoiceAzyk = require('../models/invoiceAzyk');
const OrderAzyk = require('../models/orderAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const ClientAzyk = require('../models/clientAzyk');
const ItemAzyk = require('../models/itemAzyk');
const AdsAzyk = require('../models/adsAzyk');
const {checkDate, isNotEmpty} = require('../module/const');
const {checkFloat} = require('../module/const');
const OrganizationAzyk = require('../models/organizationAzyk');

const type = `
    type Statistic {
        columns: [String]
        row: [StatisticData]
   }
    type StatisticData {
        _id: ID
        data: [String]
   }
    type ChartStatistic {
        label: String
        data: [[String]]
   }
    type GeoStatistic {
        client: ID
        address: [String]
        data: [String]
   }
    type ChartStatisticAll {
        all: Float
        chartStatistic: [ChartStatistic]
   }
`;

const query = `
    checkAgentRoute(agentRoute: ID!): Statistic
    statisticClients(organization: ID, dateStart: Date, dateEnd: Date, filter: String, district: ID, city: String): Statistic
    statisticItems(dayStart: Int, organization: ID, dateStart: Date, dateEnd: Date, online: Boolean, city: String): Statistic
    statisticAdss(organization: ID, dateStart: Date, dateEnd: Date, online: Boolean, city: String): Statistic
    statisticOrders(organization: ID, dateStart: Date, dateEnd: Date, online: Boolean, city: String): Statistic
`;

const mutation = `
    repairUnsyncOrder: String
`;

const resolvers = {
    checkAgentRoute: async(parent, {agentRoute}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            const problem = []
            agentRoute = await AgentRouteAzyk.findById(agentRoute).select('clients district').lean()
            const agentRouteClients = (agentRoute.clients.flat()).toString()
            const district = await DistrictAzyk.findById(agentRoute.district).select('client').lean()
            const clients = await ClientAzyk.find({_id: {$in: district.client}}).select('_id user name address').populate({path: 'user', select: 'status'}).lean()
            for(const client of clients) {
                if(
                    client.user.status==='active'&&!agentRouteClients.includes(client._id.toString())) {
                    problem.push(
                        {
                            _id: client._id,
                            data: [
                                client.name,
                                client.address[0][2],
                                client.address[0][0]
                            ]
                       })
               }
           }
            return {
                columns: ['клиент', 'магазин', 'адрес'],
                row: problem
           };
       }
   },
    statisticClients: async(parent, {organization, dateStart, filter, dateEnd, city, district}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            if(user.organization) organization = user.organization
            const onlyOnline = filter==='online'
            const onlyOffline = filter==='offline'
            dateStart = checkDate(dateStart)
            dateStart.setHours(3, 0, 0, 0)
            if(dateEnd) {
                dateEnd = checkDate(dateEnd)
                dateEnd.setHours(3, 0, 0, 0)
            }
            else {
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
            }
            let profitAll = 0
            let profitOnlineAll = 0
            let profitOfflineAll = 0
            let completeAll = 0
            let completeOnlineAll = 0
            let completeOfflineAll = 0
            let statistic = {}
            let districtClients
            if(district) {
                districtClients = await DistrictAzyk.findById(district).distinct('client')
           }
            const invoices = await InvoiceAzyk.find(
                {
                    createdAt: {$gte: dateStart, $lt: dateEnd},
                    del: {$ne: 'deleted'},
                    taken: true,
                    ...onlyOnline?{agent: null}:onlyOffline?{agent: {$ne: null}}:{},
                    ...organization?{organization}:{},
                    ...city?{city}:{},
                    ...districtClients?{client: {$in: districtClients}}:{}
               }
            )
                .select('client address agent returnedPrice _id allPrice')
                .lean()

            for(const invoice of invoices) {
                if (!statistic[invoice.client._id])
                    statistic[invoice.client._id] = {
                        profit: 0,
                        profitOnline: 0,
                        profitOffline: 0,
                        complete: 0,
                        completeOnline: 0,
                        completeOffline: 0,
                        client: `${invoice.address[2]}, ${invoice.address[0]}`
                   }
                const profit = invoice.allPrice - invoice.returnedPrice
                if(profit) {
                    statistic[invoice.client._id].complete += 1
                    completeAll += 1
               }
                statistic[invoice.client._id].profit += profit
                profitAll += profit
                if(!invoice.agent) {
                    statistic[invoice.client._id].completeOnline += 1
                    statistic[invoice.client._id].profitOnline += profit
                    completeOnlineAll += 1
                    profitOnlineAll += profit
               }
                else {
                    statistic[invoice.client._id].completeOffline += 1
                    statistic[invoice.client._id].profitOffline += profit
                    completeOfflineAll += 1
                    profitOfflineAll += profit
               }
           }
            const keys = Object.keys(statistic)

            let data = []
            for(const key of keys) {
                data.push({
                    _id: key,
                    data: [
                        statistic[key].client,
                        ...!onlyOffline&&!onlyOnline?[checkFloat(statistic[key].profit)]:[],
                        ...!onlyOffline?[checkFloat(statistic[key].profitOnline)]:[],
                        ...!onlyOnline?[checkFloat(statistic[key].profitOffline)]:[],
                        ...!onlyOffline&&!onlyOnline?[checkFloat(statistic[key].complete)]:[],
                        ...!onlyOffline?[checkFloat(statistic[key].completeOnline)]:[],
                        ...!onlyOnline?[checkFloat(statistic[key].completeOffline)]:[],
                    ]
               })
           }
            data = data.sort(function(a, b) {
                return checkFloat(b.data[1]) - checkFloat(a.data[1])
           });
            data = [
                {
                    _id: 'All',
                    data: [
                        data.length,
                        ...!onlyOffline&&!onlyOnline?[checkFloat(profitAll)]:[],
                        !onlyOffline?checkFloat(profitOnlineAll):'',
                        !onlyOnline?checkFloat(profitOfflineAll):'',
                        ...!onlyOffline&&!onlyOnline?[completeAll]:[],
                        !onlyOffline?completeOnlineAll:'',
                        !onlyOnline?completeOfflineAll:'',
                    ]
               },
                ...data
            ]
            return {
                columns: ['клиент',
                    ...!onlyOffline&&!onlyOnline?['выручка(сом)']:[], ...!onlyOffline?['выручка online(сом)']:[], ...!onlyOnline?['выручка offline(сом)']:[],
                    ...!onlyOffline&&!onlyOnline?['выполнен(шт)']:[], ...!onlyOffline?['выполнен online(шт)']:[], ...!onlyOnline?['выполнен offline(шт)']:[]
                ],
                row: data
           };
       }
   },
    statisticItems: async(parent, {dayStart, organization, dateStart, dateEnd, online, city}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            //console.time('get BD')
            if(user.organization) organization = user.organization
            dateStart = checkDate(dateStart)
            dateStart.setHours(isNotEmpty(dayStart)?dayStart:3, 0, 0, 0)
            if(dateEnd) {
                dateEnd = checkDate(dateEnd)
                dateEnd.setHours(isNotEmpty(dayStart)?dayStart:3, 0, 0, 0)
           }
            else {
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
           }
            let statistic = {}
            let profitAll = 0
            const invoices = await InvoiceAzyk.find(
                {
                    createdAt: {$gte: dateStart, $lt: dateEnd},
                    ...organization?{organization}:{},
                    del: {$ne: 'deleted'},
                    taken: true,
                    ...online?{agent: null}:{},
                    ...city?{city}:{},
               }
            )
                .select('orders')
                .lean()
            const orders = await OrderAzyk.find({_id: {$in: (invoices.map(invoice => invoice.orders)).flat()}})
                .select('_id item allPrice returned count')
                .lean();
            const items = await ItemAzyk.find({_id: {$in: orders.map(order => order.item)}})
                .select('_id name')
                .lean();
            const itemById = {};
            for(const item of items) {
                itemById[item._id] = item
           }
            for(const order of orders) {
                const item = itemById[order.item];
                if(order.returned) {
                    const price = checkFloat(order.allPrice/order.count)
                    order.count = order.count - order.returned
                    order.allPrice = order.count * price
               }
                if (!statistic[item._id]) statistic[item._id] = {
                    profit: 0,
                    count: 0,
                    item: item.name
               }
                statistic[item._id].count += order.count
                statistic[item._id].profit += order.allPrice
                profitAll += order.allPrice
           }
            const keys = Object.keys(statistic)
            let data = []
            for(const key of keys) {
                data.push({
                    _id: key,
                    data: [
                        statistic[key].item,
                        checkFloat(statistic[key].profit),
                        checkFloat(statistic[key].count),
                        checkFloat(statistic[key].profit*100/profitAll)
                    ]
               })
           }
            data = data.sort(function(a, b) {
                return b.data[1] - a.data[1]
           });
            data = [
                {
                    _id: 'All',
                    data: [
                        data.length,
                        checkFloat(profitAll),
                        invoices.length
                    ]
               },
                ...data
            ]
            //console.timeEnd('get BD')
            return {
                columns: ['товар', 'выручка(сом)', 'количество(шт)', 'процент'],
                row: data
           };
       }
   },
    statisticAdss: async(parent, {organization, dateStart, dateEnd, online, city}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            if(user.organization) organization = user.organization
            dateStart = checkDate(dateStart)
            dateStart.setHours(3, 0, 0, 0)
            if(dateEnd) {
                dateEnd = checkDate(dateEnd)
                dateEnd.setHours(3, 0, 0, 0)
            }
            else {
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
            }
            let statistic = {}
            let profitAll = 0
            let returnedAll = 0
            let completAll = []

            const invoices = await InvoiceAzyk.find(
                {
                    createdAt: {$gte: dateStart, $lt: dateEnd},
                    ...organization?{organization}:{},
                    adss: {$ne: []},
                    del: {$ne: 'deleted'},
                    taken: true,
                    ...online?{agent: null}:{},
                    ...city?{city}:{},
               }
            )
                .select('adss allPrice _id returnedPrice')
                .lean()

            const adss = await AdsAzyk.find({
                _id: {$in: (invoices.map(invoice => invoice.adss)).flat()},
                ...organization?{organization}:{}
           }).select('_id title').lean()

            const adsById = {}
            for(const ads of adss) {
                adsById[ads._id] = ads
           }
            for(const invoice of invoices) {
                for(let ads of invoice.adss) {
                    ads = adsById[ads]
                    if (!statistic[ads._id]) statistic[ads._id] = {
                        profit: 0,
                        returned: 0,
                        complet: [],
                        ads: ads.title
                   }

                    const profit = invoice.allPrice - invoice.returnedPrice

                    statistic[ads._id].profit += profit
                    statistic[ads._id].returned += invoice.returnedPrice

                    if(profit&&!statistic[ads._id].complet.includes(invoice._id.toString()))
                        statistic[ads._id].complet.push(invoice._id.toString())

                    if(!completAll.includes(invoice._id.toString())) {
                        completAll.push(invoice._id.toString())
                        profitAll += profit
                        returnedAll += invoice.returnedPrice
                   }


               }
           }
            const keys = Object.keys(statistic)
            let data = []

            for(const key of keys) {
                data.push({
                    _id: key,
                    data: [
                        statistic[key].ads,
                        checkFloat(statistic[key].profit),
                        statistic[key].complet.length,
                        ...returnedAll?[checkFloat(statistic[key].returned)]:[],
                        checkFloat(statistic[key].profit*100/profitAll)
                    ]
               })
           }
            data = data.sort(function(a, b) {
                return b.data[1] - a.data[1]
           });
            data = [
                {
                    _id: 'All',
                    data: [
                        data.length,
                        checkFloat(profitAll),
                        completAll.length,
                        checkFloat(returnedAll)
                    ]
               },
                ...data
            ]
            return {
                columns: ['акция', 'выручка(сом)', 'выполнен(шт)', ...returnedAll?['возврат(сом)']:[], 'процент'],
                row: data
           };
       }
   },
    statisticOrders: async(parent, {organization, dateStart, dateEnd, online, city}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            if(user.organization) organization = user.organization
            dateStart = checkDate(dateStart)
            dateStart.setHours(3, 0, 0, 0)
            if(dateEnd) {
                dateEnd = checkDate(dateEnd)
                dateEnd.setHours(3, 0, 0, 0)
            }
            else {
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
            }
            let statistic = {}, data = []
            let profitAll = 0
            let completAll = 0
            let returnedAll = 0

            const invoices = await InvoiceAzyk.find({
                createdAt: {$gte: dateStart, $lt: dateEnd},
                taken: true,
                del: {$ne: 'deleted'},
                ...city?{city}:{},
                ...organization?{organization}:{},
                ...online?{agent: null}:{}
           })
                .select('_id returnedPrice allPrice client organization')
                .lean()

            // eslint-disable-next-line no-undef
            const [organizations, districts] = await Promise.all([
                OrganizationAzyk.find({
                    ...organization?{_id: organization}:{_id: {$in: invoices.map(invoice => invoice.organization)}},
                    ...city?{cities: city}:{},
               }).select('_id name').lean(),
                organization?DistrictAzyk.find({organization}).select('_id name client').lean():[],
            ])

            const organizationById = {}
            for(const organization of organizations) {
                organizationById[organization._id] = organization
           }

            const districtByClient = {}
            for(const district of districts) {
                for(const client of district.client) {
                    districtByClient[client] = {_id: district._id, name: district.name}
               }
           }

            for(const invoice of invoices) {
                let object = organization? districtByClient[invoice.client] : organizationById[invoice.organization]
                if(!object) object = {_id: 'Прочие', name: 'Прочие'}
                if (!statistic[object._id])
                    statistic[object._id] = {
                        profit: 0,
                        complet: 0,
                        returnedPrice: 0,
                        clients: {},
                        name: object.name
                   }
                if(!statistic[object._id].clients[invoice.client]) {
                    statistic[object._id].clients[invoice.client] = 1
               }

                const profit = invoice.allPrice - invoice.returnedPrice

                statistic[object._id].profit += profit
                profitAll += profit

                statistic[object._id].returnedPrice += invoice.returnedPrice
                returnedAll += invoice.returnedPrice

                if(profit) {
                    statistic[object._id].complet += 1
                    completAll += 1
               }
           }

            const keys = Object.keys(statistic)
            data = []
            for(const key of keys) {
                data.push({
                    _id: key,
                    data: [
                        statistic[key].name,
                        checkFloat(statistic[key].profit),
                        statistic[key].complet,
                        ...returnedAll?[checkFloat(statistic[key].returnedPrice)]:[],
                        checkFloat(statistic[key].profit/statistic[key].complet),
                        Object.keys(statistic[key].clients).length,
                        checkFloat(statistic[key].profit*100/profitAll)
                    ]
               })
           }
            data = data.sort(function(a, b) {
                return b.data[1] - a.data[1]
           });
            data = [
                {
                    _id: 'All',
                    data: [
                        data.length,
                        checkFloat(profitAll),
                        completAll,
                        checkFloat(returnedAll)
                    ]
               },
                ...data
            ]

            return {
                columns: [organization?'район':'организация', 'выручка(сом)', 'выполнен(шт)', ...returnedAll?['отказы(сом)']:[], 'средний чек(сом)', 'клиенты', 'процент'],
                row: data
           };
       }
   },
};

const resolversMutation = {
    repairUnsyncOrder: async(parent, args, {user}) => {
        if (user.role === 'admin') {
            const dateStart = new Date()
            dateStart.setHours(3, 0, 0, 0)
            const dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            const organizations = await OrganizationAzyk.find({pass: {$nin: ['', null]}}).distinct('_id')
            const invoices = await InvoiceAzyk.find({
                createdAt: {$gte: dateStart, $lt: dateEnd},
                sync: {$nin: [1, 2]},
                cancelClient: null,
                cancelForwarder: null,
                del: {$ne: 'deleted'},
                taken: true,
                organization: {$in: organizations},
           })
                .select('_id orders')
                .lean()
            // eslint-disable-next-line no-undef
            await Promise.all([
                OrderAzyk.updateMany({_id: {$in: (invoices.map(invoice => invoice.orders)).flat()}}, {status: 'обработка'}),
                InvoiceAzyk.updateMany({_id: {$in: invoices.map(invoice => invoice._id)}}, {
                    taken: false,
                    cancelClient: null,
                    cancelForwarder: null,
               })
            ])

            return  'OK'
       }
   }
}

module.exports.mutation = mutation;
module.exports.resolversMutation = resolversMutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;