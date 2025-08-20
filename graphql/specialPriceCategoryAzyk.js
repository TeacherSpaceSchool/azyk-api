const SpecialPriceCategory = require('../models/specialPriceCategoryAzyk');
const Item = require('../models/itemAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const ClientAzyk = require('../models/clientAzyk');
const ItemAzyk = require('../models/itemAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const {roleList} = require('../module/enum');

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
    addSpecialPriceCategory(category: String!, organization: ID!, price: Float!, item: ID!): SpecialPriceCategory
    setSpecialPriceCategory(_id: ID!, price: Float!): String
    deleteSpecialPriceCategory(_id: ID!): String
`;

const resolvers = {
    specialPriceCategories: async(parent, {category, client, organization}, {user}) => {
        if(user.role&&(category||client)) {

            if(user.role===roleList.client) client = user.client

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
   },
    itemsForSpecialPriceCategories: async(parent, {category, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', roleList.admin].includes(user.role)) {
            let excludedItems = await SpecialPriceCategory.find({
                category,
                organization: user.organization||organization
           })
                .distinct('item')
                .lean()

            return await Item.find({_id: {$nin: excludedItems}, organization: user.organization||organization})
                .select('_id name')
                .lean()
       }
   },
};

const resolversMutation = {
    addSpecialPriceCategory: async(parent, {category, organization, price, item}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', roleList.admin, 'агент'].includes(user.role)&&!(await SpecialPriceCategory.findOne({item, category}).select('_id').lean())) {
            // eslint-disable-next-line no-undef
            const [createdObject, itemData, organizationData] = await Promise.all([
                SpecialPriceCategory.create({item, price, category, organization}),
                ItemAzyk.findById(item).select('_id name').lean(),
                OrganizationAzyk.findById(organization).select('_id name').lean()
            ]);
            return {...createdObject.toObject(), item: itemData, organization: organizationData}
       }
   },
    setSpecialPriceCategory: async(parent, {_id, price}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', roleList.admin, 'агент'].includes(user.role)) {
            await SpecialPriceCategory.updateOne({_id}, {price})
       }
        return 'OK';
   },
    deleteSpecialPriceCategory: async(parent, {_id}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', roleList.admin, 'агент'].includes(user.role)) {
            await SpecialPriceCategory.deleteOne({_id})
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;