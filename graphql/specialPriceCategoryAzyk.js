const SpecialPriceCategory = require('../models/specialPriceCategoryAzyk');
const Item = require('../models/itemAzyk');
const Category = require('../models/categoryAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const ClientAzyk = require('../models/clientAzyk');

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
    setSpecialPriceCategory(_id: ID!, price: Float!): Data
    deleteSpecialPriceCategory(_id: ID!): Data
`;

const resolvers = {
    specialPriceCategories: async(parent, {category, client, organization}, {user}) => {
        if(user.role&&(category||client)) {
            if(organization) {
                let subBrand = await SubBrandAzyk.findOne({_id: organization}).select('organization').lean()
                if(subBrand) {
                    organization = subBrand.organization
                }
            }
            if(client) {
                client = await ClientAzyk.findById(client).select('category').lean();
                if(client) {
                    category = client.category
                }
            }
            return await SpecialPriceCategory
                .find({
                    category: user.role==='client'?user.category:category,
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
                .lean()
        }
    },
    itemsForSpecialPriceCategories: async(parent, {category, organization}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'агент', 'admin'].includes(user.role)) {
            let excludedItems = await SpecialPriceCategory.find({
                category,
                organization: user.organization?user.organization:organization
            })
                .distinct('item')
                .lean()

            return await Item.find({_id: {$nin: excludedItems}, organization: user.organization?user.organization:organization})
                .select('_id name')
                .lean()
        }
    },
};

const resolversMutation = {
    addSpecialPriceCategory: async(parent, {category, organization, price, item}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)&&!(await SpecialPriceCategory.findOne({item, category}).select('_id').lean())) {
            let _object = new SpecialPriceCategory({
                item,
                price,
                category,
                organization
            });
            _object = await SpecialPriceCategory.create(_object)
            return await SpecialPriceCategory
                .findById(_object._id)
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
    setSpecialPriceCategory: async(parent, {_id, price}, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)){
            let object = await SpecialPriceCategory.findById(_id)
            object.price = price
            await object.save();
        }
        return {data: 'OK'};
    },
    deleteSpecialPriceCategory: async(parent, { _id }, {user}) => {
        if(['суперорганизация', 'организация', 'менеджер', 'admin'].includes(user.role)){
            await SpecialPriceCategory.deleteOne({_id})
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;