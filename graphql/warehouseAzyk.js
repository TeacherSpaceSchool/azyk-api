const WarehouseAzyk = require('../models/warehouseAzyk');
const StockAzyk = require('../models/stockAzyk');
const DistrictAzyk = require('../models/districtAzyk');
const {reductionSearch} = require('../module/const');

const type = `
  type Warehouse {
    _id: ID
    createdAt: Date
    organization: Organization
    name: String
    guid: String
 }
`;

const query = `
    warehouses(search: String!, organization: ID!): [Warehouse]
`;

const mutation = `
    addWarehouse(name: String!, organization: ID!, guid: String): Warehouse
    setWarehouse(_id: ID!, name: String, guid: String): String
    deleteWarehouse(_id: ID!): String
`;

const resolvers = {
    warehouses: async(parent, {organization, search}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            return await WarehouseAzyk.find({
                organization: user.organization||organization,
                ...search?{$or: [
                    {name: {$regex: reductionSearch(search), $options: 'i'}},
                    {guid: {$regex: reductionSearch(search), $options: 'i'}}
                ]}:{}
           }).sort('name').lean()
       }
   }
};

const resolversMutation = {
    addWarehouse: async(parent, {name, organization, guid}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            return WarehouseAzyk.create({
                organization: user.organization||organization,
                name, guid
           })
       }
   },
    setWarehouse: async(parent, {_id, name, guid}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let object = await WarehouseAzyk.findById(_id)
            if(name) object.name = name
            if(guid) object.guid = guid
            await object.save();
       }
        return 'OK'
   },
    deleteWarehouse: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            // eslint-disable-next-line no-undef
            await Promise.all([
                WarehouseAzyk.deleteOne({_id}),
                StockAzyk.deleteMany({warehouse: _id}),
                DistrictAzyk.updateMany({warehouse: _id}, {warehouse: null})
            ])
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;