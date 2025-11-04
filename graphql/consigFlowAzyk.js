const ConsigFlowAzyk = require('../models/consigFlowAzyk');
const {defaultLimit, checkDate, dayStartDefault, unawaited, getClientTitle, checkFloat, reductionSearchText} = require('../module/const');
const DistrictAzyk = require('../models/districtAzyk');
const ClientAzyk = require('../models/clientAzyk');
const {addHistory, historyTypes} = require('../module/history');

const type = `
  type ConsigFlow {
    _id: ID
    createdAt: Date
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
    consigFlowStatistic(date: Date!, search: String, district: ID, organization: ID!): [[String]]
`;

const mutation = `
    addConsigFlow(client: ID!, sign: Int!, amount: Float!): ConsigFlow
    setConsigFlow(_id: ID!, cancel: Boolean!): String
`;

const resolvers = {
    consigFlows: async(parent, {skip, client, district, invoice, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'admin', 'менеджер', 'агент'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const districtClients = district?await DistrictAzyk.findById(district).distinct('client'):['агент', 'менеджер'].includes(user.role)?await DistrictAzyk.find({$or: [{manager: user.employment}, {agent: user.employment}]}).distinct('client'):null;
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
    consigFlowStatistic: async(parent, {date, district, organization, search}, {user}) => {
        if(['суперорганизация', 'организация', 'admin', 'менеджер', 'агент'].includes(user.role)) {
            //дата
            const dateStart = checkDate(date)
            dateStart.setHours(dayStartDefault, 0, 0, 0)
            dateStart.setDate(1)
            const dateEnd = new Date(dateStart)
            dateEnd.setMonth(dateEnd.getMonth() + 1)
            //район и поиск клиентов
            // eslint-disable-next-line no-undef
            const [districtClients, searchedClients] = await Promise.all([
                district||['агент', 'менеджер'].includes(user.role)?DistrictAzyk.find(district?{_id: district}:{$or: [{manager: user.employment}, {agent: user.employment}]}).distinct('client'):null,
                search?ClientAzyk.find({$or: [
                        {name: {$regex: reductionSearchText(search), $options: 'i'}},
                        {info: {$regex: reductionSearchText(search), $options: 'i'}},
                        {address: {$elemMatch: {$elemMatch: {$regex: reductionSearchText(search), $options: 'i'}}}}
                    ]}).distinct('_id'):null
            ])
            //консигнации
            const consigFlows = await ConsigFlowAzyk.find({
                organization: user.organization||organization,
                createdAt: {$lte: dateEnd},
                cancel: {$ne: true},
                ...searchedClients||districtClients?{$and: [
                    ...searchedClients?[{client: {$in: searchedClients}}]:[],
                    ...districtClients?[{client: {$in: districtClients}}]:[]
                ]}:{}
            })
                .sort('createdAt')
                .lean()
            //перебор
            if(consigFlows.length) {
                //клиенты
                const clients = await ClientAzyk.find({_id: {$in: consigFlows.map(consigFlow => consigFlow.client)}}).select('name _id address').lean()
                const clientById = {}
                for (const client of clients)
                    clientById[client._id] = getClientTitle(client)
                //сортировка консигнаций
                let sortedConsigFlow = {}
                //суммирование консигнаций
                for (const consigFlow of consigFlows) {
                    const {client, createdAt, amount, sign} = consigFlow
                    if (!sortedConsigFlow[client])
                        sortedConsigFlow[client] = [
                            client,
                            clientById[client],
                            /*2 startOfMonth*/0,
                            /*3 takenInMonth*/0,
                            /*4 paidInMonth*/0,
                            /*5 endOfMonth*/0
                        ]
                    //startOfMonth
                    if(createdAt<=dateStart) {
                        sortedConsigFlow[client][2] = checkFloat(sortedConsigFlow[client][2] + (amount * sign))
                    }
                    //takenInMonth paidInMonth
                    else {
                        const field = sign===1?3:4
                        sortedConsigFlow[client][field] = checkFloat(sortedConsigFlow[client][field] + amount)
                    }
                }

                //возврат
                return Object.values(sortedConsigFlow)
                    //подсчет на конец
                    .map(consigFlow => {consigFlow[5]=checkFloat(consigFlow[2]+consigFlow[3]-consigFlow[4]); return consigFlow})
                    //убираем пустые
                    .filter(consigFlow => consigFlow[2]||consigFlow[3]||consigFlow[4])
                    //сортировка
                    .sort((a, b) => b[5] - a[5]);
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