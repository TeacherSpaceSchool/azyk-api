const InvoiceAzyk = require('../models/invoiceAzyk');
const ReturnedAzyk = require('../models/returnedAzyk');
const MerchandisingAzyk = require('../models/merchandisingAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const {pdDDMMYYYY, checkDate, dayStartDefault, formatAmount} = require('../module/const');
const {pdHHMM, checkFloat} = require('../module/const');
const AgentHistoryGeoAzyk = require('../models/agentHistoryGeoAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const {roleList} = require('../module/enum');

const query = `
    statisticReturned(organization: ID, dateStart: Date, dateEnd: Date, city: String): Statistic
    statisticAgents(organization: ID, dateStart: Date, dateEnd: Date, city: String): Statistic
    statisticAgentsWorkTime(organization: ID, dateStart: Date): Statistic
    statisticMerchandising(type: String, agent: ID, dateStart: Date, dateEnd: Date, organization: ID): Statistic
`;

const resolvers = {
    statisticReturned: async(parent, {organization, dateStart, dateEnd, city}, {user}) => {
        if([roleList.admin, roleList.superOrganization].includes(user.role)) {
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

            let profitAll = 0
            let completAll = 0

            const returneds = await ReturnedAzyk.find({
                createdAt: {$gte: dateStart, $lt: dateEnd},
                confirmationForwarder: true,
                ...city ? {city} : {},
                del: {$ne: 'deleted'}
           }).select('organization allPrice client').lean()

            // eslint-disable-next-line no-undef
            const [organizations, districts] = await Promise.all([
                OrganizationAzyk.find({
                    ...organization?{_id: organization}:{_id: {$in: returneds.map(returned => returned.organization)}},
                    ...city?{cities: city}:{},
                }).select('_id name').lean(),
                organization?DistrictAzyk.find({organization}).select('_id name client').lean():[],

            ])


            const organizationById = {}
            for(const organization of organizations) {
                organizationById[organization._id.toString()] = organization
           }

            const districtByClient = {}
            for(const district of districts) {
                for(const client of district.client) {
                    districtByClient[client] = {_id: district._id, name: district.name}
               }
           }

            for(const returned of returneds) {
                let object = organization? districtByClient[returned.client] : organizationById[returned.organization]
                if(!object) object = {_id: 'Прочие', name: 'Прочие'}
                if (!statistic[object._id]) statistic[object._id] = {
                    profit: 0,
                    complet: 0,
                    name: object.name
               }

                statistic[object._id].complet+=1
                profitAll += returned.allPrice
                statistic[object._id].profit += returned.allPrice
                completAll += 1

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
                        formatAmount(data.length),
                        formatAmount(checkFloat(profitAll)),
                        formatAmount(completAll)
                    ]
               },
                ...data
            ]
            return {
                columns: [organization?'район':roleList.organization, 'сумма(сом)', 'выполнен(шт)', 'процент'],
                row: data
           };
       }
   },
    statisticAgents: async(parent, {organization, dateStart, dateEnd, city}, {user}) => {
        if([roleList.admin, roleList.superOrganization].includes(user.role)) {
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

            let profitAll = 0
            let returnedAll = 0
            let completAll = 0

            const invoices = await InvoiceAzyk.find({
                    createdAt: {$gte: dateStart, $lt: dateEnd},
                    del: {$ne: 'deleted'},
                    taken: true,
                    ...city?{city}:{},
                    ...organization?{organization}:{}
           })
                .select('organization agent returnedPrice allPrice _id')
                .lean()

            // eslint-disable-next-line no-undef
            const [organizations, agents] = await Promise.all([
                OrganizationAzyk.find({
                    ...organization?{_id: organization}:{_id: {$in: invoices.map(invoice => invoice.organization)}}
               }).select('_id name').lean(),
                organization?EmploymentAzyk.find({organization}).select('_id name').lean():[]
            ])


            const organizationById = {}
            for(const organization of organizations) {
                organizationById[organization._id] = organization
           }


            const agentById = {}
            for(const agent of agents) {
                agentById[agent._id] = agent
           }


            for(const invoice of invoices) {
                const type = organization?'':!invoice.agent?' онлайн':' оффлайн'

                const object = (organization?agentById[invoice.agent]:organizationById[invoice.organization])||{_id: 'AZYK.STORE', name: 'AZYK.STORE'}

                const _id = `${type}${object._id}`

                if (!statistic[_id]) statistic[_id] = {
                    profit: 0,
                    returned: 0,
                    complet: 0,
                    name: `${object.name}${type}`
               }

                const profit = invoice.allPrice - invoice.returnedPrice

                if(profit) {
                    statistic[_id].complet += 1
                    completAll += 1
               }
                statistic[_id].profit += profit
                profitAll += profit
                statistic[_id].returned += invoice.returnedPrice
                returnedAll += invoice.returnedPrice
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
                        ...returnedAll?[formatAmount(checkFloat(statistic[key].returned))]:[],
                        formatAmount(checkFloat(statistic[key].profit/statistic[key].complet)),
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
                        data.length,
                        formatAmount(checkFloat(profitAll)),
                        formatAmount(completAll),
                        formatAmount(checkFloat(returnedAll)),
                    ]
               },
                ...data
            ]
            return {
                columns: [organization?'агент':roleList.organization, 'выручка(сом)', 'выполнен(шт)', ...returnedAll?['отказов(сом)']:[], 'средний чек(сом)', 'процент'],
                row: data
           };
       }
   },
    statisticAgentsWorkTime: async(parent, {organization, dateStart}, {user}) => {
        if([roleList.admin, roleList.superOrganization].includes(user.role)) {
            if(user.organization) organization = user.organization
            dateStart = checkDate(dateStart)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            let dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            const agents = await EmploymentAzyk.find({organization: organization==='super'?null:organization}).distinct('_id')
            // eslint-disable-next-line no-undef
            const [invoices, agentHistoryGeoAzyks] = await Promise.all([
                InvoiceAzyk.find({createdAt: {$gte: dateStart, $lt: dateEnd}, del: {$ne: 'deleted'}, agent: {$in: agents}})
                    .select('createdAt agent').populate({path: 'agent', select: '_id name'}).sort('createdAt').lean(),
                AgentHistoryGeoAzyk.find({createdAt: {$gte: dateStart, $lt: dateEnd}, agent: {$in: agents}})
                    .select('agent').lean()
            ])
            let data = {}
            for(const invoice of invoices) {
                const ID = invoice.agent._id.toString()
                if(!data[ID]) {
                    data[ID] = {
                        _id: invoice.agent._id,
                        name: invoice.agent.name,
                        start: '-',
                        end: '-',
                        orders: 0,
                        attendance: 0
                   }
               }
                if(data[ID].start==='-')
                    data[ID].start = pdHHMM(invoice.createdAt)
                data[ID].end = pdHHMM(invoice.createdAt)
                data[ID].orders++
           }
            for(const agentHistoryGeoAzyk of agentHistoryGeoAzyks) {
                const ID = agentHistoryGeoAzyk.agent.toString()
                data[ID].attendance++
           }
            data = Object.values(data)
            for(let i = 0; i < data.length; i++) {
                data[i] = {
                    _id: data[i]._id,
                    data: [
                        data[i].name,
                        data[i].start,
                        data[i].end,
                        data[i].orders,
                        data[i].attendance

                    ]
               }

           }
            data = data.sort((a, b) => b.data[3] - a.data[3])
            return {
                columns: ['агент', 'начало', 'конец', 'заказов', 'посещений'],
                row: data
           };
       }
   },
    statisticMerchandising: async (parent, {type, dateStart, dateEnd, organization, agent}, {user}) => {
        // Проверка прав доступа
        if (![roleList.admin, roleList.superOrganization, roleList.organization, 'менеджер'].includes(user.role)) return

        if(user.organization) organization= user.organization

        // Установка дуиапазона дат
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

        // Если передан конкретный агент — возвращаем детальный список клиентов по нему
        if (agent) {
            // Получаем всех клиентов, закреплённых за агентом
            const districtsClients = await DistrictAzyk.find({organization, agent}).distinct('client').lean()
            // Получаем все мерчендайзинговые визиты по этим клиентам в заданный период
            const merchandisings = await MerchandisingAzyk.find({
                createdAt: {$gte: dateStart, $lt: dateEnd},
                ...(type ? {type} : {}),
                organization,
                client: {$in: districtsClients}
           }).select('_id client type createdAt').populate({
                path: 'client',
                select: 'name _id'
           }).sort('-createdAt').lean()
            // Формируем множество использованных клиентов и итоговый массив данных
            // eslint-disable-next-line no-undef
            const usedClients = []
            const dataOut = []
            for(const merchandising of merchandisings) {
                const _id = merchandising.client._id.toString()
                usedClients.push(_id)
                // Удаляем клиента из списка необслуженных
                const index = districtsClients.indexOf(_id)
                if (index !== -1) districtsClients.splice(index, 1)
                dataOut.push({
                    _id: merchandising._id,
                    data: [
                        merchandising.client.name,
                        pdDDMMYYYY(merchandising.createdAt),
                        merchandising.type
                    ]
               })
           }

            // Подсчёт общего числа обслуженных и необслуженных клиентов
            const allMerch = usedClients.length
            const allMiss = districtsClients.length

            // Сортировка по дате
            dataOut.sort((a, b) => b.data[1].localeCompare(a.data[1]))
            // Вставка общей сводной строки в начало
            dataOut.unshift({
                _id: 'All',
                data: [
                    allMerch,
                    allMiss
                ]
           })
            return {
                columns: ['клиент', 'дата', 'тип'],
                row: dataOut
           }
       }

        const districts = await DistrictAzyk.find({
            organization,
            ...(user.role === 'менеджер' ? {manager: user._id} : {})
       }).select('_id name client agent').populate({
            path: 'agent',
            select: 'name _id'
       }).lean()

        const data = await MerchandisingAzyk.find({
            createdAt: {$gte: dateStart, $lt: dateEnd},
            organization,
            ...(type ? {type} : {})
       }).select('client type check').lean()

        // eslint-disable-next-line no-undef
        const clientToDistrict = {}
        for(const district of districts) {
            for(const client of district.client) {
                clientToDistrict[client.toString()] = district
           }
       }

        for(let i = 0; i < data.length; i++) {
            const district = clientToDistrict[data[i].client.toString()]
            data[i].district = district || {_id: 'lol', agent: {name: 'Без района'}}
       }

        const statistic = {}
        for(let i = 0; i < data.length; i++) {
            if (user.role !== 'менеджер' || data[i].district._id !== 'lol') {
                const _id = data[i].district._id
                if (!statistic[_id]) statistic[_id] = {
                    name: data[i].district.agent ? data[i].district.agent.name : 'Не найден',
                    check: 0,
                    processing: 0
               }
                if (data[i].check) statistic[_id].check += 1
                else statistic[_id].processing += 1
           }
       }

        const keys = Object.keys(statistic)
        const dataOut = []
        let allCheck = 0
        let allProcessing = 0
        for(const key of keys) {
            allCheck += statistic[key].check
            allProcessing += statistic[key].processing
            dataOut.push({
                _id: key,
                data: [
                    statistic[key].name,
                    statistic[key].check + statistic[key].processing,
                    statistic[key].check,
                    statistic[key].processing
                ]
           })
       }

        dataOut.sort((a, b) => b.data[1] - a.data[1])
        dataOut.unshift({
            _id: 'All',
            data: [
                allCheck + allProcessing,
                allCheck,
                allProcessing
            ]
       })

        return {
            columns: ['агент', 'всего', 'проверено', 'обработка'],
            row: dataOut
       }
   }
};

module.exports.query = query;
module.exports.resolvers = resolvers;