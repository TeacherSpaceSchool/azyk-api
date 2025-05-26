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
    setWarehouse(_id: ID!, name: String, guid: String): Data
    deleteWarehouse(_id: ID!): Data
`;

const resolvers = {
    warehouses: async(parent, {organization, search}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            return await WarehouseAzyk.find({
                organization: user.organization?user.organization:organization,
                $or: [
                    {name: {'$regex': reductionSearch(search), '$options': 'i'}},
                    {guid: {'$regex': reductionSearch(search), '$options': 'i'}}
                ]
            }).sort('name').lean()
        }
    }
};

const resolversMutation = {
    addWarehouse: async(parent, {name, organization, guid}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let _object = new WarehouseAzyk({
                organization: user.organization?user.organization:organization,
                name, guid
            });
            _object = await WarehouseAzyk.create(_object)
            return _object
        }
    },
    setWarehouse: async(parent, {_id, name, guid}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            let object = await WarehouseAzyk.findById(_id)
            if(name) object.name = name
            if(guid) object.guid = guid
            await object.save();
        }
        return {data: 'OK'}
    },
    deleteWarehouse: async(parent, {_id}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            await WarehouseAzyk.deleteOne({_id})
            await StockAzyk.deleteMany({warehouse: _id})
            await DistrictAzyk.updateMany({warehouse: _id}, {warehouse: null})
        }
        return {data: 'OK'}
    }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;