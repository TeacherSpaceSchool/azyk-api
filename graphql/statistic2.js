const InvoiceAzyk = require('../models/invoiceAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const AgentRouteAzyk = require('../models/agentRouteAzyk');
const {weekDay, pdDDMMYYHHMM, checkFloat, month, checkDate, dayStartDefault, formatAmount} = require('../module/const');

const query = `
    ordersMap(organization: ID, date: Date, online: Boolean, city: String, district: ID): [[String]]
    statisticOrdersOffRoute(type: String, organization: ID, dateStart: Date, dateEnd: Date, online: Boolean, city: String, district: ID): Statistic
    statisticHours(organization: ID!, dateStart: Date, dateEnd: Date, city: String, type: String!): Statistic
    statisticUnsyncOrder: Statistic
`;

const resolvers = {
    ordersMap: async(parent, {organization, date, online, city}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            if(user.organization) organization = user.organization
            const dateStart = checkDate(date)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            const dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            const geos = []
            const invoices = await InvoiceAzyk.find({
                createdAt: {$gte: dateStart, $lt: dateEnd},
                taken: true,
                del: {$ne: 'deleted'},
                'address.1': {$nin: [null, '', '42.8700000, 74.5900000']},
                ...city?{city}:{},
                ...organization?{organization}:{},
                ...online?{agent: null}:{}
            })
                .select('_id address')
                .lean()
            for(const invoice of invoices) {
                geos.push(invoice.address[1].split(', '))
            }
            return geos;
        }
    },
    statisticOrdersOffRoute: async(parent, {type, organization, dateStart, dateEnd, online, city, district}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            if(user.organization) organization = user.organization
            dateStart = checkDate(dateStart)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            if(dateEnd) {
                dateEnd = checkDate(dateEnd)
                dateEnd.setHours(dayStartDefault, 0, 0, 0)
            }
            else {
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
            }
            let statistic = {}, data
            let profitAll = 0
            let completAll = 0
            let returnedAll = 0

            // eslint-disable-next-line no-undef
            const [agentRoutes, districts] = await Promise.all([
                AgentRouteAzyk.find({organization}).select('clients').lean(),
                DistrictAzyk.find({organization, ...district?{_id: district}:{}}).select('_id name client').lean()
            ])

            let routes = [[],[],[],[],[],[],[]]
            for(const agentRoute of agentRoutes) {
                for(let i = 0; i < 7; i++) {
                    routes[i] = [...routes[i], ...agentRoute.clients[i]]
               }
           }
            routes = routes.map(route => route.toString());

            let districtByClient = {}, districtClients = []
            for(const district of districts) {
                districtClients = [...districtClients, ...district.client]
                for(const client of district.client) {
                    districtByClient[client] = district
               }
           }


            const invoices = await InvoiceAzyk.find(
                {
                    createdAt: {$gte: dateStart, $lt: dateEnd},
                    del: {$ne: 'deleted'},
                    client: {$in: districtClients},
                    taken: true,
                    ...organization?{organization}:{},
                    ...online?{agent: null}:{},
                    ...city?{city}:{},
               }
            )
                .select('_id createdAt returnedPrice allPrice client address')
                .lean()

            let orderAllCount = invoices.length

            for(const invoice of invoices) {
                const date = new Date(invoice.createdAt); // Указываем дату
                const dayOfWeek = (date.getDay() + 6) % 7;
                if(!routes[dayOfWeek].includes(invoice.client.toString())) {
                    let object = {_id: 'Прочие', name: 'Прочие'}
                    if(type==='клиент') {
                        object._id = invoice.client
                        object.name = `${invoice.address[2]}, ${invoice.address[0]}`
                   }
                    else if(districtByClient[invoice.client]) {
                        object = districtByClient[invoice.client]
                   }
                    if (!statistic[object._id])
                        statistic[object._id] = {
                            profit: 0,
                            complet: 0,
                            returnedPrice: 0,
                            clients: {},
                            name: object.name
                       }

                    const profit = invoice.allPrice - invoice.returnedPrice

                    if (type==='район'&&!statistic[object._id].clients[invoice.client]) {
                        statistic[object._id].clients[invoice.client] = 1
                   }

                    statistic[object._id].profit += profit
                    profitAll += profit

                    statistic[object._id].returnedPrice += invoice.returnedPrice
                    returnedAll += invoice.returnedPrice

                    if (profit) {
                        statistic[object._id].complet += 1
                        completAll += 1
                   }

               }
           }

            const keys = Object.keys(statistic)
            data = []

            for(const key of keys) {
                data.push({
                    _id: key,
                    data: [
                        statistic[key].name,
                        formatAmount(checkFloat(statistic[key].profit)),
                        formatAmount(statistic[key].complet),
                        ...returnedAll?[formatAmount(checkFloat(statistic[key].returnedPrice))]:[],
                        formatAmount(checkFloat(statistic[key].profit/statistic[key].complet)),
                        ...type==='район'?[formatAmount(Object.keys(statistic[key].clients).length)]:[],
                        formatAmount(checkFloat(statistic[key].profit*100/profitAll))
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
                        `${formatAmount(completAll)}/${formatAmount(orderAllCount)}`,
                        formatAmount(checkFloat(profitAll)),
                        formatAmount(checkFloat(returnedAll)),
                    ]
               },
                ...data
            ]
            return {
                columns: [type, 'выручка(сом)', 'выполнен(шт)', ...returnedAll?['отказы(сом)']:[], 'средний чек(сом)', ...type==='районы'?['клиенты']:[], 'процент'],
                row: data
           };
       }
   },
    statisticHours: async(parent, {organization, dateStart, dateEnd, city, type}, {user}) => {
        if(['admin', 'суперорганизация'].includes(user.role)) {
            if(user.organization) organization = user.organization
            dateStart = checkDate(dateStart)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            if(dateEnd) {
                dateEnd = checkDate(dateEnd)
                dateEnd.setHours(dayStartDefault, 0, 0, 0)
            }
            else {
                dateEnd = new Date(dateStart)
                dateEnd.setDate(dateEnd.getDate() + 1)
            }
            let statistic = {}, data = []
            let profitOnline = 0
            let profitOffline = 0
            let completOnline = 0
            let completOffline = 0
            let profitAll = 0
            let completAll = 0
            let name

            const invoices = await InvoiceAzyk.find(
                {
                    createdAt: {$gte: dateStart, $lt: dateEnd},
                    del: {$ne: 'deleted'},
                    taken: true,
                    organization,
                    ...city?{city}:{},
               }
            )
                .select('_id returnedPrice allPrice agent client createdAt')
                .lean()
            for(const invoice of invoices) {
                if(type==='hours') {
                    if (invoice.createdAt.getHours() < 18 && invoice.createdAt.getHours() > 8)
                        name = '08:00-18:00'
                    else
                        name = '18:00-08:00'
               }
                else if(type==='weekDay')
                    name = weekDay[invoice.createdAt.getDay()]
                else if(type==='month')
                    name = month[invoice.createdAt.getMonth()]
                if (!statistic[name])
                    statistic[name] = {
                        name,
                        profitAll: 0,
                        profitOnline: 0,
                        profitOffline: 0,
                        completAll: 0,
                        completOnline: 0,
                        completOffline: 0,
                   }

                const profit = invoice.allPrice - invoice.returnedPrice

                statistic[name].profitAll += profit
                profitAll += profit
                if(profit) {
                    statistic[name].completAll += 1
                    completAll += 1
               }
                if(invoice.agent) {
                    statistic[name].profitOffline += profit
                    profitOffline += profit
                    if(profit) {
                        statistic[name].completOffline += 1
                        completOffline += 1
                   }
               }
                else {
                    statistic[name].profitOnline += profit
                    profitOnline += profit
                    if(profit) {
                        statistic[name].completOnline += 1
                        completOnline += 1
                   }
               }
           }

            const keys = Object.keys(statistic)
            data = []

            for(const key of keys) {
                data.push({
                    _id: key,
                    data: [
                        statistic[key].name,
                        formatAmount(checkFloat(statistic[key].profitAll)),
                        formatAmount(checkFloat(statistic[key].profitOnline)),
                        formatAmount(checkFloat(statistic[key].profitOffline)),
                        formatAmount(checkFloat(statistic[key].completAll)),
                        formatAmount(checkFloat(statistic[key].completOnline)),
                        formatAmount(checkFloat(statistic[key].completOffline))
                    ]
               })
           }

            data = [
                {
                    _id: 'All',
                    data: [
                        formatAmount(checkFloat(profitAll)),
                        formatAmount(checkFloat(profitOnline)),
                        formatAmount(checkFloat(profitOffline)),
                        formatAmount(checkFloat(completAll)),
                        formatAmount(checkFloat(completOnline)),
                        formatAmount(checkFloat(completOffline))
                    ]
               },
                ...data
            ]
            return {
                columns: ['часы', 'выручка(сом)', 'выручка online(сом)', 'выручка offline(сом)', 'выполнен(шт)', 'выполнен online(шт)', 'выполнен offline(шт)'],
                row: data
           };
       }
   },
    statisticUnsyncOrder: async(parent, args, {user}) => {
        if(['admin'].includes(user.role)) {
            let res = []
            const organizations = await OrganizationAzyk.find({pass: {$nin: ['', null]}}).distinct('_id')
            const dateStart = new Date()
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            const dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)

            const invoices = await InvoiceAzyk.find({
                createdAt: {$gte: dateStart, $lt: dateEnd},
                sync: {$nin: [1, 2]},
                cancelClient: null,
                cancelForwarder: null,
                del: {$ne: 'deleted'},
                taken: true,
                organization: {$in: organizations}
           })
                .select('_id number createdAt updatedAt editor')
                .sort('-createdAt')
                .lean()
            for(const invoice of invoices) {
                res.push({
                    _id: invoice['_id'],
                    data: [
                        invoice['number'],
                        pdDDMMYYHHMM(invoice['createdAt']),
                        pdDDMMYYHHMM(invoice['updatedAt']),
                        invoice['editor'],
                    ]
               })
           }
            return {
                columns: ['номер', 'создан', 'изменен', 'пользователь'],
                row: res
           };
       }
   }
};

module.exports.query = query;
module.exports.resolvers = resolvers;