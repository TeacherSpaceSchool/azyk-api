const ClientWithoutAds = require('../models/clientWithoutAdsAzyk');
const ClientWithoutAdsAzyk = require('../models/clientWithoutAdsAzyk');

const type = `
  type ClientWithoutAds {
    _id: ID
    createdAt: Date
    client: Client
    organization: Organization
  }
`;

const query = `
    clientsWithoutAds(organization: ID): [ID]
`;

const mutation = `
    setClientWithoutAds(client: ID!, organization: ID!): String
`;

const resolvers = {
    clientsWithoutAds: async(parent, {organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            return ClientWithoutAds
                .find({organization: user.organization||organization})
                .distinct('client')
       }
   }
};

const resolversMutation = {
    setClientWithoutAds: async(parent, {client, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            if(!await ClientWithoutAdsAzyk.findOne({client, organization: user.organization||organization}).select('_id').lean())
                await ClientWithoutAdsAzyk.create({client, organization})
            else
                await ClientWithoutAdsAzyk.deleteOne({client, organization})
            return 'OK'
        }
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;