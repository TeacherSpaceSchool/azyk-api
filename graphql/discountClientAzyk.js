const DiscountClient = require('../models/discountClientAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const {parallelBulkWrite} = require('../module/parallel');

const type = `
  type DiscountClient {
    _id: ID
    createdAt: Date
    client: ID
    discount: Int
    organization: ID
 }
`;

const query = `
    discountClients(clients: [ID]!, organization: ID!): [DiscountClient]
    discountClient(client: ID!, organization: ID!): DiscountClient
`;

const mutation = `
    setDiscountClients(clients: [ID]!, organization: ID!, discount: Int!): String
`;

const resolvers = {
    discountClients: async(parent, {clients, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            organization = user.organization||(organization==='super'?null:organization)
            return await DiscountClient.find({client: {$in: clients}, organization}).lean()
       }
   },
    discountClient: async(parent, {client, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin', 'client'].includes(user.role)) {
            if(user.client) client = user.client
            if(user.organization)
                organization = user.organization
            else {
                let subbrand = await SubBrandAzyk.findById(organization).select('organization').lean()
                if(subbrand)
                    organization = subbrand.organization
           }
            return await DiscountClient.findOne({client, organization}).lean()
       }
   }
};

const resolversMutation = {
    setDiscountClients: async(parent, {clients, organization, discount}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            organization = user.organization ? user.organization : organization==='super'?null:organization
            // Получаем клиентов DiscountClient
            let existingClients = await DiscountClient.find({client: {$in: clients}, organization}).distinct('client').lean()
            existingClients = existingClients.map(client => client.toString())
            // Если такие клиенты уже есть — обновляем их DiscountClient
            await DiscountClient.updateMany({client: {$in: existingClients}, organization}, {discount})
            // Если таких клиентов нет — создаем их DiscountClient
            clients = clients.filter(client => !existingClients.includes(client.toString()))
            if(clients.length)
                await parallelBulkWrite(DiscountClient, clients.map(client => ({insertOne: {document: {discount, client, organization}}})))
            return 'OK';
        }
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;