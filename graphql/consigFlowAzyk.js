const ConsigFlowAzyk = require('../models/consigFlowAzyk');
const {defaultLimit, checkDate, dayStartDefault, unawaited, getClientTitle, checkFloat} = require('../module/const');
const DistrictAzyk = require('../models/districtAzyk');
const ClientAzyk = require('../models/clientAzyk');
const {addHistory, historyTypes} = require('../module/history');

const type = `
  type ConsigFlow {
    _id: ID
    organization: Organization
    invoice: Invoice
    client: Client
    amount: Float
    cancel: Boolean
    sign: Int
 }
`;

const query = `
    consigFlows(skip: Int!, client: ID, district: ID, invoice: ID, organization: ID!): [ConsigFlow]
    consigFlowStatistic(date: Date!, district: ID, organization: ID!): [[String]]
`;

const mutation = `
    addConsigFlow(client: ID!, sign: Int!, amount: Float!): ConsigFlow
    setConsigFlow(_id: ID!, cancel: Boolean!): String
`;

const resolvers = {
    consigFlows: async(parent, {skip, client, district, invoice, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'admin', 'менеджер', 'агент'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const districtClients = await district?DistrictAzyk.findById(district).distinct('client'):['агент', 'менеджер'].includes(user.role)?DistrictAzyk.find({$or: [{manager: user.employment}, {agent: user.employment}]}).distinct('client'):null;
            return await ConsigFlowAzyk.find({
                organization: user.organization||organization,
                ...client?{client}:districtClients?{client: {$in: districtClients}}:{},
                ...invoice?{invoice}:{}
            })
                .populate({
                    path: 'client',
                    select: 'name _id address'
                })
                .populate({
                    path: 'invoice',
                    select: '_id number'
                })
                .sort('-createdAt')
                .skip(skip)
                .limit(defaultLimit)
                .lean()
        }
    },
    consigFlowStatistic: async(parent, {date, district, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'admin', 'менеджер', 'агент'].includes(user.role)) {
            //дата
            const dateStart = checkDate(date)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            dateStart.setDate(1)
            const dateEnd = new Date(dateStart)
            dateEnd.setMonth(dateEnd.getMonth() + 1)
            //район
            const districtClients = await district||['агент', 'менеджер'].includes(user.role)?DistrictAzyk.find(district?{_id: district}:{$or: [{manager: user.employment}, {agent: user.employment}]}).distinct('client'):null;
            //консигнации
            const consigFlows = await ConsigFlowAzyk.find({
                organization: user.organization||organization,
                createdAt: {$lte: dateEnd},
                ...districtClients?{client: {$in: districtClients}}:{}
            })
                .sort('createdAt')
                .lean()
            //перебор
            if(consigFlows.length) {
                //клиенты
                const clients = await ClientAzyk.find({_id: {$in: consigFlows.map(consigFlow => consigFlow._id)}}).select('name _id address').lean()
                const clientById = {}
                for (const client of clients)
                    clientById[client._id] = getClientTitle(client)
                //сортировка консигнаций
                let sortedConsigFlow = {}
                //суммирование консигнаций
                for (const consigFlow of consigFlows) {
                    const {client, createdAt, amount, sign} = consigFlow
                    if (!sortedConsigFlow[consigFlow.client])
                        sortedConsigFlow[consigFlow.client] = {
                            client,
                            startOfMonth: 0,
                            takenInMonth: 0,
                            paidInMonth: 0,
                            endOfMonth: 0
                        }
                    //startOfMonth
                    if(createdAt<=dateStart) {
                        sortedConsigFlow[client].startOfMonth = checkFloat(sortedConsigFlow[client].startOfMonth + (amount * sign))
                    }
                    //takenInMonth paidInMonth
                    else {
                        const field = sign===1?'takenInMonth':'paidInMonth'
                        sortedConsigFlow[client][field] = checkFloat(sortedConsigFlow[client][field] + amount)
                    }
                }
                //подсчет на конец
                sortedConsigFlow = Object.values(sortedConsigFlow)
                for(let i=0; i<sortedConsigFlow.length; i++) {
                    sortedConsigFlow[i] = {
                        ...sortedConsigFlow[i],
                        client: clientById[sortedConsigFlow[i].client],
                        endOfMonth: checkFloat(sortedConsigFlow[i].startOfMonth + sortedConsigFlow[i].takenInMonth - sortedConsigFlow[i].paidInMonth)
                    }
                }
                //сортировка
                sortedConsigFlow = sortedConsigFlow.sort((a, b) => b.endOfMonth - a.endOfMonth)
                //результат
                return sortedConsigFlow
            } else return []
        }
    }
};

const resolversMutation = {
    addConsigFlow: async(parent, {client, sign, amount}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [createdObject, clientData] = await Promise.all([
                ConsigFlowAzyk.create({organization: user.organization, operator: user.employment, client, amount, sign}),
                ClientAzyk.findById(client).select('_id name address').lean()
            ]);
            unawaited(() => addHistory({user, type: historyTypes.create, model: 'ConsigFlowAzyk', name: clientData.name, object: createdObject._id}))
            return {...createdObject.toObject(), client: clientData}
        }
    },
    setConsigFlow: async(parent, {_id, cancel}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент'].includes(user.role)) {
            let object = await ConsigFlowAzyk.findOne({_id, invoice: null}).populate({path: 'client', select: 'name _id address'})
            if(object) {
                unawaited(() => addHistory({user, type: historyTypes.set, model: 'ConsigFlowAzyk', name: object.client.name, object: _id, data: {cancel}}))
                object.cancel = cancel
                await object.save();
                return 'OK'
            }
        }
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;