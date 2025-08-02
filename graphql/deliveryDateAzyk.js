const DeliveryDate = require('../models/deliveryDateAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const {parallelBulkWrite} = require('../module/parallel');

const type = `
  type DeliveryDate {
    _id: ID
    createdAt: Date
    client: ID
    days: [Boolean]
    organization: ID
    priority: Int
 }
`;

const query = `
    deliveryDates(clients: [ID]!, organization: ID!): [DeliveryDate]
    deliveryDate(client: ID!, organization: ID!): DeliveryDate
`;

const mutation = `
    setDeliveryDates(clients: [ID]!, organization: ID!, days: [Boolean]!, priority: Int!): String
`;

const resolvers = {
    deliveryDates: async(parent, {clients, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            return await DeliveryDate.find({
                client: {$in: clients},
                organization:user.organization?user.organization: organization==='super'?null:organization
            }).sort('-createdAt').lean()
       }
   },
    deliveryDate: async(parent, {client, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin', 'client'].includes(user.role)) {
            if(user.organization)
                organization = user.organization
            else {
                let subbrand = await SubBrandAzyk.findById(organization).select('organization').lean()
                if(subbrand)
                    organization = subbrand.organization
           }
            return await DeliveryDate.findOne({client, organization}).sort('-createdAt').lean()
       }
   }
};

const resolversMutation = {
    setDeliveryDates: async(parent, {clients, organization, days, priority}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            organization = user.organization||(organization === 'super'?null:organization)
            // Получаем список существующих клиентов DeliveryDate
            let existingClients = await DeliveryDate.find({client: {$in: clients}, organization}).distinct('client').lean()
            existingClients = existingClients.map(client => client.toString())
            // Если такие клиенты уже есть — обновляем их DeliveryDate
            await DeliveryDate.updateMany({client: {$in: existingClients}, organization}, {days, priority})
            // Если таких клиентов нет — создаем их DeliveryDate
            clients = clients.filter(client => !existingClients.includes(client.toString()))
            if(clients.length)
                await parallelBulkWrite(DeliveryDate, clients.map(client => ({insertOne: {document: {days, priority, client, organization}}})))
            return 'OK';
        }
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;