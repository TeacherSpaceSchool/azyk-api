const HistoryAzyk = require('../models/historyAzyk');
const {reductionSearch, isNotEmpty, defaultLimit} = require('../module/const');

const type = `
  type History {
    _id: ID
    createdAt: Date
    employment: Employment
    client: Client
    user: Status
    object: ID
    type: Int
    model: String
    name: String
    data: String
 }
`;

const query = `
    histories(search: String, filter: String, skip: Int!): [History]
`;

const resolvers = {
    histories: async(parent, {search, filter, skip}, {user}) => {
        if(user.role==='admin') {
            return await HistoryAzyk.find({
                ...search?{object: {$regex: reductionSearch(search), $options: 'i'}}:{},
                ...filter?{model: filter}:{},
            })
                .populate({
                    path: 'user',
                    select: 'role'
               })
                .populate({
                    path: 'employment',
                    select: '_id name'
               })
                .populate({
                    path: 'client',
                    select: '_id name'
               })
                .sort('-createdAt')
                .skip(isNotEmpty(skip)?skip:0)
                .limit(isNotEmpty(skip)?defaultLimit:10000000000)
                .lean()
       }
   }
};

module.exports.type = type;
module.exports.query = query;
module.exports.resolvers = resolvers;