const SpecialPriceClient = require('../models/specialPriceClientAzyk');
const Item = require('../models/itemAzyk');
const Client = require('../models/clientAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const ItemAzyk = require('../models/itemAzyk');
const ClientAzyk = require('../models/clientAzyk');

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
    setSpecialPriceClient(_id: ID!, price: Float!): String
    deleteSpecialPriceClient(_id: ID!): String
`;

const resolvers = {
    specialPriceClients: async(parent, {client, organization}, {user}) => {
        if(user.role) {
            if(user.role==='client') client = user.client
            if(organization) {
                let subBrand = await SubBrandAzyk.findById(organization).select('organization').lean()
                if(subBrand) {
                    organization = subBrand.organization
               }
           }
            return SpecialPriceClient
                .find({
                    client, organization: user.organization||organization
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
            if(user.organization) organization = user.organization
            // eslint-disable-next-line no-undef
            let [excludedItems, city] = await Promise.all([
                SpecialPriceClient.find({client, organization}).distinct('item'),
                Client.findById(client).select('city').lean()
            ])
            city = city.city
            return Item.find({_id: {$nin: excludedItems}, organization: user.organization||organization, city}).select('_id name').lean()
       }
   },
};

const resolversMutation = {
    addSpecialPriceClient: async(parent, {client, organization, price, item}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin', 'агент'].includes(user.role)&&!(await SpecialPriceClient.findOne({item, client, organization: user.organization||organization}).select('_id').lean())) {
            // eslint-disable-next-line no-undef
            let [createdObject, organizationData, itemData, clientData] = await Promise.all([
                SpecialPriceClient.create({
                    item,
                    price,
                    client,
                    organization: user.organization||organization
               }),
                OrganizationAzyk.findById(organization).select('_id name').lean(),
                ItemAzyk.findById(item).select('_id name').lean(),
                ClientAzyk.findById(client).select('_id name address').lean(),

            ]);
            return {...createdObject.toObject(), organization: organizationData, item: itemData, client: clientData}
       }
   },
    setSpecialPriceClient: async(parent, {_id, price}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin', 'агент'].includes(user.role)) {
            await SpecialPriceClient.updateOne({_id}, {price})
       }
        return 'OK';
   },
    deleteSpecialPriceClient: async(parent, {_id}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin', 'агент'].includes(user.role)) {
            await SpecialPriceClient.deleteOne({_id})
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;