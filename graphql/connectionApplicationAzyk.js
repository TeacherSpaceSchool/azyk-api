const ConnectionApplicationAzyk = require('../models/connectionApplicationAzyk');
const {isNotEmpty} = require('../module/const');

const type = `
  type ConnectionApplication {
    _id: ID
    createdAt: Date
    name: String
    phone: String
    address: String
    whereKnow: String
    taken: Boolean
 }
`;

const query = `
    connectionApplications(skip: Int, filter: String): [ConnectionApplication]
    connectionApplicationsSimpleStatistic(filter: String): Int
`;

const mutation = `
    addConnectionApplication(name: String!, phone: String!, address: String!, whereKnow: String!): ConnectionApplication
    acceptConnectionApplication(_id: ID!): String
    deleteConnectionApplication(_id: ID!): String
`;

const resolvers = {
    connectionApplications: async(parent, {skip, filter}, {user}) => {
        if('admin'===user.role) {
            return await ConnectionApplicationAzyk.aggregate(
                [
                    {
                        $match: {
                            ...(filter === 'обработка' ? {taken: false} : {})
                       }
                   },
                    {$sort: {'createdAt': -1}},
                    {$skip: isNotEmpty(skip) ? skip : 0},
                    {$limit: isNotEmpty(skip) ? 15 : 10000000000}
                ])
       }
   },
    connectionApplicationsSimpleStatistic: async(parent, {filter}, {user}) => {
        if('admin'===user.role)
            return await ConnectionApplicationAzyk.countDocuments({
                ...(filter === 'обработка' ? {taken: false} : {})
           }).lean()
   },
};

const resolversMutation = {
    addConnectionApplication: async(parent, {name, phone, address, whereKnow}, {user}) => {
        if(!user.role) {
            const createdObject = await ConnectionApplicationAzyk.create({
                name,
                phone,
                address,
                whereKnow,
                taken: false
            })
            return createdObject
       }
   },
    acceptConnectionApplication: async(parent, {_id}, {user}) => {
        if('admin'===user.role) {
            let object = await ConnectionApplicationAzyk.findById(_id)
            object.taken = true
            await object.save();
       }
        return 'OK'
   },
    deleteConnectionApplication: async(parent, {_id}, {user}) => {
        if(user.role==='admin') {
            await ConnectionApplicationAzyk.deleteOne({_id})
       }
        return 'OK'
   }
};

module.exports.resolversMutation = resolversMutation;
module.exports.mutation = mutation;
module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;