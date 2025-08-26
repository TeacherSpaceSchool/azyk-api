const DeliveryDate = require('../models/deliveryDateAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');

const type = `
  type DeliveryDate {
    _id: ID
    createdAt: Date
    days: [Boolean]
    organization: ID
    
    client: ID
    priority: Int
 }
`;

const query = `
    deliveryDate(organization: ID!): DeliveryDate
`;

const mutation = `
    setDeliveryDate(organization: ID!, days: [Boolean]!): String
`;

const resolvers = {
    deliveryDate: async(parent, {organization}, {user}) => {
        if(user.role) {
            if(user.organization)
                organization = user.organization
            else {
                let subbrand = await SubBrandAzyk.findById(organization).select('organization').lean()
                if(subbrand)
                    organization = subbrand.organization
            }
            return await DeliveryDate.findOne({organization}).sort('-createdAt').lean()
        }
    }
};

const resolversMutation = {
    setDeliveryDate: async(parent, {organization, days}, {user}) => {
        if(['суперорганизация', 'организация', 'admin'].includes(user.role)) {
            if(user.organization) organization = user.organization
            const deliveryDate = await DeliveryDate.findOne({organization})
            if(!deliveryDate) {
                await DeliveryDate.create({organization, days});
            }
            else {
                deliveryDate.days = days
                deliveryDate.markModified('days');
                await deliveryDate.save()
            }
            return 'OK';
        }
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;