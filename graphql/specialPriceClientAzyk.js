const SpecialPriceClient = require('../models/specialPriceClientAzyk');
const Item = require('../models/itemAzyk');
const Client = require('../models/clientAzyk');

const type = `
  type SpecialPriceClient {
    _id: ID
    createdAt: Date
    client: Client
    price: Float
    organization: Organization
    item: Item
  }
`;

const query = `
    specialPriceClients(client: ID!, organization: ID): [SpecialPriceClient]
    itemsForSpecialPriceClients(client: ID!, organization: ID): [Item]
`;

const mutation = `
    addSpecialPriceClient(client: ID!, organization: ID!, price: Float!, item: ID!): SpecialPriceClient
    setSpecialPriceClient(_id: ID!, price: Float!): Data
    deleteSpecialPriceClient(_id: ID!): Data
`;

const resolvers = {
    specialPriceClients: async(parent, {client, organization}, {user}) => {
        if(user.role) {
            return await SpecialPriceClient
                .find({
                    client,
                    organization: user.organization?user.organization:organization
                })
                .populate({
                    path: 'organization',
                    select: '_id name'
                })
                .populate({
                    path: 'item',
                    select: '_id name'
                })
                .populate({
                    path: 'client',
                    select: '_id name address'
                })
                .lean()
        }
    },
    itemsForSpecialPriceClients: async(parent, {client, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            let excludedItems = await SpecialPriceClient.find({
                client,
                organization: user.organization?user.organization:organization
            })
                .distinct('item')
                .lean()
            let city = (await Client.findOne({_id: client}).select('city').lean()).city

            return await Item.find({_id: {$nin: excludedItems}, organization: user.organization?user.organization:organization, city})
                .select('_id name')
                .lean()
        }
    },
};

const resolversMutation = {
    addSpecialPriceClient: async(parent, {client, organization, price, item}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)&&!(await SpecialPriceClient.findOne({item, client}).select('_id').lean())) {
            let _object = new SpecialPriceClient({
                item,
                price,
                client,
                organization
            });
            _object = await SpecialPriceClient.create(_object)
            return await SpecialPriceClient
                .findById(_object._id)
                .populate({
                    path: 'organization',
                    select: '_id name'
                })
                .populate({
                    path: 'item',
                    select: '_id name'
                })
                .populate({
                    path: 'client',
                    select: '_id name address'
                })
                .lean()
        }
    },
    setSpecialPriceClient: async(parent, {_id, price}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)){
            let object = await SpecialPriceClient.findById(_id)
            object.price = price
            await object.save();
        }
        return {data: 'OK'};
    },
    deleteSpecialPriceClient: async(parent, { _id }, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)){
            await SpecialPriceClient.deleteOne({_id})
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;