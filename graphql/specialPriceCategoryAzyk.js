const SpecialPriceCategory = require('../models/specialPriceCategoryAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const ClientAzyk = require('../models/clientAzyk');
const {checkFloat} = require('../module/const');

const type = `
  type SpecialPriceCategory {
    _id: ID
    createdAt: Date
    category: String
    price: Float
    organization: Organization
    item: Item
 }
`;

const query = `
    specialPriceCategories(category: String, client: ID, organization: ID): [SpecialPriceCategory]
    itemsForSpecialPriceCategories(category: String!, organization: ID): [Item]
`;

const mutation = `
    setSpecialPriceCategory(category: String!, organization: ID!, price: String, item: ID!): String
`;

const resolvers = {
    specialPriceCategories: async(parent, {category, client, organization}, {user}) => {
        if(user.role&&(category||client)) {

            if(user.role==='client') client = user.client

            // eslint-disable-next-line no-undef
            const [subBrand, clientData] = await Promise.all([
                organization?SubBrandAzyk.findById(organization).select('organization').lean():null,
                client?ClientAzyk.findById(client).select('category').lean():null
            ])

            if(subBrand) {
                organization = subBrand.organization
           }
            if(clientData) {
                category = clientData.category
           }

            return await SpecialPriceCategory
                .find({
                    category,
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
                .lean()
       }
   }
};

const resolversMutation = {
    setSpecialPriceCategory: async(parent, {category, organization, price, item}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)) {
            if(price&&price.length) {
                if(await SpecialPriceCategory.findOne({category, organization, item}).select('_id').lean())
                    await SpecialPriceCategory.updateOne({item, category, organization}, {price: checkFloat(price)})
                else
                    await SpecialPriceCategory.create({item, price: checkFloat(price), category, organization})
            }
            else
                await SpecialPriceCategory.deleteOne({category, organization, item})

        }
        return 'OK';
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;