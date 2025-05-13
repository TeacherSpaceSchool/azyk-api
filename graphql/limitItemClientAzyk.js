const LimitItemClient = require('../models/limitItemClientAzyk');
const Item = require('../models/itemAzyk');
const Client = require('../models/clientAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');

const type = `
  type LimitItemClient {
    _id: ID
    createdAt: Date
    client: Client
    limit: Int
    organization: Organization
    item: Item
  }
`;

const query = `
    limitItemClients(client: ID!, organization: ID): [LimitItemClient]
    itemsForLimitItemClients(client: ID!, organization: ID): [Item]
`;

const mutation = `
    addLimitItemClient(client: ID!, organization: ID!, limit: Int!, item: ID!): LimitItemClient
    setLimitItemClient(_id: ID!, limit: Int!): Data
    deleteLimitItemClient(_id: ID!): Data
`;

const resolvers = {
    limitItemClients: async(parent, {client, organization}, {user}) => {
        if(user.role) {
            if(organization) {
                let subBrand = await SubBrandAzyk.findOne({_id: organization}).select('organization').lean()
                if(subBrand){
                    organization = subBrand.organization
                }
            }
            return await LimitItemClient
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
    itemsForLimitItemClients: async(parent, {client, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            let excludedItems = await LimitItemClient.find({
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
    addLimitItemClient: async(parent, {client, organization, limit, item}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)&&!(await LimitItemClient.findOne({item, client}).select('_id').lean())) {
            let _object = new LimitItemClient({
                item,
                limit,
                client,
                organization
            });
            _object = await LimitItemClient.create(_object)
            return await LimitItemClient
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
    setLimitItemClient: async(parent, {_id, limit}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)){
            let object = await LimitItemClient.findById(_id)
            object.limit = limit
            await object.save();
        }
        return {data: 'OK'};
    },
    deleteLimitItemClient: async(parent, { _id }, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)){
            await LimitItemClient.deleteOne({_id})
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;