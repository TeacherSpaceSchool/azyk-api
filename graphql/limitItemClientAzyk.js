const LimitItemClientAzyk = require('../models/limitItemClientAzyk');
const ClientAzyk = require('../models/clientAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const ItemAzyk = require('../models/itemAzyk');
const {roleList} = require('../module/enum');

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
    setLimitItemClient(_id: ID!, limit: Int!): String
    deleteLimitItemClient(_id: ID!): String
`;

const resolvers = {
    limitItemClients: async(parent, {client, organization}, {user}) => {
        if(user.role) {
            if(user.role===roleList.client) client = user.client
            if(organization) {
                let subBrand = await SubBrandAzyk.findById(organization).select('organization').lean()
                if(subBrand) {
                    organization = subBrand.organization
               }
           }
            return await LimitItemClientAzyk
                .find({
                    client,
                    organization: user.organization||organization
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
        if([roleList.superOrganization, roleList.organization, roleList.manager, roleList.agent, roleList.admin].includes(user.role)) {
            // eslint-disable-next-line no-undef
            const [excludedItems, clientCity] = await Promise.all([
                LimitItemClientAzyk.find({
                    client, organization: user.organization||organization
               }).distinct('item'),
                ClientAzyk.findById(client).select('city').lean()
            ])
            let city = clientCity.city
            return await ItemAzyk.find({_id: {$nin: excludedItems}, organization: user.organization||organization, city})
                .select('_id name')
                .lean()
       }
   },
};

const resolversMutation = {
    addLimitItemClient: async(parent, {client, organization, limit, item}, {user}) => {
        if([roleList.superOrganization, roleList.organization, roleList.manager, roleList.admin, roleList.agent].includes(user.role)&&!(await LimitItemClientAzyk.findOne({item, client}).select('_id').lean())) {
            // eslint-disable-next-line no-undef
            const [createdObject, itemData, clientData] = await Promise.all([
                LimitItemClientAzyk.create({item, limit, client, organization}),
                ItemAzyk.findById(item).select('_id name').lean(),
                ClientAzyk.findById(client).select('_id name address').lean(),
            ]);
            return {...createdObject.toObject(), item: itemData, client: clientData}
       }
   },
    setLimitItemClient: async(parent, {_id, limit}, {user}) => {
        if([roleList.superOrganization, roleList.organization, roleList.manager, roleList.admin, roleList.agent].includes(user.role)) {
            let object = await LimitItemClientAzyk.findById(_id)
            object.limit = limit
            await object.save();
       }
        return 'OK';
   },
    deleteLimitItemClient: async(parent, {_id}, {user}) => {
        if([roleList.superOrganization, roleList.organization, roleList.manager, roleList.admin, roleList.agent].includes(user.role)) {
            await LimitItemClientAzyk.deleteOne({_id})
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;