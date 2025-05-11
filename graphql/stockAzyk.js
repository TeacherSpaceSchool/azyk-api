const StockAzyk = require('../models/stockAzyk');
const {reductionSearch} = require('../module/const');
const ItemAzyk = require('../models/itemAzyk');
const Item = require('../models/itemAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');

const type = `
  type Stock {
    _id: ID
    createdAt: Date
    item: Item
    organization: Organization
    count: Float
  }
`;

const query = `
    itemsForStocks(organization: ID!): [Item]
    stocks(search: String!, organization: ID!): [Stock]
`;

const mutation = `
    addStock(item: ID!, organization: ID!, count: Float!): Stock
    setStock(_id: ID!, count: Float!): Data
    deleteStock(_id: ID!): Data
`;

const resolvers = {
    itemsForStocks: async(parent, {organization}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)){
            let excludedItems = await StockAzyk.find({
                organization: user.organization?user.organization:organization
            })
                .distinct('item')
                .lean()
            return await Item.find({
                _id: {$nin: excludedItems},
                organization: user.organization?user.organization:organization
            })
                .select('_id name')
                .lean()
        }
    },
    stocks: async(parent, {organization, search}, {user}) => {
        if(user.role) {
            let subBrand = await SubBrandAzyk.findOne({_id: organization}).select('organization _id').lean()
            if(subBrand){
                organization = subBrand.organization
            }
            let searchedItems;
            if (search) {
                searchedItems = await ItemAzyk.find({
                    name: {'$regex': reductionSearch(search), '$options': 'i'}
                }).distinct('_id').lean()
            }
            return await StockAzyk.find({
                organization: user.organization ? user.organization : organization,
                ...searchedItems ? {item: {$in: searchedItems}} : {}
            })
                .sort('-createdAt')
                .populate({
                    path: 'item',
                    select: '_id name'
                })
                .lean()
        }
    }
};

const resolversMutation = {
    addStock: async(parent, {item, organization, count}, {user}) => {
        if(
            ['admin', 'суперорганизация', 'организация'].includes(user.role)&&
            !(await StockAzyk.countDocuments({item, organization}).lean())
        ){
            let _object = new StockAzyk({item, count, organization: user.organization?user.organization:organization});
            _object = await StockAzyk.create(_object)
            _object.item = await ItemAzyk.findById(item).select('_id name')
            return _object
        }
    },
    setStock: async(parent, {_id, count}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)){
            let object = await StockAzyk.findById(_id)
            object.count = count
            await object.save();
        }
        return {data: 'OK'}
    },
    deleteStock: async(parent, { _id }, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)){
            await StockAzyk.deleteOne({_id})
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;