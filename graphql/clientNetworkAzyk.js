const ClientNetworkAzyk = require('../models/clientNetworkAzyk');
const {reductionSearchText, unawaited} = require('../module/const');
const {addHistory, historyTypes} = require('../module/history');

const type = `
  type ClientNetwork {
    _id: ID
    createdAt: Date
    name: String
 }
`;

const query = `
    clientNetworks(search: String!): [ClientNetwork]
`;

const mutation = `
    addClientNetwork(name: String!): ClientNetwork
    setClientNetwork(_id: ID!, name: String!): String
    deleteClientNetwork(_id: ID!): String
`;

const resolvers = {
    clientNetworks: async(parent, {search}, {user}) => {
        if(user.role) {
            return await ClientNetworkAzyk.find({
                ...search?{name: {$regex: reductionSearchText(search), $options: 'i'}}:{},
           }).sort('name').lean()
       }
   }
};

const resolversMutation = {
    addClientNetwork: async(parent, {name}, {user}) => {
        if(['admin', 'суперорганизация', 'организация'].includes(user.role)) {
            const createdObject = await ClientNetworkAzyk.create({name})
            unawaited(() => addHistory({user, type: historyTypes.create, model: 'ClientNetworkAzyk', name, object: createdObject._id}))
            return createdObject
       }
   },
    setClientNetwork: async(parent, {_id, name}, {user}) => {
        if(user.role==='admin') {
            let object = await ClientNetworkAzyk.findById(_id)
            unawaited(() => addHistory({user, type: historyTypes.set, model: 'ClientNetworkAzyk', name: object.name, object: _id, data: {name}}))
            if(name) object.name = name
            await object.save();
       }
        return 'OK'
   },
    deleteClientNetwork: async(parent, {_id}, {user}) => {
        if(user.role==='admin') {
            let object = await ClientNetworkAzyk.findById(_id).lean()
            unawaited(() => addHistory({user, type: historyTypes.delete, model: 'ClientNetworkAzyk', name: object.name, object: _id}))
            await ClientNetworkAzyk.deleteOne({_id})
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;