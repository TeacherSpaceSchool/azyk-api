const AgentHistoryGeoAzyk = require('../models/agentHistoryGeoAzyk');
const InvoiceAzyk = require('../models/invoiceAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const UserAzyk = require('../models/userAzyk');
const {getGeoDistance, pdDDMMYYHHMM, checkDate, dayStartDefault} = require('../module/const');
const {parallelPromise} = require('../module/parallel');

const type = `
  type AgentHistoryGeo {
    _id: ID
    createdAt: Date
    geo: String
    client: Client
    agent: Employment
 }
`;

const query = `
    agentHistoryGeos(organization: ID, agent: ID, date: String): Statistic
    agentMapGeos(agent: ID!, date: String): [[String]]
`;

const mutation = `
    addAgentHistoryGeo(client: ID!, geo: String!): String
`;

const resolvers = {
    agentHistoryGeos: async(parent, {organization, agent, date}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            if(user.organization) organization = user.organization
            // Устанавливаем дату начала и конца (день с 3:00)
            let dateStart = checkDate(date)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            let dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            let data = []
            let agents = []
            // Если агент не указан, получаем список агентов по организации
            if (!agent) {
                if (organization !== 'super')
                    agents = await EmploymentAzyk.find({organization}).distinct('_id')
                else {
                    agents = await UserAzyk.find({role: 'суперагент'}).distinct('_id')
                    agents = await EmploymentAzyk.find({user: {$in: agents}}).distinct('_id')
               }
           }
            // Получаем историю гео-локаций агентов за день с учетом фильтра по агенту
            let agentHistoryGeos = await AgentHistoryGeoAzyk.find({
                createdAt: {$gte: dateStart, $lt: dateEnd},
                ...(agent ? {agent} : {agent: {$in: agents}})
           })
                .select('agent client _id createdAt geo')
                .populate({
                    path: 'client',
                    select: '_id name address'
               })
                .populate({
                    path: 'agent',
                    select: '_id name'
               })
                .sort('-createdAt')
                .lean()
            if (!agent) {
                let dataKey = {}
                await parallelPromise(agentHistoryGeos, async agentHistoryGeo => {
                    const agentId = agentHistoryGeo.agent._id.toString()
                    if (!dataKey[agentId])
                        dataKey[agentId] = {
                            _id: agentId,
                            count: 0,
                            name: agentHistoryGeo.agent.name,
                            cancel: 0,
                            order: 0
                       }
                    dataKey[agentId].count += 1
                    if (await InvoiceAzyk.findOne({
                        createdAt: {$gte: dateStart, $lt: dateEnd},
                        client: agentHistoryGeo.client._id,
                        del: {$ne: 'deleted'},
                        taken: true
                   }).select('_id').lean())
                        dataKey[agentId].order += 1
                    else
                        dataKey[agentId].cancel += 1
               })
                const keys = Object.keys(dataKey)
                for(const key of keys) {
                    data.push({
                        _id: dataKey[key]._id,
                        data: [
                            dataKey[key].name,
                            dataKey[key].count,
                            dataKey[key].order,
                            dataKey[key].cancel,
                        ]
                   })
               }
                return {
                    columns: ['агент', 'посещений', 'заказов', 'отказов'],
                    row: data
               };
           }
            else {
                await parallelPromise(agentHistoryGeos, async agentHistoryGeo => {
                    data.push({
                        _id: agentHistoryGeo._id,
                        data: [
                            pdDDMMYYHHMM(agentHistoryGeo.createdAt),
                            `${agentHistoryGeo.client.name}${agentHistoryGeo.client.address && agentHistoryGeo.client.address[0] ? ` (${agentHistoryGeo.client.address[0][2] ? `${agentHistoryGeo.client.address[0][2]}, ` : ''}${agentHistoryGeo.client.address[0][0]})` : ''}`,
                            agentHistoryGeo.client.address[0][1] ? `${getGeoDistance(...(agentHistoryGeo.geo.split(', ')), ...(agentHistoryGeo.client.address[0][1].split(', ')))} м` : '-',
                            agentHistoryGeo.agent.name,
                            await InvoiceAzyk.findOne({
                                createdAt: {$gte: dateStart, $lt: dateEnd},
                                client: agentHistoryGeo.client._id,
                                del: {$ne: 'deleted'},
                                taken: true
                           })
                                .select('_id')
                                .sort('-createdAt')
                                .lean() ? 'заказ' : 'отказ'
                        ]
                   })

               })
                return {
                    columns: ['дата', 'клиент', 'растояние', 'агент', 'статус'],
                    row: data
               };
           }
       }
   },
    agentMapGeos: async(parent, {agent, date}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            let dateStart = checkDate(date)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            let dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            let data = []
            let take
            let agentHistoryGeos = await AgentHistoryGeoAzyk.find({
                createdAt: {$gte: dateStart, $lt: dateEnd},
                agent
           })
                .select('agent client _id createdAt geo')
                .populate({
                    path: 'client',
                    select: '_id name address'
               })
                .populate({
                    path: 'agent',
                    select: '_id name'
               })
                .sort('-createdAt')
                .lean()
            await parallelPromise(agentHistoryGeos, async agentHistoryGeo => {
                take = await InvoiceAzyk.findOne({
                    createdAt: {$gte: dateStart, $lt: dateEnd},
                    client: agentHistoryGeo.client._id,
                    del: {$ne: 'deleted'},
                    taken: true
               })
                    .select('_id')
                    .sort('-createdAt')
                    .lean()
                if(take&&agentHistoryGeo.client.address[0][1]) {
                    data.push([
                        `агент ${agentHistoryGeo.client.name}${agentHistoryGeo.client.address&&agentHistoryGeo.client.address[0]?` (${agentHistoryGeo.client.address[0][2] ? `${agentHistoryGeo.client.address[0][2]}, ` : ''}${agentHistoryGeo.client.address[0][0]})` : ''}`,
                        agentHistoryGeo.geo,
                        '#FFFF00'
                    ])
                    data.push([
                        `${agentHistoryGeo.client.name}${agentHistoryGeo.client.address&&agentHistoryGeo.client.address[0]?` (${agentHistoryGeo.client.address[0][2] ? `${agentHistoryGeo.client.address[0][2]}, ` : ''}${agentHistoryGeo.client.address[0][0]})` : ''}`,
                        agentHistoryGeo.client.address[0][1],
                        '#4b0082'
                    ])
               }
           })
            return data
       }
   },
};

const resolversMutation = {
    addAgentHistoryGeo: async(parent, {client, geo}, {user}) => {
        if(['агент', 'суперагент'].includes(user.role)) {
            let dateStart = new Date()
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            let dateEnd = new Date(dateStart)
            dateEnd.setDate(dateEnd.getDate() + 1)
            let agentHistoryGeo = await AgentHistoryGeoAzyk.findOne({
                createdAt: {$gte: dateStart, $lt: dateEnd},
                client, agent: user.employment
            })
                .select('_id')
                .lean()
            if(!agentHistoryGeo) {
                await AgentHistoryGeoAzyk.create({
                    agent: user.employment,
                    client: client,
                    geo: geo
                })
            }
            return 'OK';
        }
   },
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;