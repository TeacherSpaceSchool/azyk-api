const StockAzyk = require('../models/stockAzyk');
const {reductionSearchText, isNotEmpty} = require('../module/const');
const ItemAzyk = require('../models/itemAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const Item = require('../models/itemAzyk');
const SubBrandAzyk = require('../models/subBrandAzyk');
const WarehouseAzyk = require('../models/warehouseAzyk');

const type = `
  type Stock {
    _id: ID
    createdAt: Date
    item: Item
    organization: Organization
    warehouse: Warehouse
    unlimited: Boolean
    count: Float
 }
`;

const query = `
    itemsForStocks(organization: ID!, warehouse: ID): [Item]
    stocks(search: String!, client: ID, organization: ID!, unlimited: Boolean): [Stock]
`;

const mutation = `
    addStock(item: ID!, organization: ID!, unlimited: Boolean, count: Float!, warehouse: ID): Stock
    setStock(_id: ID!, count: Float, unlimited: Boolean): String
    deleteStock(_id: ID!): String
`;

const resolvers = {
    itemsForStocks: async(parent, {organization, warehouse}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let excludedItems = await StockAzyk.find({
                organization: user.organization||organization,
                warehouse
           })
                .distinct('item')
                .lean()
            return await Item.find({
                _id: {$nin: excludedItems},
                organization: user.organization||organization
           })
                .select('_id name')
                .lean()
       }
   },
    stocks: async(parent, {organization, client, search, unlimited}, {user}) => {
        if(user.role) {
            if(user.client)
                client = user.client
            else if(user.organization)
                organization = user.organization
            // eslint-disable-next-line no-undef
            const [subBrand, searchedItems] = await Promise.all([
                SubBrandAzyk.findById(organization).select('organization _id').lean(),
                search?ItemAzyk.find({name: {$regex: reductionSearchText(search), $options: 'i'}}).distinct('_id'):null,
            ])
            if(subBrand) organization = subBrand.organization
            let warehouse
            if(client) {
                const district = await DistrictAzyk.findOne({organization, client}).select('warehouse').lean()
                warehouse = district&&district.warehouse
           }
            return await StockAzyk.find({
                organization,
                ...isNotEmpty(unlimited)?{unlimited: unlimited?true:{$ne: true}}:{},
                ...client?{warehouse}:{},
                ...search?{item: {$in: searchedItems}}:{}
           })
                .sort('-createdAt')
                .populate({
                    path: 'item',
                    select: '_id name'
               })
                .populate({
                    path: 'warehouse',
                    select: '_id name'
               })
                .lean()
       }
   }
};

const resolversMutation = {
    addStock: async(parent, {item, organization, count, warehouse, unlimited}, {user}) => {
        if(
            ['admin', 'суперорганизация', 'организация'].includes(user.role)&&
            !(await StockAzyk.countDocuments({item, organization: user.organization||organization, warehouse}).lean())
        ) {
            // eslint-disable-next-line no-undef
            const [createdObject, itemData, warehouseData] = await Promise.all([
                StockAzyk.create({item, count, warehouse, unlimited, organization: user.organization||organization}),
                ItemAzyk.findById(item).select('_id name').lean(),
                warehouse?WarehouseAzyk.findById(warehouse).select('_id name').lean():null
            ]);
            return {...createdObject.toObject(), item: itemData, warehouse: warehouseData}
       }
   },
    setStock: async(parent, {_id, count, unlimited}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            const stock = await StockAzyk.findOne({_id, ...user.organization?{organization: user.organization}:{}})
            if(isNotEmpty(count)) stock.count = count
            if(isNotEmpty(unlimited)) stock.unlimited = unlimited
            await stock.save()
       }
        return 'OK'
   },
    deleteStock: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            await StockAzyk.deleteOne({_id})
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;