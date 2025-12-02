const SpecialPriceClient = require('../models/specialPriceClientAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const {checkFloat} = require('../module/const');

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
`;

const mutation = `
    setSpecialPriceClient(client: ID!, organization: ID!, price: String, item: ID!): String
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
   }
};

const resolversMutation = {
    setSpecialPriceClient: async(parent, {client, organization, price, item}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            if(price&&price.length) {
                if(await SpecialPriceClient.findOne({client, organization, item}).select('_id').lean())
                    await SpecialPriceClient.updateOne({item, client, organization}, {price: checkFloat(price)})
                else
                    await SpecialPriceClient.create({item, price: checkFloat(price), client, organization})
            }
            else
                await SpecialPriceClient.deleteOne({client, organization, item})
        }
        return 'OK';
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;